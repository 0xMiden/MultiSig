'use client';

import { useState } from 'react';
import { useMultisig } from '@/contexts/MultisigContext';
import { noteRoleLabel } from '@/lib/history/annotate';
import { txTitle } from '@/lib/history/summary';
import type { HistoryNote, HistoryTx } from '@/hooks/useOnChainHistory';

export const dynamic = 'force-dynamic';

function formatTime(ts?: number): string {
  if (!ts) return '';
  return new Date(ts * 1000).toLocaleString();
}

function Mono({ value, title }: { value: string; title?: string }) {
  return (
    <span className="font-mono break-all text-[12px] text-[#111]" title={title}>
      {value}
    </span>
  );
}

function Copy({ value }: { value: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="ml-2 text-[11px] text-[#FF5500] hover:underline shrink-0"
      onClick={() => {
        void navigator.clipboard?.writeText(value).then(() => {
          setDone(true);
          setTimeout(() => setDone(false), 1200);
        });
      }}
    >
      {done ? 'copied' : 'copy'}
    </button>
  );
}

function consumptionLabel(note: HistoryNote): { text: string; tone: 'green' | 'amber' | 'red' | 'gray' } {
  if (!note.committed) return { text: 'consumed in the same batch', tone: 'green' };
  if (note.role !== 'admin') return { text: 'committed', tone: 'gray' };
  const by = note.contract === 'agglayer' ? 'bridge' : 'faucet';
  switch (note.consumption?.state) {
    case 'applied':
      return { text: `applied by the ${by}`, tone: 'green' };
    case 'failed':
      return { text: `rejected by the ${by}: ${note.consumption.detail ?? ''}`, tone: 'red' };
    case 'awaiting_consumption':
      return {
        text: note.consumption.detail ? `awaiting consumption (last error: ${note.consumption.detail})` : 'awaiting consumption',
        tone: 'amber',
      };
    default:
      return { text: `committed; ${by} verdict unknown`, tone: 'gray' };
  }
}

const TONE: Record<'green' | 'amber' | 'red' | 'gray', string> = {
  green: 'bg-[#28A857]/10 text-[#1F7A3F]',
  amber: 'bg-amber-50 text-amber-800',
  red: 'bg-red-50 text-red-700',
  gray: 'bg-[rgba(0,0,0,0.05)] text-[rgba(0,0,0,0.6)]',
};

function NoteRow({ note }: { note: HistoryNote }) {
  const c = consumptionLabel(note);
  return (
    <li className="rounded-[8px] border border-[rgba(0,0,0,0.06)] bg-[#f9f9f9] px-3 py-2 flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[12px] font-[600] text-[#111]">
          {note.kind ?? noteRoleLabel(note.role, note.contract)}
          {note.kind ? ` · ${noteRoleLabel(note.role, note.contract)}` : ''}
        </span>
        <span className={`text-[11px] font-[500] px-2 py-0.5 rounded-full ${TONE[c.tone]}`}>{c.text}</span>
        <span className="text-[11px] text-[rgba(0,0,0,0.45)]">
          {note.isPublic ? 'public' : 'private'} · tag {note.tag}
          {note.attachmentSchemes.some((s) => s !== 0) ? ` · attachments ${note.attachmentSchemes.filter((s) => s !== 0).join(',')}` : ''}
        </span>
      </div>
      <div className="flex items-start">
        <span className="text-[11px] text-[rgba(0,0,0,0.45)] mr-2 shrink-0">note id</span>
        <Mono value={note.noteIdHex} />
        <Copy value={note.noteIdHex} />
      </div>
    </li>
  );
}

