import {
  DeviceManagementKitBuilder, DeviceActionStatus, DeviceStatus,
  type DeviceActionState,
} from '@ledgerhq/device-management-kit';
import { webHidTransportFactory } from '@ledgerhq/device-transport-kit-web-hid';
import { SignerEthBuilder } from '@ledgerhq/device-signer-kit-ethereum';
import { firstValueFrom, timeout, type Observable, type Subscription } from 'rxjs';
import type { LedgerDevice } from './adapter';

// This app signs summary hashes, not Ledger-certified clear-signing descriptors.
// Explicitly omit remote context/telemetry services; no origin token is fabricated.
const summaryContext: Parameters<SignerEthBuilder['withContextModule']>[0] = {
  getContexts: async () => [],
  getFieldContext: async () => { throw new Error('Ledger clear-signing context is unavailable'); },
  getTypedDataFilters: async () => ({ type: 'error', error: new Error('Summary signing has no clear-signing descriptor') }),
  report: async () => {},
  signReport: async () => {},
};

export function ledgerSupported(): boolean {
  return typeof navigator !== 'undefined' && 'hid' in navigator && window.isSecureContext;
}

export function createLedgerConnection(onDisconnect: () => void, onStatus: (text: string) => void) {
  const dmk = new DeviceManagementKitBuilder().addTransport(webHidTransportFactory).build();
  let cancelAction: (() => void) | undefined;
  let sessionId: string | undefined;
  let sessionSubscription: Subscription | undefined;
  let closed = false;

  function run<T, E, I>(action: {
    observable: Observable<DeviceActionState<T, E, I>>;
    cancel: () => void;
  }): Promise<T> {
    return new Promise((resolve, reject) => {
      // Assigned after subscribing: synchronous completion must also be handled.
      // eslint-disable-next-line prefer-const
      let subscription: Subscription | undefined;
      let settled = false;
      const finish = (error?: unknown, value?: T) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        subscription?.unsubscribe();
        cancelAction = undefined;
        if (error) reject(error); else resolve(value as T);
      };
      const cancel = () => {
        finish(new Error('Ledger operation cancelled. Please retry when ready.'));
        action.cancel();
      };
      const timer = setTimeout(cancel, 180_000);
      cancelAction = cancel;
      subscription = action.observable.subscribe({
        next: state => {
          if (state.status === DeviceActionStatus.Completed) finish(undefined, state.output);
          else if (state.status === DeviceActionStatus.Error) {
            const error = state.error;
            finish(error instanceof Error ? error : new Error(`Ledger operation failed: ${JSON.stringify(error)}`));
          } else if (state.status === DeviceActionStatus.Stopped) finish(new Error('Ledger operation cancelled'));
          else if (state.status === DeviceActionStatus.Pending) {
            const intermediate = state.intermediateValue as { requiredUserInteraction?: string };
            if (intermediate?.requiredUserInteraction) onStatus(`Check Ledger: ${intermediate.requiredUserInteraction}`);
          }
        },
        error: error => finish(error),
        complete: () => { if (!settled) finish(new Error('Ledger operation ended without a result')); },
      });
      if (settled) subscription.unsubscribe();
    });
  }

  async function disconnect() {
    if (closed) return;
    closed = true;
    cancelAction?.();
    sessionSubscription?.unsubscribe();
    try {
      await dmk.stopDiscovering();
      if (sessionId) await dmk.disconnect({ sessionId });
    } finally { dmk.close(); }
  }

  return {
    disconnect,
    // Called directly from a click after the module has loaded to preserve WebHID user activation.
    async connect(): Promise<LedgerDevice> {
      if (!ledgerSupported()) throw new Error('Use desktop Chrome or Edge over HTTPS (or localhost) for Ledger USB.');
      const device = await firstValueFrom(dmk.startDiscovering({}).pipe(timeout(60_000)))
        .finally(() => dmk.stopDiscovering());
      if (closed) throw new Error('Ledger connection cancelled');
      sessionId = await dmk.connect({ device });
      if (closed) { await dmk.disconnect({ sessionId }); throw new Error('Ledger connection cancelled'); }
      const eth = new SignerEthBuilder({ dmk, sessionId }).withContextModule(summaryContext).build();
      sessionSubscription = dmk.getDeviceSessionState({ sessionId }).subscribe({
        next: state => { if (state.deviceStatus === DeviceStatus.NOT_CONNECTED && !closed) onDisconnect(); },
        error: () => { if (!closed) onDisconnect(); },
        complete: () => { if (!closed) onDisconnect(); },
      });
      return {
        getAddress: async (path, confirm) => {
          const result = await run(eth.getAddress(path, { checkOnDevice: confirm }));
          return { address: result.address, publicKey: result.publicKey, path };
        },
        signTypedData: (path, data) => run(eth.signTypedData(path, data)),
        cancel: () => cancelAction?.(),
        disconnect,
      };
    },
  };
}
