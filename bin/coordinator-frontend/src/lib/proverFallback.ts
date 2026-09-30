import { TransactionProver, type AccountId, type TransactionRequest } from '@miden-sdk/miden-sdk';

/**
 * Structural view of the SDK's internal `ProverWorkflow`
 * (@openzeppelin/miden-multisig-client `prover/workflow.js`): execute the
 * request, prove it, submit the proof, apply the result.
 */
interface ProverWorkflowLike {
  client: {
    sync(): Promise<unknown>;
    transactions: {
      executeRequest(accountId: AccountId, request: TransactionRequest): Promise<{
        prove(options?: { prover?: TransactionProver }): Promise<{
          submit(): Promise<{ apply(): Promise<unknown> }>;
        }>;
      }>;
    };
  };
  config: { kind: 'injected' | 'remote'; createProver(): TransactionProver | undefined };
  submit(accountId: AccountId, request: TransactionRequest): Promise<void>;
}

export interface ProverWorkflowHooks {
  /**
   * Called when proving starts. The SDK reaches this step only after Guardian
   * accepted the execute's push, so it proves the account's lock is this
   * execute's own.
   */
  onPushed?(): void;
  /** Called when the remote prover failed and this device takes over. */
  onFallback?(error: unknown): void;
  createLocalProver?(): TransactionProver;
}

function workflowOf(multisig: object): ProverWorkflowLike | null {
  const workflow = (multisig as { proverWorkflow?: unknown }).proverWorkflow as Partial<ProverWorkflowLike> | undefined;
  if (
    !workflow ||
    typeof workflow.submit !== 'function' ||
    typeof workflow.client?.sync !== 'function' ||
    typeof workflow.client?.transactions?.executeRequest !== 'function' ||
    typeof workflow.config?.createProver !== 'function'
  ) {
    return null;
  }
  return workflow as ProverWorkflowLike;
}

/**
 * Gives each execute the most time to prove before the transaction expires.
 *
 * A transaction expires a fixed number of blocks after its reference block:
 * tokens with transfer policies (e.g. a blocklist) cap it at 20 blocks, about a
 * minute on devnet, and the node wants it two blocks before that. Execute
 * pushes the delta to Guardian, which locks the account, before the proof
 * exists, so a proof that misses the window leaves the account locked.
 *
 * - The client syncs right before executing, so the reference block, and with
 *   it the window, starts at the chain tip rather than at the last sync.
 * - When a remote prover fails, the request is re-executed at the new tip and
 *   proved locally, so local proving gets a full window instead of what the
 *   remote attempt left. The local prover is authoritative: an invalid
 *   transaction fails there with the real error, and proving locally keeps the
 *   transaction data on the device.
 *
 * The SDK has no hook for this and does not retry these failures (a stream
 * abort surfaces as gRPC `unknown`), so this replaces the internal workflow's
 * `submit` with the same execute, prove, submit and apply steps. Returns false,
 * leaving the SDK untouched, if the workflow is not shaped as expected.
 */
export function configureProverWorkflow(multisig: object, hooks: ProverWorkflowHooks = {}): boolean {
  const workflow = workflowOf(multisig);
  if (!workflow) return false;
  const { client, config } = workflow;
  const createLocalProver = hooks.createLocalProver ?? (() => TransactionProver.newLocalProver());

  const executeAtTip = async (accountId: AccountId, request: TransactionRequest) => {
    await client.sync();
    return client.transactions.executeRequest(accountId, request);
  };

  workflow.submit = async (accountId, request) => {
    hooks.onPushed?.();
    let proof;
    const execution = await executeAtTip(accountId, request);
    const prover = config.createProver();
    if (config.kind !== 'remote' || !prover) {
      proof = prover ? await execution.prove({ prover }) : await execution.prove();
    } else {
      try {
        proof = await execution.prove({ prover });
      } catch (remoteError) {
        hooks.onFallback?.(remoteError);
        const fresh = await executeAtTip(accountId, request);
        proof = await fresh.prove({ prover: createLocalProver() });
      }
    }
    const submission = await proof.submit();
    await submission.apply();
  };
  return true;
}
