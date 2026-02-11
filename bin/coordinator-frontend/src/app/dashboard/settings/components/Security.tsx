import React from "react";
import { useMultisig } from "@/contexts/MultisigContext";
import { copyToClipboard, truncateHex } from "@/lib/helpers";
import { toast } from "sonner";

const Security = () => {
  const {
    walletSource,
    setWalletSource,
    activeCommitment,
    activeScheme,
    signer,
    paraSession,
    midenWalletSession,
    connectMidenWallet,
    disconnectMidenWallet,
    openParaModal,
    psmUrl,
    psmStatus,
  } = useMultisig();

  const handleCopy = (text: string) => {
    copyToClipboard(text, () => toast.success("Copied!"));
  };

  return (
    <div className="w-full h-full">
      <div className="space-y-6">
        {/* Wallet Source Section */}
        <div className="border border-gray-200 rounded-lg p-6">
          <h3 className="text-[16px] font-dmmono font-[500] mb-4">WALLET SOURCE</h3>
          <div className="flex gap-3 mb-4">
            <button
              onClick={() => setWalletSource('local')}
              className={`px-4 py-2 font-dmmono text-[12px] border rounded ${
                walletSource === 'local' ? 'bg-[#FF5500] text-white border-[#FF5500]' : 'border-gray-200 hover:border-[#FF5500]'
              }`}
            >
              LOCAL KEYS
            </button>
            <button
              onClick={() => {
                if (paraSession.connected) setWalletSource('para');
                else openParaModal();
              }}
              className={`px-4 py-2 font-dmmono text-[12px] border rounded ${
                walletSource === 'para' ? 'bg-[#FF5500] text-white border-[#FF5500]' : 'border-gray-200 hover:border-[#FF5500]'
              }`}
            >
              PARA WALLET {paraSession.connected ? '(connected)' : ''}
            </button>
            <button
              onClick={() => {
                if (midenWalletSession.connected) setWalletSource('miden-wallet');
                else connectMidenWallet();
              }}
              className={`px-4 py-2 font-dmmono text-[12px] border rounded ${
                walletSource === 'miden-wallet' ? 'bg-[#FF5500] text-white border-[#FF5500]' : 'border-gray-200 hover:border-[#FF5500]'
              }`}
            >
              MIDEN WALLET {midenWalletSession.connected ? '(connected)' : ''}
            </button>
          </div>

          {/* Active Commitment */}
          <div className="bg-gray-50 p-3 rounded">
            <div className="text-[10px] font-dmmono text-gray-500 uppercase mb-1">Active Commitment ({activeScheme})</div>
            <div
              className="text-[11px] font-dmmono cursor-pointer hover:bg-gray-100 p-1 rounded break-all"
              onClick={() => activeCommitment && handleCopy(activeCommitment)}
              title="Click to copy"
            >
              {activeCommitment || "N/A"}
            </div>
          </div>

          {/* Disconnect Miden Wallet */}
          {midenWalletSession.connected && walletSource === 'miden-wallet' && (
            <button
              onClick={disconnectMidenWallet}
              className="mt-3 px-4 py-2 font-dmmono text-[12px] border border-red-300 text-red-600 rounded hover:bg-red-50"
            >
              DISCONNECT MIDEN WALLET
            </button>
          )}
        </div>

        {/* Local Signer Keys Section */}
        {signer && (
          <div className="border border-gray-200 rounded-lg p-6">
            <h3 className="text-[16px] font-dmmono font-[500] mb-4">LOCAL SIGNER KEYS</h3>
            <div className="space-y-3">
              <div className="bg-gray-50 p-3 rounded">
                <div className="text-[10px] font-dmmono text-gray-500 uppercase mb-1">Falcon Commitment</div>
                <div
                  className="text-[11px] font-dmmono cursor-pointer hover:bg-gray-100 p-1 rounded break-all"
                  onClick={() => handleCopy(signer.falcon.commitment)}
                  title="Click to copy"
                >
                  {signer.falcon.commitment}
                </div>
              </div>
              <div className="bg-gray-50 p-3 rounded">
                <div className="text-[10px] font-dmmono text-gray-500 uppercase mb-1">ECDSA Commitment</div>
                <div
                  className="text-[11px] font-dmmono cursor-pointer hover:bg-gray-100 p-1 rounded break-all"
                  onClick={() => handleCopy(signer.ecdsa.commitment)}
                  title="Click to copy"
                >
                  {signer.ecdsa.commitment}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* PSM Connection */}
        <div className="border border-gray-200 rounded-lg p-6">
          <h3 className="text-[16px] font-dmmono font-[500] mb-4">PSM CONNECTION</h3>
          <div className="flex items-center gap-2 mb-2">
            <span className={`w-2 h-2 rounded-full ${
              psmStatus === 'connected' ? 'bg-green-500' :
              psmStatus === 'connecting' ? 'bg-yellow-500 animate-pulse' : 'bg-red-500'
            }`} />
            <span className="text-[12px] font-dmmono">{psmStatus}</span>
          </div>
          <div className="text-[11px] font-dmmono text-gray-500 break-all">{psmUrl}</div>
        </div>
      </div>
    </div>
  );
};

export default Security;