function TxCard({ tx }: { tx: HistoryTx }) {
  const [open, setOpen] = useState(false);
  const title = txTitle(tx);

  return (
    <div className="rounded-[10px] border border-[rgba(0,0,0,0.08)] bg-white p-4 md:p-5 flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="text-[14px] font-[600] text-[#111]">{title}</div>
        <div className="text-[12px] text-[rgba(0,0,0,0.5)]">
          block {tx.blockNum}
          {tx.timestamp ? ` · ${formatTime(tx.timestamp)}` : ''}
        </div>
      </div>

      <div className="flex items-start">
        <span className="text-[11px] text-[rgba(0,0,0,0.45)] mr-2 shrink-0 w-14">tx id</span>
        <Mono value={tx.txIdHex} />
        <Copy value={tx.txIdHex} />
      </div>

      {tx.proposals.length > 0 && (
        <div className="text-[12px] text-[rgba(0,0,0,0.6)]">
          Executed proposal{tx.proposals.length > 1 ? 's' : ''}:{' '}
          {tx.proposals.map((p) => (
            <span key={p.proposalId} className="font-mono" title={p.proposalId}>
              {p.proposalId.slice(0, 10)}…{' '}
            </span>
          ))}
        </div>
      )}

      <div className="text-[12px] text-[rgba(0,0,0,0.6)]">
        {tx.inputNotes.length} note{tx.inputNotes.length === 1 ? '' : 's'} consumed · {tx.notes.length} note
        {tx.notes.length === 1 ? '' : 's'} created
      </div>

      {tx.notes.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {tx.notes.map((n) => (
            <NoteRow key={n.noteIdHex} note={n} />
          ))}
        </ul>
      )}

      <button type="button" onClick={() => setOpen((o) => !o)} className="self-start text-[12px] text-[#FF5500] hover:underline">
        {open ? 'Hide details' : 'Show details'}
      </button>

      {open && (
        <div className="flex flex-col gap-1.5 text-[12px]">
          {tx.inputNotes.map((n) => (
            <div key={n.nullifierHex} className="flex flex-col">
              <div className="flex items-start">
                <span className="text-[11px] text-[rgba(0,0,0,0.45)] mr-2 shrink-0 w-24">consumed note</span>
                <Mono value={n.noteIdHex ?? '(private note)'} />
                {n.noteIdHex && <Copy value={n.noteIdHex} />}
              </div>
              <div className="flex items-start">
                <span className="text-[11px] text-[rgba(0,0,0,0.45)] mr-2 shrink-0 w-24">nullifier</span>
                <Mono value={n.nullifierHex} />
              </div>
            </div>
          ))}
          <div className="flex items-start">
            <span className="text-[11px] text-[rgba(0,0,0,0.45)] mr-2 shrink-0 w-24">state before</span>
            <Mono value={tx.initialStateHex} />
          </div>
          <div className="flex items-start">
            <span className="text-[11px] text-[rgba(0,0,0,0.45)] mr-2 shrink-0 w-24">state after</span>
            <Mono value={tx.finalStateHex} />
          </div>
        </div>
      )}
    </div>
  );
}

export default function HistoryPage() {
  const { multisig, onChainHistory } = useMultisig();
  const { state, refresh } = onChainHistory;
  const txs = 'txs' in state ? state.txs : [];

  return (
    <div className="flex flex-col w-full gap-4 p-2 md:p-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <div className="text-[22px] md:text-[24px] font-[600] text-[#111]">On-chain history</div>
          <div className="text-[13px] font-[500] text-[rgba(0,0,0,0.5)]">
            Every transaction this account executed, as recorded by the node.
            {multisig ? (
              <>
                {' '}
                Account <span className="font-mono">{multisig.accountId}</span>
              </>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-3 text-[12px] text-[rgba(0,0,0,0.5)]">
          {state.status === 'ready' && (
            <span>
              {txs.length} transaction{txs.length === 1 ? '' : 's'} · chain tip {state.chainTip}
            </span>
          )}
          <button
            type="button"
            onClick={refresh}
            disabled={state.status === 'loading' || !multisig}
            className="h-9 px-3 rounded-[8px] border border-[rgba(0,0,0,0.08)] text-[13px] font-[500] text-[rgba(0,0,0,0.7)] hover:bg-gray-50 disabled:opacity-40"
          >
            {state.status === 'loading' ? 'Loading…' : 'Refresh'}
          </button>
        </div>
      </div>

      {!multisig && (
        <div className="rounded-[10px] border border-[rgba(0,0,0,0.08)] p-4 md:p-5 bg-white text-[13px] text-[rgba(0,0,0,0.6)]">
          Load an account to see its on-chain history.
        </div>
      )}

      {state.status === 'error' && (
        <div role="alert" className="rounded-[10px] border border-red-200 bg-red-50 p-4 text-[13px] text-red-700">
          Could not load the on-chain history: {state.message}
        </div>
      )}

      {multisig && state.status === 'loading' && txs.length === 0 && (
        <div className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-[3px] border-[#FF5500] border-t-transparent rounded-full animate-spin" />
            <div className="text-[13px] font-[500] text-[rgba(0,0,0,0.5)]">Reading the node…</div>
          </div>
        </div>
      )}

      {multisig && state.status === 'ready' && txs.length === 0 && (
        <div className="rounded-[10px] border border-[rgba(0,0,0,0.08)] p-4 md:p-5 bg-white text-[13px] text-[rgba(0,0,0,0.6)]">
          The node has no transactions for this account yet.
        </div>
      )}

      {txs.map((tx) => (
        <TxCard key={tx.txIdHex} tx={tx} />
      ))}
    </div>
  );
}
