"use client";
import { LOCAL_KEYS_ENABLED } from "@/config/psm";
import React, { useState, useMemo } from "react";
import { useMultisig } from "@/contexts/MultisigContext";
import { truncateHex, copyToClipboard } from "@/lib/helpers";
import { SignerChip } from "@/components/SignerChip";
import { AccountId, AccountInterface, NetworkId } from "@miden-sdk/miden-sdk";
import { MIDEN_NETWORK } from "@/config/psm";
import { BECH32_PREFIX } from "@/lib/midenNetwork";

function bech32NetworkId(): NetworkId {
  switch (MIDEN_NETWORK) {
    case "mainnet": return NetworkId.mainnet();
    case "testnet": return NetworkId.testnet();
    case "devnet": return NetworkId.devnet();
    default: return NetworkId.custom(BECH32_PREFIX[MIDEN_NETWORK]);
  }
}
import { toast } from "sonner";
import { TaskBarProps } from "@/types";

const TaskBar: React.FC<TaskBarProps> = () => {
  const {
    guardianUrl,
    guardianStatus,
    connectToGuardian,
    activeCommitment,
    walletSource,
    setWalletSource,
    generatingSigner,
    syncingState,
    handleSync,
    multisig,
    paraSession,
    midenWalletSession,
    connectMidenWallet,
    openParaModal,
  } = useMultisig();

  const [isCopied, setIsCopied] = useState(false);
  const [isBech32Copied, setIsBech32Copied] = useState(false);
  const [showGuardianEditor, setShowGuardianEditor] = useState(false);
  const [guardianUrlDraft, setGuardianUrlDraft] = useState(guardianUrl);
  const [guardianEditorError, setGuardianEditorError] = useState<string | null>(null);
  const [guardianConnecting, setGuardianConnecting] = useState(false);

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

  const copyBech32 = () => {
    if (!accountId) return;
    try {
      const bech32 = AccountId.fromHex(accountId).toBech32(bech32NetworkId(), AccountInterface.BasicWallet);
      copyToClipboard(bech32, () => {
        setIsBech32Copied(true);
        setTimeout(() => setIsBech32Copied(false), 2000);
        toast.success("Bech32 address copied");
      });
    } catch {
      toast.error("Failed to convert account ID to bech32");
    }
  };

  const handleGuardianReconnect = async () => {
    setGuardianEditorError(null);
    setGuardianConnecting(true);
    // The URL is committed by connectToGuardian only once it is actually in use.
    const result = await connectToGuardian(guardianUrlDraft.trim());
    setGuardianConnecting(false);
    if (!result.ok) {
      setGuardianEditorError(result.error);
      toast.error("Guardian not changed");
      return;
    }
    setShowGuardianEditor(false);
    toast.success("Reconnected to Guardian");
  };

  return (
    <div className="border-b border-[rgba(0,0,0,0.06)] px-4 py-3 bg-white font-dmmono">
      <div className="flex items-center justify-between">
        {/* Left — account info, width matches sidebar */}
        <div className="w-[220px] flex items-center shrink-0">
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
              <div className="flex items-center gap-2">
                <div
                  className="text-[11px] text-[rgba(0,0,0,0.5)] font-[400] cursor-help"
                  title={accountId || "No Account ID"}
                >
                  {accountId ? truncateHex(accountId, 8, 6) : "No Account"}
                </div>
                <button
                  onClick={copyAccountId}
                  className="flex items-center justify-center w-4 h-4 bg-gray-100 hover:bg-gray-200 rounded-sm transition-colors duration-150"
                  title="Copy hex account ID"
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
                <button
                  onClick={copyBech32}
                  disabled={!accountId}
                  className="flex items-center justify-center px-1 h-4 bg-gray-100 hover:bg-gray-200 rounded-sm transition-colors duration-150 text-[7px] font-[500] disabled:opacity-40 disabled:cursor-not-allowed"
                  title="Copy bech32 address"
                >
                  {isBech32Copied ? (
                    <svg className="w-2.5 h-2.5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <span className="text-gray-600">B32</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Center — guardian status + wallet source */}
        <div className="flex items-center gap-3">
          {/* Guardian Status Badge */}
          <div className="relative">
            <button
              onClick={() => { setShowGuardianEditor(!showGuardianEditor); setGuardianUrlDraft(guardianUrl); setGuardianEditorError(null); }}
              className={`flex items-center gap-1.5 h-8 px-3 rounded-[8px] text-[11px] font-[500] transition-colors ${
                guardianStatus === 'connected'
                  ? 'bg-[rgba(46,161,80,0.08)] text-[rgba(46,161,80,1)] hover:bg-[rgba(46,161,80,0.12)]'
                  : guardianStatus === 'connecting'
                    ? 'bg-[rgba(234,179,8,0.08)] text-[rgba(180,140,0,1)] hover:bg-[rgba(234,179,8,0.12)]'
                    : 'bg-[rgba(220,38,38,0.08)] text-[rgba(220,38,38,1)] hover:bg-[rgba(220,38,38,0.12)]'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${
                guardianStatus === 'connected' ? 'bg-green-500' :
                guardianStatus === 'connecting' ? 'bg-yellow-500 animate-pulse' : 'bg-red-500'
              }`} />
              GUARDIAN {guardianStatus}
            </button>

            {showGuardianEditor && (
              <div className="absolute top-full left-0 mt-1 z-50 bg-white border border-gray-200 rounded-[8px] shadow-lg p-3 w-[320px]">
                <div className="text-[10px] font-[500] mb-1">Guardian Endpoint</div>
                <input
                  type="text"
                  value={guardianUrlDraft}
                  onChange={(e) => setGuardianUrlDraft(e.target.value)}
                  className="w-full text-[11px] border border-gray-200 rounded-sm px-2 py-1 mb-2 focus:outline-hidden focus:ring-1 focus:ring-[#FF5500]"
                />
                {guardianEditorError && (
                  <p role="alert" className="text-[10px] text-red-600 mb-2 wrap-break-word">{guardianEditorError}</p>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={handleGuardianReconnect}
                    disabled={guardianConnecting}
                    className="flex-1 bg-[#FF5500] text-white text-[10px] px-2 py-1 rounded-sm hover:bg-[#E04A00] transition-colors disabled:opacity-60"
                  >
                    {guardianConnecting ? "CONNECTING…" : "RECONNECT"}
                  </button>
                  <button
                    onClick={() => setShowGuardianEditor(false)}
                    className="flex-1 border border-gray-200 text-[10px] px-2 py-1 rounded-sm hover:bg-gray-50 transition-colors"
                  >
                    CANCEL
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Wallet Source Segmented Control */}
          <div className="flex items-center h-8 bg-[rgba(245,245,245,1)] rounded-[8px] p-0.5">
            {LOCAL_KEYS_ENABLED && (
              <button
                onClick={() => setWalletSource('local')}
                className={`flex items-center px-3 h-full text-[11px] font-[500] rounded-[6px] transition-all ${
                  walletSource === 'local'
                    ? 'bg-white text-[#FF5500] shadow-xs'
                    : 'text-[rgba(0,0,0,0.55)] hover:text-[#111]'
                }`}
              >
                Local
              </button>
            )}
            <button
              onClick={() => {
                if (paraSession.connected) setWalletSource('para');
                else openParaModal();
              }}
              className={`flex items-center px-3 h-full text-[11px] font-[500] rounded-[6px] transition-all ${
                walletSource === 'para'
                  ? 'bg-white text-[#FF5500] shadow-xs'
                  : 'text-[rgba(0,0,0,0.55)] hover:text-[#111]'
              }`}
            >
              Para {paraSession.connected ? '(connected)' : ''}
            </button>
            <button
              onClick={() => {
                if (midenWalletSession.connected) setWalletSource('miden-wallet');
                else connectMidenWallet();
              }}
              className={`flex items-center px-3 h-full text-[11px] font-[500] rounded-[6px] transition-all ${
                walletSource === 'miden-wallet'
                  ? 'bg-white text-[#FF5500] shadow-xs'
                  : 'text-[rgba(0,0,0,0.55)] hover:text-[#111]'
              }`}
            >
              Wallet {midenWalletSession.connected ? '(connected)' : ''}
            </button>
          </div>
        </div>

        {/* Right — sync + who am I */}
        <div className="flex items-center gap-2">
          {multisig && (
            <button
              onClick={handleSync}
              disabled={syncingState}
              className="flex items-center h-8 px-3 text-[11px] font-[500] text-[#111] bg-[rgba(245,245,245,1)] rounded-[8px] hover:bg-[rgba(235,235,235,1)] transition-colors disabled:opacity-50"
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

          {/* Who am I: the connected signer's public key commitment, one click to copy. */}
          {activeCommitment ? (
            <SignerChip />
          ) : (
            <span className="flex items-center h-8 px-3 text-[11px] font-[500] rounded-[8px] bg-[rgba(245,245,245,1)] text-[rgba(0,0,0,0.5)]">
              {generatingSigner ? "Generating…" : "Not connected"}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default TaskBar;
