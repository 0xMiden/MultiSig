// Test-only device boundary, aliased exclusively by the browser-test Vite server.
import { keccak256, toHex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import type { LedgerDevice } from '../../../src/lib/ledger/adapter';
// Like a real device, every derivation path has its own key.
const walletFor = (path: string) => privateKeyToAccount(keccak256(toHex(`ledger-test:${path}`)));
export const controls = { reject: false, unplug: () => {}, paths: [] as string[], confirmations: 0 };
export const ledgerSupported = () => true;
export function createLedgerConnection(onDisconnect: () => void) {
  controls.unplug = onDisconnect;
  const device: LedgerDevice = {
    async getAddress(path, confirm) {
      controls.paths.push(path);
      if (confirm) {
        controls.confirmations++;
        if (controls.reject) throw new Error('User rejected address confirmation');
      }
      const wallet = walletFor(path);
      return { path, address: wallet.address, publicKey: wallet.publicKey };
    },
    async signTypedData(path, data) {
      if (controls.reject) throw new Error('User rejected signing');
      const wallet = walletFor(path);
      const signature = await wallet.signTypedData(data as Parameters<typeof wallet.signTypedData>[0]);
      return {r: signature.slice(0,66), s: `0x${signature.slice(66,130)}`, v: parseInt(signature.slice(130),16)};
    },
    cancel() {}, async disconnect() {},
  };
  return {connect: async () => device, disconnect: device.disconnect};
}
