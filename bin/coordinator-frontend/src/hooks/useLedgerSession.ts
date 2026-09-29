'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Eip712Signer, EcdsaFormat } from '@openzeppelin/miden-multisig-client';
import { DirectLedgerAdapter, ledgerPath, type LedgerAccount, type LedgerDevice, type LedgerPathScheme } from '@/lib/ledger/adapter';
import type { createLedgerConnection } from '@/lib/ledger/device';

export function useLedgerSession() {
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [connected, setConnected] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<LedgerAccount[]>([]);
  const [scheme, setScheme] = useState<LedgerPathScheme>('ledger-live');
  const [signer, setSigner] = useState<Eip712Signer | null>(null);
  const [selected, setSelected] = useState<LedgerAccount | null>(null);
  const connection = useRef<ReturnType<typeof createLedgerConnection> | null>(null);
  const device = useRef<LedgerDevice | null>(null);
  const adapter = useRef<DirectLedgerAdapter | null>(null);
  const generation = useRef(0);
  const lock = useRef(false);

  const disconnect = useCallback(() => {
    generation.current++;
    adapter.current?.invalidate();
    adapter.current = null;
    const previous = connection.current;
    connection.current = null;
    device.current = null;
    lock.current = false;
    setReady(false); setConnected(false); setBusy(false);
    setSigner(null); setSelected(null); setAccounts([]); setStatus(null);
    void previous?.disconnect().catch(() => {});
  }, []);

  const close = useCallback(() => { setOpen(false); if (!signer) disconnect(); }, [disconnect, signer]);

  useEffect(() => {
    if (!open || connection.current) return;
    const current = generation.current;
    let disposed = false;
    void import('@/lib/ledger/device').then(module => {
      if (disposed || current !== generation.current) return;
      if (!module.ledgerSupported()) throw new Error('Ledger USB requires desktop Chrome or Edge on HTTPS or localhost.');
      connection.current = module.createLedgerConnection(() => {
        disconnect(); setOpen(false);
        setError('Ledger disconnected. Reconnect and load your account again.');
      }, message => { if (generation.current === current) setStatus(message); });
      setReady(true);
    }).catch(err => { if (!disposed) setError(err instanceof Error ? err.message : String(err)); });
    return () => { disposed = true; };
  }, [open, disconnect]);

  useEffect(() => () => {
    generation.current++;
    adapter.current?.invalidate();
    void connection.current?.disconnect().catch(() => {});
  }, []);

  const perform = useCallback(async (operation: (current: number) => Promise<void>) => {
    if (lock.current) return;
    lock.current = true;
    const current = generation.current;
    setBusy(true); setError(null);
    try { await operation(current); }
    catch (err) { if (generation.current === current) setError(err instanceof Error ? err.message : String(err)); }
    finally {
      if (generation.current === current) { lock.current = false; setBusy(false); setStatus(null); }
    }
  }, []);

  const readPage = useCallback(async (target: LedgerDevice, pathScheme: LedgerPathScheme, start: number, current: number) => {
    const page: LedgerAccount[] = [];
    for (let index = start; index < start + 5; index++) {
      if (generation.current !== current) throw new Error('Ledger session changed');
      setStatus(`Reading Ledger address ${index + 1}`);
      page.push(await target.getAddress(ledgerPath(pathScheme, index), false));
    }
    if (generation.current === current) setAccounts(previous => start === 0 ? page : [...previous, ...page]);
  }, []);

  // With a live session, only browse: the current signer (and the account
  // loaded with it) stays usable until another address is confirmed.
  const show = useCallback(() => {
    setError(null);
    const target = device.current;
    if (!signer || !target || !connection.current) {
      disconnect();
      setOpen(true);
      return;
    }
    setOpen(true);
    if (accounts.length === 0) void perform(current => readPage(target, scheme, 0, current));
  }, [signer, accounts.length, disconnect, perform, readPage, scheme]);

  const connect = useCallback(() => perform(async current => {
    if (!connection.current) throw new Error('Ledger USB support is still loading');
    setStatus('Choose your Ledger in the browser device picker');
    const target = await connection.current.connect();
    if (generation.current !== current) { await target.disconnect(); return; }
    device.current = target; setConnected(true);
    await readPage(target, scheme, 0, current);
  }), [perform, readPage, scheme]);

  const changeScheme = useCallback((value: LedgerPathScheme) => perform(async current => {
    setScheme(value); setAccounts([]);
    if (device.current) await readPage(device.current, value, 0, current);
  }), [perform, readPage]);

  const loadMore = useCallback(() => perform(async current => {
    if (device.current) await readPage(device.current, scheme, accounts.length, current);
  }), [perform, readPage, scheme, accounts.length]);

  const select = useCallback((account: LedgerAccount) => perform(async current => {
    const target = device.current;
    if (!target) throw new Error('Connect Ledger first');
    setStatus('Confirm the selected address on Ledger');
    const confirmed = await target.getAddress(account.path, true);
    if (generation.current !== current) return;
    if (confirmed.address.toLowerCase() !== account.address.toLowerCase() ||
        EcdsaFormat.compressPublicKey(confirmed.publicKey) !== EcdsaFormat.compressPublicKey(account.publicKey)) {
      throw new Error('Ledger returned a different account. Reconnect and select again.');
    }
    if (signer && selected && selected.path === confirmed.path &&
        selected.address.toLowerCase() === confirmed.address.toLowerCase()) {
      setOpen(false);
      return;
    }
    // Switching addresses: the previous signer must never sign again.
    adapter.current?.invalidate();
    const bridge = new DirectLedgerAdapter(target, confirmed, message => { if (generation.current === current) setStatus(message); });
    const nextSigner = new Eip712Signer(bridge, confirmed.publicKey, confirmed.address);
    adapter.current = bridge;
    setSigner(nextSigner); setSelected(confirmed); setOpen(false);
  }), [perform, signer, selected]);

  const cancel = useCallback(() => {
    disconnect(); setOpen(false);
    setError('Ledger operation cancelled. Reconnect to continue.');
  }, [disconnect]);

  return { open, show, close, ready, connected, busy, status, error, accounts, scheme,
    signer, selected, connect, disconnect, changeScheme, loadMore, select, cancel };
}

export type LedgerSession = ReturnType<typeof useLedgerSession>;
