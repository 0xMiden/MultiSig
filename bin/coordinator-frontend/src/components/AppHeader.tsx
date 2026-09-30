'use client';

import { LOCAL_KEYS_ENABLED } from '@/config/psm';
import React, { useState, useEffect, useRef } from 'react';
import { useMultisig } from '@/contexts/MultisigContext';
import { copyToClipboard, truncateHex } from '@/lib/helpers';
import { toast } from 'sonner';

export function AppHeader() {
  const {
    signer,
    generatingSigner,
    activeScheme,
    multisig,
    walletSource,
    setWalletSource,
    paraSession,
    midenWalletSession,
    connectMidenWallet,
    disconnectMidenWallet,
    openParaModal,
    ledger,
    creating, loadingAccount, creatingProposal, signingProposal, executingProposal, releasingCandidate, syncingState, registeringOnGuardian, privateSendProgress,
    guardianStatus,
    guardianUrl,
    setGuardianUrl,
    connectToGuardian,
  } = useMultisig();

  const [guardianPopoverOpen, setGuardianPopoverOpen] = useState(false);
  const [walletPopoverOpen, setWalletPopoverOpen] = useState(false);
  const [keysPopoverOpen, setKeysPopoverOpen] = useState(false);
  const [urlInput, setUrlInput] = useState(guardianUrl);

  const guardianRef = useRef<HTMLDivElement>(null);
  const walletRef = useRef<HTMLDivElement>(null);
  const keysRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setUrlInput(guardianUrl); }, [guardianUrl]);

  // Close popovers on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (guardianRef.current && !guardianRef.current.contains(e.target as Node)) setGuardianPopoverOpen(false);
      if (walletRef.current && !walletRef.current.contains(e.target as Node)) setWalletPopoverOpen(false);
      if (keysRef.current && !keysRef.current.contains(e.target as Node)) setKeysPopoverOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleGuardianSave = () => {
    setGuardianUrl(urlInput);
    connectToGuardian(urlInput);
    setGuardianPopoverOpen(false);
  };

  const handleCopy = (text: string, label: string) => {
    copyToClipboard(text, () => toast.success(`${label} copied`));
  };

  return (
    <header className="flex items-center justify-between py-3 px-6 border-b border-[#00000019] bg-white font-dmmono">
      <div className="text-[14px] font-[500] uppercase">Miden Multisig</div>

      <div className="flex items-center gap-2">
        {/* Wallet Source Selector */}
        <div className="relative" ref={walletRef}>
          <button
            onClick={() => setWalletPopoverOpen(!walletPopoverOpen)}
            className={`px-3 py-1 border rounded-sm text-[11px] font-[500] uppercase transition-colors ${
              (paraSession.connected || midenWalletSession.connected || !!ledger.signer)
                ? 'border-[#FF5500] text-[#FF5500] hover:bg-[#FF5500]/5'
                : 'border-[#00000033] hover:border-[#FF5500]'
            }`}
          >
            {walletSource === 'local' && !paraSession.connected && !midenWalletSession.connected && 'LOCAL KEYS'}
            {walletSource === 'local' && paraSession.connected && 'LOCAL (PARA AVAIL)'}
            {walletSource === 'para' && (paraSession.connected ? 'PARA' : 'PARA · NOT CONNECTED')}
            {walletSource === 'miden-wallet' && (midenWalletSession.connected ? 'MIDEN WALLET' : 'MIDEN WALLET · NOT CONNECTED')}
            {walletSource === 'ledger' && (ledger.signer ? 'LEDGER ●' : 'LEDGER DISCONNECTED')}
            {(walletSource === 'para' && paraSession.connected) || (walletSource === 'miden-wallet' && midenWalletSession.connected) ? ' ●' : ''}
          </button>
          {walletPopoverOpen && (
            <div className="absolute right-0 top-full mt-1 w-[280px] bg-white border border-[#00000019] shadow-lg rounded-sm p-3 z-50">
              <div className="text-[12px] font-[500] mb-2">WALLET SOURCE</div>
              <div className="flex flex-col gap-1.5">
                <button type="button"
                  disabled={creating || loadingAccount || creatingProposal || !!signingProposal || !!executingProposal || releasingCandidate || syncingState || registeringOnGuardian || privateSendProgress.step === "creating-proposal"}
                  onClick={() => { ledger.show(); setWalletPopoverOpen(false); }}
                  className={`w-full text-left px-3 py-2 text-[11px] rounded-sm border disabled:opacity-50 ${walletSource === 'ledger' ? 'bg-[#FF5500] text-white border-[#FF5500]' : 'border-[#00000019] hover:border-[#FF5500]'}`}>
                  {ledger.signer ? 'CHANGE LEDGER ADDRESS' : 'CONNECT LEDGER (USB)'}
                </button>
                {ledger.selected && ledger.signer && <div className="px-3 text-[10px] break-all">
                  <div title={ledger.selected.path}>{ledger.selected.address}</div>
                  <button type="button" className="mt-1 text-gray-600 underline" onClick={() => handleCopy(ledger.signer!.commitment, 'Ledger signer commitment')}>Copy signer commitment</button>
                  <button type="button" onClick={ledger.disconnect} className="ml-3 text-red-600 underline">Disconnect</button>
                </div>}
                {ledger.error && !ledger.open && <p role="alert" className="text-[10px] text-red-700">{ledger.error}</p>}
                {LOCAL_KEYS_ENABLED && (
                  <button
                    onClick={() => { setWalletSource('local'); setWalletPopoverOpen(false); }}
                    className={`w-full text-left px-3 py-2 text-[11px] rounded-sm border ${
                      walletSource === 'local' ? 'bg-[#FF5500] text-white border-[#FF5500]' : 'border-[#00000019] hover:border-[#FF5500]'
                    }`}
                  >
                    LOCAL KEYS
                  </button>
                )}

                {paraSession.connected ? (
                  <button
                    onClick={() => { setWalletSource('para'); setWalletPopoverOpen(false); }}
                    className={`w-full text-left px-3 py-2 text-[11px] rounded-sm border ${
                      walletSource === 'para' ? 'bg-[#FF5500] text-white border-[#FF5500]' : 'border-[#00000019] hover:border-[#FF5500]'
                    }`}
                  >
                    PARA WALLET (connected)
                  </button>
                ) : (
                  <button
                    onClick={() => { openParaModal(); setWalletPopoverOpen(false); }}
                    className="w-full text-left px-3 py-2 text-[11px] rounded-sm border border-[#00000019] hover:border-[#FF5500]"
                  >
                    CONNECT PARA WALLET
                  </button>
                )}
                {paraSession.connected && paraSession.commitment && (
                  <div
                    className="text-[10px] text-gray-500 px-3 cursor-pointer hover:text-black break-all"
                    onClick={() => handleCopy(paraSession.commitment!, 'Para commitment')}
                  >
                    {truncateHex(paraSession.commitment, 10, 6)}
                  </div>
                )}

                {midenWalletSession.connected ? (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => { setWalletSource('miden-wallet'); setWalletPopoverOpen(false); }}
                      className={`flex-1 text-left px-3 py-2 text-[11px] rounded-sm border ${
                        walletSource === 'miden-wallet' ? 'bg-[#FF5500] text-white border-[#FF5500]' : 'border-[#00000019] hover:border-[#FF5500]'
                      }`}
                    >
                      MIDEN WALLET (connected)
                    </button>
                    <button
                      onClick={() => disconnectMidenWallet()}
                      className="px-2 py-2 text-[10px] text-red-500 hover:text-red-700"
                    >
                      X
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => { connectMidenWallet(); setWalletPopoverOpen(false); }}
                    className="w-full text-left px-3 py-2 text-[11px] rounded-sm border border-[#00000019] hover:border-[#FF5500]"
                  >
                    CONNECT MIDEN WALLET
                  </button>
                )}
                {midenWalletSession.connected && midenWalletSession.commitment && (
                  <div
                    className="text-[10px] text-gray-500 px-3 cursor-pointer hover:text-black break-all"
                    onClick={() => handleCopy(midenWalletSession.commitment!, 'Wallet commitment')}
                  >
                    {truncateHex(midenWalletSession.commitment, 10, 6)}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Signer Keys */}
        {generatingSigner ? (
          <span className="text-[11px] text-gray-400">Generating keys...</span>
        ) : signer ? (
          <div className="relative" ref={keysRef}>
            <button
              onClick={() => setKeysPopoverOpen(!keysPopoverOpen)}
              className="px-3 py-1 border border-[#00000033] rounded-sm text-[11px] font-[500] uppercase hover:border-[#FF5500] transition-colors"
            >
              KEYS ({activeScheme})
            </button>
            {keysPopoverOpen && (
              <div className="absolute right-0 top-full mt-1 w-[300px] bg-white border border-[#00000019] shadow-lg rounded-sm p-3 z-50">
                <div className="text-[12px] font-[500] mb-2">LOCAL SIGNER KEYS</div>
                <div className="flex flex-col gap-2">
                  {multisig?.accountId && (
                    <div>
                      <div className="text-[9px] text-gray-400 mb-0.5">Account Address</div>
                      <div
                        className="text-[10px] bg-gray-50 px-2 py-1.5 rounded-sm cursor-pointer hover:bg-gray-100 break-all"
                        onClick={() => handleCopy(multisig.accountId, 'Account address')}
                        title="Click to copy"
                      >
                        {truncateHex(multisig.accountId, 12, 8)}
                      </div>
                    </div>
                  )}
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-0.5 text-[10px] rounded-sm ${
                        activeScheme === 'falcon' && walletSource === 'local' ? 'bg-[#FF5500] text-white' : 'bg-gray-100 text-gray-600'
                      }`}>
                        FALCON
                      </span>
                      {activeScheme === 'falcon' && walletSource === 'local' && (
                        <span className="text-[10px] text-gray-400">active</span>
                      )}
                    </div>
                    <div
                      className="text-[10px] bg-gray-50 px-2 py-1.5 rounded-sm cursor-pointer hover:bg-gray-100 break-all"
                      onClick={() => handleCopy(signer.falcon.commitment, 'Falcon commitment')}
                      title="Click to copy"
                    >
                      {truncateHex(signer.falcon.commitment, 12, 8)}
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-0.5 text-[10px] rounded-sm ${
                        activeScheme === 'ecdsa' && walletSource === 'local' ? 'bg-[#FF5500] text-white' : 'bg-gray-100 text-gray-600'
                      }`}>
                        ECDSA
                      </span>
                      {activeScheme === 'ecdsa' && walletSource === 'local' && (
                        <span className="text-[10px] text-gray-400">active</span>
                      )}
                    </div>
                    <div
                      className="text-[10px] bg-gray-50 px-2 py-1.5 rounded-sm cursor-pointer hover:bg-gray-100 break-all"
                      onClick={() => handleCopy(signer.ecdsa.commitment, 'ECDSA commitment')}
                      title="Click to copy"
                    >
                      {truncateHex(signer.ecdsa.commitment, 12, 8)}
                    </div>
                  </div>
                  <div className="text-[9px] text-gray-400">Click to copy</div>
                </div>
              </div>
            )}
          </div>
        ) : null}

        {/* Guardian Status */}
        <div className="relative" ref={guardianRef}>
          <button
            onClick={() => setGuardianPopoverOpen(!guardianPopoverOpen)}
            className={`px-3 py-1 rounded-sm text-[11px] font-[500] uppercase transition-colors ${
              guardianStatus === 'connected'
                ? 'bg-green-600 text-white hover:bg-green-700'
                : guardianStatus === 'connecting'
                  ? 'bg-yellow-500 text-white hover:bg-yellow-600'
                  : 'bg-red-500 text-white hover:bg-red-600'
            }`}
          >
            GUARDIAN {guardianStatus === 'connected' ? '●' : guardianStatus === 'connecting' ? '◐' : '○'}
          </button>
          {guardianPopoverOpen && (
            <div className="absolute right-0 top-full mt-1 w-[320px] bg-white border border-[#00000019] shadow-lg rounded-sm p-3 z-50">
              <div className="text-[12px] font-[500] mb-1">GUARDIAN CONFIGURATION</div>
              <div className="text-[10px] text-gray-500 mb-3">
                {guardianStatus === 'connected' ? 'Connected to Guardian server' :
                 guardianStatus === 'connecting' ? 'Connecting...' : 'Failed to connect'}
              </div>
              <div className="mb-2">
                <label className="text-[10px] text-gray-500 uppercase mb-1 block">Endpoint URL</label>
                <input
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="https://guardian-stg.openzeppelin.com"
                  className="w-full px-2 py-1.5 border border-[#00000019] rounded-sm text-[11px] focus:outline-hidden focus:border-[#FF5500]"
                />
              </div>
              <button
                onClick={handleGuardianSave}
                className="px-3 py-1.5 bg-[#FF5500] text-white text-[11px] rounded-sm hover:bg-[#E04A00] transition-colors"
              >
                SAVE & RECONNECT
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
