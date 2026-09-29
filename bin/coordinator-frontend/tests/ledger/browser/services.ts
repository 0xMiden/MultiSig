// Real Guardian + Miden flow test. Only the physical Ledger boundary is simulated.
import { MidenClient, NoteType, AccountId, NoteTag } from '@miden-sdk/miden-sdk';
import { AccountInspector, Eip712Signer, MultisigClient, type Multisig, type Proposal } from '@openzeppelin/miden-multisig-client';
import { privateKeyToAccount } from 'viem/accounts';
import { DirectLedgerAdapter, ledgerPath, type LedgerDevice } from '../../../src/lib/ledger/adapter';
import { registerAccountOnNode, getOutputNotesFromTxSummary, relayPrivateNote } from '../../../src/lib/multisigApi';
import loadWasm from '../../../node_modules/@miden-sdk/miden-sdk/dist/st/wasm.js';

export interface ServiceOptions { rpcUrl: string; guardianUrl: string; transportUrl: string; invitationCode: string; sendAmount: string; }
function assert(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }
function makeSigner(byte: string) {
  const account = privateKeyToAccount(`0x${byte.repeat(32)}`);
  const identity = {address: account.address, publicKey: account.publicKey, path: ledgerPath('ledger-live',0)};
  const device: LedgerDevice = {
    getAddress: async () => identity, cancel() {}, disconnect: async () => {},
    signTypedData: async (_path,data) => {
      const signature=await account.signTypedData(data as Parameters<typeof account.signTypedData>[0]);
      return {r:signature.slice(0,66),s:`0x${signature.slice(66,130)}`,v:parseInt(signature.slice(130),16)};
    },
  };
  return new Eip712Signer(new DirectLedgerAdapter(device,identity), identity.publicKey,identity.address);
}
async function eventually<T>(operation: () => Promise<T>, accept: (value:T) => boolean, label:string): Promise<T> {
  const deadline=Date.now()+180_000;
  let last: unknown;
  do {
    try { const result=await operation(); if (accept(result)) return result; }
    catch(error) { last=error; }
    await new Promise(resolve=>setTimeout(resolve,2_000));
  } while(Date.now()<deadline);
  throw new Error(`${label} did not converge: ${String(last ?? 'condition not met')}`);
}
async function run(options: ServiceOptions) {
  await loadWasm();
  const miden=await MidenClient.create({rpcUrl:options.rpcUrl,noteTransportUrl:options.transportUrl,proverUrl:process.env.NEXT_PUBLIC_MIDEN_PROVER_URL,storeName:`ledger-integration-${crypto.randomUUID()}`,autoSync:true});
  const passed:string[]=[];
  const mark=(name:string)=>{passed.push(name);console.info(`Ledger service check passed: ${name}`);};
  try {
    const first=makeSigner('07'),second=makeSigner('08');
    const client=new MultisigClient(miden,{guardianEndpoint:options.guardianUrl,midenRpcEndpoint:options.rpcUrl});
    const guardian=await client.guardianClient.getPubkey('ecdsa');
    let account=await client.create({threshold:1,signerCommitments:[first.commitment],guardianCommitment:guardian.commitment,guardianPublicKey:guardian.pubkey,signatureScheme:'ecdsa'},first);
    await account.registerOnGuardian();
    console.info(`Disposable Ledger test account: ${account.accountId}`);
    assert(account.signerCommitments.includes(first.commitment),'Creation did not store Ledger commitment');
    mark('create and register account');
    const id=AccountId.fromHex(account.accountId),tag=NoteTag.withAccountTarget(id);
    await miden.tags.add(tag.asU32()); tag.free();id.free();
    await registerAccountOnNode(miden,account.accountId,options.invitationCode);
    account=await client.load(account.accountId,first);
    assert(account.signerCommitment===first.commitment,'Reload selected a different signer');
    mark('load account');
    assert((await client.recoverByKey(first)).some(item=>item.accountId===account.accountId),'Guardian lookup missed account');
    mark('authenticated lookup');
    async function execute(proposal:Proposal, ms:Multisig=account) {
      if (!ms.listProposals().find(item=>item.id===proposal.id)?.signatures.some(entry=>entry.signerId===first.commitment)) await ms.signProposal(proposal.id);
      await ms.executeProposal(proposal.id);
      await eventually(async()=>{await miden.sync();return ms.verifyStateCommitment();},()=>true,'on-chain state commitment');
      await eventually(()=>ms.syncState(),()=>true,'Guardian canonical state');
    }
    async function receive() {
      const notes=await eventually(async()=>{await miden.sync();await miden.notes.fetchPrivate();return account.getConsumableNotes();},notes=>notes.length>0,'funding/receive notes');
      await execute(await account.createConsumeNotesProposal(notes.map(note=>note.id)));
    }
    await receive(); mark('receive and consume funding note');
    const feeAsset=await miden.feeFaucetId();const faucetId=feeAsset.toString();feeAsset.free();
    const amount=BigInt(options.sendAmount);assert(amount>0n,'sendAmount must be positive');
    assert(await miden.accounts.getBalance(account.accountId,faucetId)>amount*2n,'Funding must cover transfers and transaction fees');
    for (const [label,noteType] of [['public',NoteType.Public],['private',NoteType.Private]] as const) {
      const height=await miden.getSyncHeight();
      const proposal=await account.createP2idProposal(account.accountId,faucetId,amount,{noteType});
      if (noteType===NoteType.Private) {
        const notes=getOutputNotesFromTxSummary(proposal.txSummary);
        assert(notes.length>0,'Private transfer produced no relayable note');
        for(const note of notes) await relayPrivateNote(miden,note,account.accountId,height);
      }
      await execute(proposal);mark(`send ${label} note`);
      await receive();mark(`consume ${label} note`);
    }
    await execute(await account.createAddSignerProposal(second.commitment));
    assert((await account.getSignerPublicKeyCommitments()).includes(second.commitment),'Added signer absent from account storage');
    mark('add signer');
    await execute(await account.createChangeThresholdProposal(2));
    assert(AccountInspector.fromAccount(await account.getStoreAccount()).threshold===2,'Threshold did not change to 2');
    mark('change threshold');
    // Prove the new threshold is enforced: one signature cannot execute.
    const proposal=await account.createChangeThresholdProposal(1);
    await account.signProposal(proposal.id);
    let rejected=false;
    try { await account.executeProposal(proposal.id); } catch(error) {
      if (!/not ready for execution.*(signatures|pending)/i.test(String(error))) throw error;
      rejected=true;
    }
    assert(rejected,'Two-of-two account accepted only one signer');
    const cosigner=await client.load(account.accountId,second);
    await cosigner.syncProposals();await cosigner.signProposal(proposal.id);
    await account.syncProposals();await execute(proposal);
    assert(AccountInspector.fromAccount(await account.getStoreAccount()).threshold===1,'Two-signature execution failed');
    mark('threshold enforcement and second signer execution');
    return {accountId:account.accountId,passed};
  } finally {miden.terminate();}
}
declare global { interface Window { runLedgerServiceSuite: typeof run; } }
window.runLedgerServiceSuite=run;
