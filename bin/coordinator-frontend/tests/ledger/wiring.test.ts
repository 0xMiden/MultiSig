import {describe,expect,it} from 'vitest';
import {createSigner} from '../../src/lib/multisigApi';
import type {SignerInfo} from '../../src/types/psm';
import type {Signer} from '@openzeppelin/guardian-client';
// Deliberately no local keys: Ledger must never fall back to generated software keys.
const noLocalKeys={} as SignerInfo;
describe('application signer selection',()=>{
  it('requires an explicit Ledger session',()=>{
    expect(()=>createSigner(noLocalKeys,'ecdsa',{walletSource:'ledger'})).toThrow('Connect and select');
  });
  it('rejects using Ledger for a Falcon account',()=>{
    expect(()=>createSigner(noLocalKeys,'falcon',{walletSource:'ledger',ledgerSigner:{} as Signer})).toThrow('ECDSA');
  });
  it('passes the session signer unchanged into the shared multisig flow',()=>{
    const signer={} as Signer;
    expect(createSigner(noLocalKeys,'ecdsa',{walletSource:'ledger',ledgerSigner:signer})).toBe(signer);
  });
});
