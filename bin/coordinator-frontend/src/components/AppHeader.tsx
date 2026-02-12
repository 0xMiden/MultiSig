'use client';

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
    psmStatus,
    psmUrl,
    setPsmUrl,
    connectToPsm,
  } = useMultisig();

  const [psmPopoverOpen, setPsmPopoverOpen] = useState(false);
  const [walletPopoverOpen, setWalletPopoverOpen] = useState(false);
  const [keysPopoverOpen, setKeysPopoverOpen] = useState(false);
  const [urlInput, setUrlInput] = useState(psmUrl);

  const psmRef = useRef<HTMLDivElement>(null);
  const walletRef = useRef<HTMLDivElement>(null);
  const keysRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setUrlInput(psmUrl); }, [psmUrl]);

  // Close popovers on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (psmRef.current && !psmRef.current.contains(e.target as Node)) setPsmPopoverOpen(false);
      if (walletRef.current && !walletRef.current.contains(e.target as Node)) setWalletPopoverOpen(false);
      if (keysRef.current && !keysRef.current.contains(e.target as Node)) setKeysPopoverOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handlePsmSave = () => {
    setPsmUrl(urlInput);
    connectToPsm(urlInput);
    setPsmPopoverOpen(false);
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
            className={`px-3 py-1 border rounded text-[11px] font-[500] uppercase transition-colors ${
              (paraSession.connected || midenWalletSession.connected)
                ? 'border-[#FF5500] text-[#FF5500] hover:bg-[#FF5500]/5'
                : 'border-[#00000033] hover:border-[#FF5500]'
            }`}
          >
            {walletSource === 'local' && !paraSession.connected && !midenWalletSession.connected && 'LOCAL KEYS'}
            {walletSource === 'local' && paraSession.connected && 'LOCAL (PARA AVAIL)'}
            {walletSource === 'para' && 'PARA'}
            {walletSource === 'miden-wallet' && 'MIDEN WALLET'}
            {(walletSource === 'para' && paraSession.connected) || (walletSource === 'miden-wallet' && midenWalletSession.connected) ? ' \u25CF' : ''}
          </button>
          {walletPopoverOpen && (
            <div className="absolute right-0 top-full mt-1 w-[280px] bg-white border border-[#00000019] shadow-lg rounded p-3 z-50">
              <div className="text-[12px] font-[500] mb-2">WALLET SOURCE</div>
              <div className="flex flex-col gap-1.5">
                <button
                  onClick={() => { setWalletSource('local'); setWalletPopoverOpen(false); }}
                  className={`w-full text-left px-3 py-2 text-[11px] rounded border ${
                    walletSource === 'local' ? 'bg-[#FF5500] text-white border-[#FF5500]' : 'border-[#00000019] hover:border-[#FF5500]'
                  }`}
                >
                  LOCAL KEYS
                </button>

                {paraSession.connected ? (
                  <button
                    onClick={() => { setWalletSource('para'); setWalletPopoverOpen(false); }}
                    className={`w-full text-left px-3 py-2 text-[11px] rounded border ${
                      walletSource === 'para' ? 'bg-[#FF5500] text-white border-[#FF5500]' : 'border-[#00000019] hover:border-[#FF5500]'
                    }`}
                  >
                    PARA WALLET (connected)
                  </button>
                ) : (
                  <button
                    onClick={() => { openParaModal(); setWalletPopoverOpen(false); }}
                    className="w-full text-left px-3 py-2 text-[11px] rounded border border-[#00000019] hover:border-[#FF5500]"
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
                      className={`flex-1 text-left px-3 py-2 text-[11px] rounded border ${
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
                    className="w-full text-left px-3 py-2 text-[11px] rounded border border-[#00000019] hover:border-[#FF5500]"
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
              className="px-3 py-1 border border-[#00000033] rounded text-[11px] font-[500] uppercase hover:border-[#FF5500] transition-colors"
            >
              KEYS ({activeScheme})
            </button>
            {keysPopoverOpen && (
              <div className="absolute right-0 top-full mt-1 w-[300px] bg-white border border-[#00000019] shadow-lg rounded p-3 z-50">
                <div className="text-[12px] font-[500] mb-2">LOCAL SIGNER KEYS</div>
                <div className="flex flex-col gap-2">
                  {multisig?.accountId && (
                    <div>
                      <div className="text-[9px] text-gray-400 mb-0.5">Account Address</div>
                      <div
                        className="text-[10px] bg-gray-50 px-2 py-1.5 rounded cursor-pointer hover:bg-gray-100 break-all"
                        onClick={() => handleCopy(multisig.accountId, 'Account address')}
                        title="Click to copy"
                      >
                        {truncateHex(multisig.accountId, 12, 8)}
                      </div>
                    </div>
                  )}
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-0.5 text-[10px] rounded ${
                        activeScheme === 'falcon' && walletSource === 'local' ? 'bg-[#FF5500] text-white' : 'bg-gray-100 text-gray-600'
                      }`}>
                        FALCON
                      </span>
                      {activeScheme === 'falcon' && walletSource === 'local' && (
                        <span className="text-[10px] text-gray-400">active</span>
                      )}
                    </div>
                    <div
                      className="text-[10px] bg-gray-50 px-2 py-1.5 rounded cursor-pointer hover:bg-gray-100 break-all"
                      onClick={() => handleCopy(signer.falcon.commitment, 'Falcon commitment')}
                      title="Click to copy"
                    >
                      {truncateHex(signer.falcon.commitment, 12, 8)}
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-0.5 text-[10px] rounded ${
                        activeScheme === 'ecdsa' && walletSource === 'local' ? 'bg-[#FF5500] text-white' : 'bg-gray-100 text-gray-600'
                      }`}>
                        ECDSA
                      </span>
                      {activeScheme === 'ecdsa' && walletSource === 'local' && (
                        <span className="text-[10px] text-gray-400">active</span>
                      )}
                    </div>
                    <div
                      className="text-[10px] bg-gray-50 px-2 py-1.5 rounded cursor-pointer hover:bg-gray-100 break-all"
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

        {/* PSM Status */}
        <div className="relative" ref={psmRef}>
          <button
            onClick={() => setPsmPopoverOpen(!psmPopoverOpen)}
            className={`px-3 py-1 rounded text-[11px] font-[500] uppercase transition-colors ${
              psmStatus === 'connected'
                ? 'bg-green-600 text-white hover:bg-green-700'
                : psmStatus === 'connecting'
                  ? 'bg-yellow-500 text-white hover:bg-yellow-600'
                  : 'bg-red-500 text-white hover:bg-red-600'
            }`}
          >
            PSM {psmStatus === 'connected' ? '\u25CF' : psmStatus === 'connecting' ? '\u25D0' : '\u25CB'}
          </button>
          {psmPopoverOpen && (
            <div className="absolute right-0 top-full mt-1 w-[320px] bg-white border border-[#00000019] shadow-lg rounded p-3 z-50">
              <div className="text-[12px] font-[500] mb-1">PSM CONFIGURATION</div>
              <div className="text-[10px] text-gray-500 mb-3">
                {psmStatus === 'connected' ? 'Connected to PSM server' :
                 psmStatus === 'connecting' ? 'Connecting...' : 'Failed to connect'}
              </div>
              <div className="mb-2">
                <label className="text-[10px] text-gray-500 uppercase mb-1 block">Endpoint URL</label>
                <input
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="https://psm-stg.openzeppelin.com"
                  className="w-full px-2 py-1.5 border border-[#00000019] rounded text-[11px] focus:outline-none focus:border-[#FF5500]"
                />
              </div>
              <button
                onClick={handlePsmSave}
                className="px-3 py-1.5 bg-[#FF5500] text-white text-[11px] rounded hover:bg-[#E04A00] transition-colors"
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
