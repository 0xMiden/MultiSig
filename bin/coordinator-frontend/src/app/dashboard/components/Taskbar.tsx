"use client";
import React, { useState, useMemo } from "react";
import Image from "next/image";
import media from "../../../../public/media";
import { useMultisig } from "@/contexts/MultisigContext";
import { truncateHex, copyToClipboard } from "@/lib/helpers";
import { toast } from "sonner";
import { TaskBarProps } from "@/types";

const TaskBar: React.FC<TaskBarProps> = () => {
  const {
    psmUrl,
    setPsmUrl,
    psmStatus,
    connectToPsm,
    activeCommitment,
    activeScheme,
    walletSource,
    setWalletSource,
    signer,
    generatingSigner,
    syncingState,
    handleSync,
    multisig,
    paraSession,
    midenWalletSession,
    connectMidenWallet,
    disconnectMidenWallet,
    openParaModal,
  } = useMultisig();

  const [isCopied, setIsCopied] = useState(false);
  const [showPsmEditor, setShowPsmEditor] = useState(false);
  const [psmUrlDraft, setPsmUrlDraft] = useState(psmUrl);
  const [showSignerKeys, setShowSignerKeys] = useState(false);

  const walletName = useMemo(() => {
    if (typeof window === 'undefined') return "Multisig Wallet";
    const saved = localStorage.getItem("walletFormData");
    if (saved) {
      try { return JSON.parse(saved).walletName || "Multisig Wallet"; } catch { return "Multisig Wallet"; }
    }
    return "Multisig Wallet";
  }, []);

  const accountId = useMemo(() => {
    return multisig?.accountId ?? localStorage.getItem("currentWalletId") ?? null;
  }, [multisig]);

  const copyAccountId = () => {
    if (accountId) {
      copyToClipboard(accountId, () => {
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
      });
    }
  };

  const handlePsmReconnect = async () => {
    setPsmUrl(psmUrlDraft);
    await connectToPsm(psmUrlDraft);
    setShowPsmEditor(false);
    toast.success("Reconnected to PSM");
  };

  return (
    <div className="border-b-[0.5px] border-[#0000001A] p-2 bg-white">
      <div className="flex items-center justify-between">
        {/* Left side - Account info */}
        <div className="flex items-center">
          <Image src={media.greyBox} alt="greyBox" quality={100} />
          <div className="flex flex-col px-2">
            <div className="text-[10px] md:text-[13px] text-[#000000] font-[500] font-dmmono">
              {walletName}
            </div>
            <div className="flex items-center gap-2">
              <div
                className="text-[7px] md:text-[10px] text-[#000000] font-[500] font-dmmono cursor-help"
                title={accountId || "No Account ID"}
              >
                {accountId ? truncateHex(accountId, 8, 6) : "No Account"}
              </div>
              <button
                onClick={copyAccountId}
                className="flex items-center justify-center w-4 h-4 bg-gray-100 hover:bg-gray-200 rounded transition-colors duration-150"
                title="Copy account ID"
              >
                {isCopied ? (
                  <svg className="w-2.5 h-2.5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <svg className="w-2.5 h-2.5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Center - PSM Status & Wallet Source */}
        <div className="flex items-center gap-3">
          {/* PSM Status Badge */}
          <div className="relative">
            <button
              onClick={() => { setShowPsmEditor(!showPsmEditor); setPsmUrlDraft(psmUrl); }}
              className={`flex items-center gap-1.5 px-2 py-1 rounded text-[9px] font-dmmono font-[500] border transition-colors ${
                psmStatus === 'connected'
                  ? 'border-green-300 bg-green-50 text-green-700'
                  : psmStatus === 'connecting'
                    ? 'border-yellow-300 bg-yellow-50 text-yellow-700'
                    : 'border-red-300 bg-red-50 text-red-700'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${
                psmStatus === 'connected' ? 'bg-green-500' :
                psmStatus === 'connecting' ? 'bg-yellow-500 animate-pulse' : 'bg-red-500'
              }`} />
              PSM {psmStatus}
            </button>

            {/* PSM Endpoint Editor Popover */}
            {showPsmEditor && (
              <div className="absolute top-full left-0 mt-1 z-50 bg-white border border-gray-200 rounded shadow-lg p-3 w-[320px]">
                <div className="text-[10px] font-dmmono font-[500] mb-1 uppercase">PSM Endpoint</div>
                <input
                  type="text"
                  value={psmUrlDraft}
                  onChange={(e) => setPsmUrlDraft(e.target.value)}
                  className="w-full text-[11px] font-dmmono border border-gray-200 rounded px-2 py-1 mb-2 focus:outline-none focus:ring-1 focus:ring-[#FF5500]"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handlePsmReconnect}
                    className="flex-1 bg-[#FF5500] text-white text-[10px] font-dmmono px-2 py-1 rounded hover:bg-[#E04A00] transition-colors"
                  >
                    RECONNECT
                  </button>
                  <button
                    onClick={() => setShowPsmEditor(false)}
                    className="flex-1 border border-gray-200 text-[10px] font-dmmono px-2 py-1 rounded hover:bg-gray-50 transition-colors"
                  >
                    CANCEL
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Wallet Source Selector */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setWalletSource('local')}
              className={`px-2 py-1 text-[9px] font-dmmono font-[500] border rounded transition-colors ${
                walletSource === 'local' ? 'bg-[#FF5500] text-white border-[#FF5500]' : 'bg-white text-gray-600 border-gray-200 hover:border-[#FF5500]'
              }`}
            >
              LOCAL
            </button>
            <button
              onClick={() => {
                if (paraSession.connected) {
                  setWalletSource('para');
                } else {
                  openParaModal();
                }
              }}
              className={`px-2 py-1 text-[9px] font-dmmono font-[500] border rounded transition-colors ${
                walletSource === 'para' ? 'bg-[#FF5500] text-white border-[#FF5500]' : 'bg-white text-gray-600 border-gray-200 hover:border-[#FF5500]'
              }`}
            >
              PARA {paraSession.connected ? '(connected)' : ''}
            </button>
            <button
              onClick={() => {
                if (midenWalletSession.connected) {
                  setWalletSource('miden-wallet');
                } else {
                  connectMidenWallet();
                }
              }}
              className={`px-2 py-1 text-[9px] font-dmmono font-[500] border rounded transition-colors ${
                walletSource === 'miden-wallet' ? 'bg-[#FF5500] text-white border-[#FF5500]' : 'bg-white text-gray-600 border-gray-200 hover:border-[#FF5500]'
              }`}
            >
              WALLET {midenWalletSession.connected ? '(connected)' : ''}
            </button>
          </div>
        </div>

        {/* Right side - Signer Keys & Sync */}
        <div className="flex items-center gap-2 pr-2">
          {/* Active Commitment Display */}
          <div className="relative">
            <button
              onClick={() => setShowSignerKeys(!showSignerKeys)}
              className="flex items-center gap-1 px-2 py-1 text-[9px] font-dmmono font-[500] border border-gray-200 rounded hover:border-[#FF5500] transition-colors"
              title={activeCommitment || "No commitment"}
            >
              <span className="text-gray-500">{activeScheme.toUpperCase()}</span>
              <span>{activeCommitment ? truncateHex(activeCommitment, 6, 4) : generatingSigner ? 'Generating...' : 'N/A'}</span>
            </button>

            {/* Signer Keys Popover */}
            {showSignerKeys && signer && (
              <div className="absolute top-full right-0 mt-1 z-50 bg-white border border-gray-200 rounded shadow-lg p-3 w-[360px]">
                <div className="text-[10px] font-dmmono font-[500] mb-2 uppercase">Local Signer Keys</div>
                <div className="space-y-2">
                  <div>
                    <div className="text-[9px] font-dmmono text-gray-500 uppercase">Falcon Commitment</div>
                    <div
                      className="text-[10px] font-dmmono bg-gray-50 p-1 rounded cursor-pointer hover:bg-gray-100 break-all"
                      onClick={() => copyToClipboard(signer.falcon.commitment, () => toast.success("Falcon commitment copied"))}
                      title="Click to copy"
                    >
                      {signer.falcon.commitment}
                    </div>
                  </div>
                  <div>
                    <div className="text-[9px] font-dmmono text-gray-500 uppercase">ECDSA Commitment</div>
                    <div
                      className="text-[10px] font-dmmono bg-gray-50 p-1 rounded cursor-pointer hover:bg-gray-100 break-all"
                      onClick={() => copyToClipboard(signer.ecdsa.commitment, () => toast.success("ECDSA commitment copied"))}
                      title="Click to copy"
                    >
                      {signer.ecdsa.commitment}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setShowSignerKeys(false)}
                  className="mt-2 w-full text-[9px] font-dmmono border border-gray-200 rounded py-1 hover:bg-gray-50"
                >
                  CLOSE
                </button>
              </div>
            )}
          </div>

          {/* Sync Button */}
          {multisig && (
            <button
              onClick={handleSync}
              disabled={syncingState}
              className="px-2 py-1 text-[9px] font-dmmono font-[500] border border-gray-200 rounded hover:border-[#FF5500] hover:bg-[#FF5500]/5 transition-colors disabled:opacity-50"
              title="Sync state"
            >
              {syncingState ? (
                <span className="flex items-center gap-1">
                  <span className="animate-spin rounded-full h-2.5 w-2.5 border border-gray-400 border-t-transparent" />
                  SYNCING
                </span>
              ) : (
                "SYNC"
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default TaskBar;
