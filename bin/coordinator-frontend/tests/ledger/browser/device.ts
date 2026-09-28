// Test-only device boundary, aliased exclusively by the browser-test Vite server.
import { privateKeyToAccount } from 'viem/accounts';
import type { LedgerDevice } from '../../../src/lib/ledger/adapter';
const wallet = privateKeyToAccount(`0x${'07'.repeat(32)}`);
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
      return { path, address: wallet.address, publicKey: wallet.publicKey };
    },
    async signTypedData(_path, data) {
      if (controls.reject) throw new Error('User rejected signing');
      const signature = await wallet.signTypedData(data as Parameters<typeof wallet.signTypedData>[0]);
      return {r: signature.slice(0,66), s: `0x${signature.slice(66,130)}`, v: parseInt(signature.slice(130),16)};
    },
    cancel() {}, async disconnect() {},
  };
  return {connect: async () => device, disconnect: device.disconnect};
}
