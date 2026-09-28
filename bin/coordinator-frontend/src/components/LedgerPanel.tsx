'use client';

import { useEffect, useRef } from 'react';
import type { LedgerSession } from '@/hooks/useLedgerSession';
import type { LedgerPathScheme } from '@/lib/ledger/adapter';

export function LedgerPanel({ ledger }: { ledger: LedgerSession }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (ledger.open && !dialog.current?.open) dialog.current?.showModal();
    else if (!ledger.open) dialog.current?.close();
  }, [ledger.open]);
  const button = 'rounded-sm border border-black/20 px-3 py-2 text-sm hover:border-[#FF5500] focus-visible:outline-2 focus-visible:outline-[#FF5500] disabled:opacity-50';

  return <>
    <dialog ref={dialog} aria-labelledby="ledger-title" onCancel={event => {
      event.preventDefault(); ledger.close();
    }} className="m-auto w-[calc(100%_-_2rem)] max-w-xl rounded-lg border border-black/20 bg-white p-6 text-black shadow-xl backdrop:bg-black/40">
      <div className="flex items-center justify-between gap-4">
        <h2 id="ledger-title" className="text-lg font-semibold">Connect Ledger</h2>
        <button type="button" onClick={ledger.close} className={button} aria-label="Close Ledger connection">Close</button>
      </div>
      <p className="my-4 text-sm text-gray-600">Connect by USB, unlock your Ledger, and open the Ethereum app. Close other apps using the device.</p>
      {!ledger.connected ? <button type="button" disabled={!ledger.ready || ledger.busy}
        onClick={() => void ledger.connect()} className={`${button} bg-[#FF5500] text-white`}>
        {ledger.busy ? 'Connecting…' : ledger.ready ? 'Choose USB device' : ledger.error ? 'USB unavailable' : 'Loading USB support…'}
      </button> : <>
        <label htmlFor="ledger-path-scheme" className="block text-sm font-medium">Address layout</label>
        <select id="ledger-path-scheme" value={ledger.scheme} disabled={ledger.busy}
          onChange={event => void ledger.changeScheme(event.target.value as LedgerPathScheme)}
          className={`${button} my-2 w-full bg-white`}>
          <option value="ledger-live">Ledger Live accounts</option>
          <option value="legacy">Legacy / sequential addresses</option>
        </select>
        <p className="mb-3 text-xs text-gray-500">Choose the address to use as your Miden signer. These are derived addresses, not a list of funded accounts.</p>
        <ul className="max-h-72 space-y-2 overflow-y-auto" aria-label="Ledger addresses">
          {ledger.accounts.map(account => <li key={account.path}>
            <button type="button" disabled={ledger.busy} onClick={() => void ledger.select(account)}
              className={`${button} w-full text-left`}>
              <span className="block break-all font-mono text-xs">{account.address}</span>
              <span className="text-xs text-gray-500">{account.path} · Select and confirm</span>
            </button>
          </li>)}
        </ul>
        <button type="button" disabled={ledger.busy} onClick={() => void ledger.loadMore()} className={`${button} mt-3`}>Load more addresses</button>
      </>}
      {ledger.status && <p role="status" className="mt-4 text-sm">{ledger.status}</p>}
      {ledger.error && <p role="alert" className="mt-4 text-sm text-red-700">{ledger.error}</p>}
      <p className="mt-4 text-xs text-gray-500">Transaction approval signs a summary hash. Recipient and amount are reviewed in this app, not as decoded fields on Ledger.</p>
    </dialog>
    {!ledger.open && ledger.status && <div role="status" className="fixed bottom-5 left-1/2 z-[70] w-[calc(100%_-_2rem)] max-w-lg -translate-x-1/2 rounded-lg border border-[#FF5500] bg-white p-4 text-sm text-black shadow-lg">
      <p>{ledger.status}</p>
      <p className="mt-1 text-xs text-gray-500">Guardian authentication and transaction approval are separate device requests.</p>
      <button type="button" onClick={ledger.cancel} className={`${button} mt-2`}>Cancel Ledger operation</button>
    </div>}
  </>;
}
