import { GuardianHttpClient, type LookupResponse, type Signer } from '@openzeppelin/guardian-client';
import { toBech32Address } from './helpers';

/** A multisig account the connected signer cosigns, as Guardian lists it. */
export interface SignerAccount {
  accountId: string;
  /** The bech32 form for this network, when the id parses. */
  address: string | null;
}

/** The minimal Guardian client surface the lookup needs; kept narrow so tests can fake it. */
export interface LookupClient {
  setSigner(signer: Signer): void;
  lookupAccountByKeyCommitment(keyCommitmentHex: string): Promise<LookupResponse>;
}

/** Guardian's lookup reply as a de-duplicated list, in Guardian's order. */
export function signerAccountsFrom(response: LookupResponse, bech32: (id: string) => string | null = toBech32Address): SignerAccount[] {
  const seen = new Set<string>();
  const accounts: SignerAccount[] = [];
  for (const { accountId } of response.accounts) {
    const id = accountId.toLowerCase();
    if (seen.has(id)) continue;
    seen.add(id);
    accounts.push({ accountId: id, address: bech32(id) });
  }
  return accounts;
}

/**
 * The accounts `signer` cosigns on Guardian (`/state/lookup`, one lookup
 * signature from the wallet). `client` signs that request with `signer`.
 */
export async function lookupSignerAccounts(
  client: LookupClient,
  signer: Signer,
  bech32: (id: string) => string | null = toBech32Address,
): Promise<SignerAccount[]> {
  client.setSigner(signer);
  return signerAccountsFrom(await client.lookupAccountByKeyCommitment(signer.commitment), bech32);
}

/** A fresh client for `guardianUrl`: the lookup must not change the signer of the app's shared clients. */
export function lookupClientFor(guardianUrl: string): LookupClient {
  return new GuardianHttpClient(guardianUrl);
}
