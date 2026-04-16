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
    <div className="border-b border-[rgba(0,0,0,0.06)] px-4 py-3 bg-white">
      <div className="flex items-center justify-between">
        {/* Left side - Account info — width matches sidebar */}
        <div className="w-[220px] flex items-center justify-center shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-[8px] bg-[#DFD8D3] flex items-center justify-center shrink-0">
            <span className="text-[13px] font-[600] text-[#FF5500]">
              {walletName.slice(0, 1).toUpperCase()}
            </span>
          </div>
          <div className="flex flex-col">
            <div className="text-[13px] text-[#111] font-[600]">
              {walletName}
            </div>
            <div className="flex items-center gap-1.5">
              <div
                className="text-[11px] text-[rgba(0,0,0,0.5)] font-[400] cursor-help"
                title={accountId || "No Account ID"}
              >
                {accountId ? truncateHex(accountId, 8, 6) : "No Account"}
              </div>
              <button
                onClick={copyAccountId}
                className="flex items-center justify-center w-4 h-4 hover:bg-[rgba(0,0,0,0.05)] rounded transition-colors"
                title="Copy account ID"
              >
                {isCopied ? (
                  <svg className="w-3 h-3 text-[rgba(46,161,80,1)]" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <svg className="w-3 h-3 text-[rgba(0,0,0,0.4)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>
        </div>

        {/* Center - PSM Status & Wallet Source */}
        <div className="flex items-center gap-3">
          {/* PSM Status Badge */}
          <div className="relative">
            <button
              onClick={() => { setShowPsmEditor(!showPsmEditor); setPsmUrlDraft(psmUrl); }}
              className={`flex items-center gap-1.5 h-8 px-3 rounded-full text-[11px] font-[500] transition-colors ${
                psmStatus === 'connected'
                  ? 'bg-[rgba(46,161,80,0.08)] text-[rgba(46,161,80,1)] hover:bg-[rgba(46,161,80,0.12)]'
                  : psmStatus === 'connecting'
                    ? 'bg-[rgba(234,179,8,0.08)] text-[rgba(180,140,0,1)] hover:bg-[rgba(234,179,8,0.12)]'
                    : 'bg-[rgba(220,38,38,0.08)] text-[rgba(220,38,38,1)] hover:bg-[rgba(220,38,38,0.12)]'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${
                psmStatus === 'connected' ? 'bg-[rgba(46,161,80,1)]' :
                psmStatus === 'connecting' ? 'bg-[rgba(234,179,8,1)] animate-pulse' : 'bg-[rgba(220,38,38,1)]'
              }`} />
              PSM {psmStatus}
            </button>

            {/* PSM Endpoint Editor Popover */}
            {showPsmEditor && (
              <div className="absolute top-full left-0 mt-1 z-50 bg-white border border-gray-200 rounded shadow-lg p-3 w-[320px]">
                <div className="text-[10px] font-[500] mb-1">PSM Endpoint</div>
                <input
                  type="text"
                  value={psmUrlDraft}
                  onChange={(e) => setPsmUrlDraft(e.target.value)}
                  className="w-full text-[11px] border border-gray-200 rounded px-2 py-1 mb-2 focus:outline-none focus:ring-1 focus:ring-[#FF5500]"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handlePsmReconnect}
                    className="flex-1 bg-[#FF5500] text-white text-[10px] px-2 py-1 rounded hover:bg-[#E04A00] transition-colors"
                  >
                    RECONNECT
                  </button>
                  <button
                    onClick={() => setShowPsmEditor(false)}
                    className="flex-1 border border-gray-200 text-[10px] px-2 py-1 rounded hover:bg-gray-50 transition-colors"
                  >
                    CANCEL
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Wallet Source Selector — segmented control */}
          <div className="flex items-center h-8 bg-[rgba(245,245,245,1)] rounded-[8px] p-0.5">
            <button
              onClick={() => setWalletSource('local')}
              className={`flex items-center px-3 h-full text-[11px] font-[500] rounded-[6px] transition-all ${
                walletSource === 'local'
                  ? 'bg-white text-[#FF5500] shadow-sm'
                  : 'text-[rgba(0,0,0,0.55)] hover:text-[#111]'
              }`}
            >
              Local
            </button>
            <button
              onClick={() => {
                if (paraSession.connected) {
                  setWalletSource('para');
                } else {
                  openParaModal();
                }
              }}
              className={`flex items-center px-3 h-full text-[11px] font-[500] rounded-[6px] transition-all ${
                walletSource === 'para'
                  ? 'bg-white text-[#FF5500] shadow-sm'
                  : 'text-[rgba(0,0,0,0.55)] hover:text-[#111]'
              }`}
            >
              Para{paraSession.connected ? ' ●' : ''}
            </button>
            <button
              onClick={() => {
                if (midenWalletSession.connected) {
                  setWalletSource('miden-wallet');
                } else {
                  connectMidenWallet();
                }
              }}
              className={`flex items-center px-3 h-full text-[11px] font-[500] rounded-[6px] transition-all ${
                walletSource === 'miden-wallet'
                  ? 'bg-white text-[#FF5500] shadow-sm'
                  : 'text-[rgba(0,0,0,0.55)] hover:text-[#111]'
              }`}
            >
              Wallet{midenWalletSession.connected ? ' ●' : ''}
            </button>
          </div>
        </div>

        {/* Right side - Signer Keys & Sync */}
        <div className="flex items-center gap-2">
          {/* Active Commitment Display */}
          <div className="relative">
            <button
              onClick={() => setShowSignerKeys(!showSignerKeys)}
              className="flex items-center gap-2 h-8 px-3 text-[11px] font-[500] bg-[rgba(245,245,245,1)] rounded-[8px] hover:bg-[rgba(235,235,235,1)] transition-colors"
              title={activeCommitment || "No commitment"}
            >
              <span className="text-[rgba(0,0,0,0.5)]">{activeScheme.toUpperCase()}</span>
              <span className="text-[#111]">{activeCommitment ? truncateHex(activeCommitment, 6, 4) : generatingSigner ? 'Generating...' : 'N/A'}</span>
            </button>

            {/* Signer Keys Popover */}
            {showSignerKeys && signer && (
              <div className="absolute top-full right-0 mt-1 z-50 bg-white border border-gray-200 rounded shadow-lg p-3 w-[360px]">
                <div className="text-[10px] font-[500] mb-2">Local Signer Keys</div>
                <div className="space-y-2">
                  <div>
                    <div className="text-[9px] text-gray-500">Falcon Commitment</div>
                    <div
                      className="text-[10px] bg-gray-50 p-1 rounded cursor-pointer hover:bg-gray-100 break-all"
                      onClick={() => copyToClipboard(signer.falcon.commitment, () => toast.success("Falcon commitment copied"))}
                      title="Click to copy"
                    >
                      {signer.falcon.commitment}
                    </div>
                  </div>
                  <div>
                    <div className="text-[9px] text-gray-500">ECDSA Commitment</div>
                    <div
                      className="text-[10px] bg-gray-50 p-1 rounded cursor-pointer hover:bg-gray-100 break-all"
                      onClick={() => copyToClipboard(signer.ecdsa.commitment, () => toast.success("ECDSA commitment copied"))}
                      title="Click to copy"
                    >
                      {signer.ecdsa.commitment}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setShowSignerKeys(false)}
                  className="mt-2 w-full text-[9px] border border-gray-200 rounded py-1 hover:bg-gray-50"
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
              className="flex items-center h-8 px-3 text-[11px] font-[500] text-[#111] bg-[rgba(245,245,245,1)] rounded-[8px] hover:bg-[rgba(235,235,235,1)] transition-colors disabled:opacity-50"
              title="Sync state"
            >
              {syncingState ? (
                <span className="flex items-center gap-1.5">
                  <span className="animate-spin rounded-full h-3 w-3 border border-gray-400 border-t-transparent" />
                  Syncing
                </span>
              ) : (
                "Sync"
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default TaskBar;
