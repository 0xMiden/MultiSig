'use client'

import React, { useEffect, useState } from 'react'
import Image from 'next/image'
import Svg from "../../../public/svg/index.js";
import { AnimatePresence, motion } from 'framer-motion';

import { useRouter } from "next/navigation";
import { useWalletForm } from '../../hooks/useWalletForm';
import { useMultisig } from '@/contexts/MultisigContext';
// Force dynamic rendering to avoid WASM loading issues during build
export const dynamic = 'force-dynamic';

const MIDEN_WALLET_URL = 'https://chromewebstore.google.com/detail/miden-wallet/ablmompanofnodfdkgchkpmphailefpb?hl=en';

const Page = () => {
  const router = useRouter()
  const { reset } = useWalletForm()
  const { walletSource } = useMultisig()
  const [showInstallModal, setShowInstallModal] = useState(false)

  useEffect(() => {
    reset()
    localStorage.removeItem('walletFormData')
    localStorage.removeItem('walletCurrentStep')
  }, [reset])

  useEffect(() => {
    if (walletSource !== 'miden-wallet') { setShowInstallModal(false); return; }
    // Give the extension time to inject itself into window
    const timer = setTimeout(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const w = window as any
      const installed = !!(w.midenWallet || w.miden)
      if (!installed) setShowInstallModal(true)
    }, 500)
    return () => clearTimeout(timer)
  }, [walletSource])

  return (
    <div className="w-full h-screen">
      <AnimatePresence>
        {showInstallModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          >
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 16 }}
              className="bg-white border border-[rgba(0,0,0,0.19)] p-8 w-[90%] max-w-[420px] flex flex-col space-y-5 rounded-[12px]"
            >
              <div className="flex items-center space-x-3">
                <div className="relative w-[28px] h-[28px] shrink-0">
                  <Image src={Svg.logo} alt="logo" fill objectFit="contain" />
                </div>
                <div className="font-geist text-[16px] font-[600] text-[#111]">
                  Miden Wallet Not Detected
                </div>
              </div>
              <p className="text-[13px] font-geist text-[rgba(0,0,0,0.6)] leading-relaxed">
                It looks like you haven&apos;t installed the Miden Wallet browser extension.
                Install it to use Miden Wallet, or choose Ledger or Para from the wallet menu. Accounts can only be
                created or loaded with a connected wallet.
              </p>
              <div className="flex flex-col space-y-2">
                <a
                  href={MIDEN_WALLET_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="h-[44px] w-full flex items-center justify-center bg-[#FF5500] text-white font-geist text-[14px] font-[500] rounded-[8px] hover:bg-[#e04a00] transition-colors"
                >
                  Download Miden Wallet
                </a>
                <button
                  onClick={() => setShowInstallModal(false)}
                  className="h-[44px] w-full flex items-center justify-center border border-[rgba(0,0,0,0.12)] font-geist text-[14px] text-[rgba(0,0,0,0.6)] rounded-[8px] hover:bg-[rgba(0,0,0,0.03)] transition-colors cursor-pointer"
                >
                  Choose another wallet
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="relative w-full md:w-[90%] lg:w-[70%] mx-auto h-full flex flex-col space-y-6 sm:space-y-8 md:space-y-12 py-4 sm:py-6 md:py-10">
        {/* Header Section */}
        <div className="flex flex-col w-full items-center space-y-1">
          <div>
            <div className="relative w-[38px] h-[38px]">
              <Image src={Svg.logo} alt="logo" fill objectFit="contain" />
            </div>
          </div>
          <div className="text-[24px] md:text-[36px] px-4 font-[500] tracking-[-0.02em]">
            Multi-Signature Account
          </div>
          <div className="text-[13px] md:text-[15px] text-[rgba(255,85,0,1)] px-4 tracking-[-0.02em]">
            Secure, Enterprise-Grade Multi-Signature Account Management
          </div>
        </div>

        {/* Two Cards */}
        <div className="flex flex-col md:flex-row space-y-2 md:space-y-0 md:space-x-4 items-center md:items-stretch md:justify-center w-full">
          {/* Create New Account */}
          <div className="md:w-1/2 w-[90%] relative flex flex-col border border-[rgba(0,0,0,0.12)] rounded-[10px] p-[28px] md:p-[36px] gap-0">
            <div className="w-[36px] h-[36px] rounded-[8px] bg-[rgba(255,85,0,0.08)] flex items-center justify-center mb-3">
              <div className="text-[rgba(255,85,0,1)] text-[20px] font-[300]">+</div>
            </div>
            <div className="text-[18px] md:text-[22px] font-[600] tracking-[-0.02em] text-[#111]">
              Create New Account
            </div>
            <div className="text-[13px] md:text-[14px] font-[400] text-[#000] leading-relaxed mt-2 mb-6 bg-[#f9f9f9] px-3 py-1.5 rounded-[4px]">
              Create a new multisig account with a custom signature threshold
            </div>

            <div className="flex flex-col gap-[14px] flex-1">
              {[
                "Choose account name and configure signature threshold (e.g., 2-of-3)",
                "Add signer addresses",
                "Deploy multisig account smart contract on Miden network",
                "Share account address with other signers",
              ].map((step, i) => (
                <div key={i} className="flex flex-row w-full items-start space-x-3">
                  <span className="shrink-0 mt-[2px] rounded-full w-[20px] h-[20px] bg-[rgba(255,85,0,1)] text-white flex items-center justify-center text-[10px] font-[500]">
                    {i + 1}
                  </span>
                  <div className="text-[14px] font-[400] text-[#333] leading-[1.5]">{step}</div>
                </div>
              ))}
            </div>

            <button
              onClick={() => router.push("/login/createNewAccount")}
              className="group mt-8 h-[56px] w-full flex flex-row items-center justify-center gap-2 border border-[rgba(0,0,0,0.12)] rounded-[8px] bg-white hover:bg-[#FF5500] transition-colors cursor-pointer"
            >
              <div className="text-[rgba(255,85,0,1)] group-hover:text-white text-[15px] font-[300] transition-colors">+</div>
              <div className="text-[rgba(255,85,0,1)] group-hover:text-white text-[13px] md:text-[14px] font-[500] transition-colors">
                Create Account
              </div>
            </button>
          </div>

          {/* Load Existing Account */}
          <div className="md:w-1/2 w-[90%] relative flex flex-col border border-[rgba(0,0,0,0.12)] rounded-[10px] p-[28px] md:p-[36px] gap-0">
            <div className="w-[36px] h-[36px] rounded-[8px] bg-[rgba(255,85,0,0.08)] flex items-center justify-center mb-3">
              <div className="relative w-[18px] h-[18px]">
                <Image src={Svg.upload} alt="upload" fill objectFit="contain" />
              </div>
            </div>
            <div className="text-[18px] md:text-[22px] font-[600] tracking-[-0.02em] text-[#111]">
              Load Existing Account
            </div>
            <div className="text-[13px] md:text-[14px] font-[400] text-[#000] leading-relaxed mt-2 mb-6 bg-[#f9f9f9] px-3 py-1.5 rounded-[4px]">
              Load an existing multisig account by entering its address
            </div>

            <div className="flex flex-col gap-[14px] flex-1">
              {[
                "Enter existing multisig account address",
                "Connect your wallet",
                "Verify you’re authorized as a signer to sign transactions",
                "Access account dashboard and transaction history",
              ].map((step, i) => (
                <div key={i} className="flex flex-row w-full items-start space-x-3">
                  <span className="shrink-0 mt-[2px] rounded-full w-[20px] h-[20px] bg-[rgba(255,85,0,1)] text-white flex items-center justify-center text-[10px] font-[500]">
                    {i + 1}
                  </span>
                  <div className="text-[14px] font-[400] text-[#333] leading-[1.5]">{step}</div>
                </div>
              ))}
            </div>

            <button
              onClick={() => router.push("/login/loadExistingAccount")}
              className="group mt-8 h-[56px] w-full flex flex-row items-center justify-center gap-2 border border-[rgba(0,0,0,0.12)] rounded-[8px] bg-white hover:bg-[#FF5500] transition-colors cursor-pointer"
            >
              <div className="relative w-[16px] h-[16px] shrink-0">
                <Image src={Svg.upload_black} alt="upload" fill objectFit="contain" />
              </div>
              <div className="text-[rgba(255,85,0,1)] group-hover:text-white text-[13px] md:text-[14px] font-[500] transition-colors">
                Load Existing Account
              </div>
            </button>
          </div>
        </div>

        <div className="text-center text-[13px] md:text-[14px] uppercase font-[400] text-[rgba(0,0,0,0.5)] pb-[20px] md:pb-0">
          POWERED BY INICIO LABS & MIDEN
        </div>

        {/* Footer */}
        <div className="flex md:h-[60px] w-full flex-row items-center justify-between px-6 mt-auto pb-2 md:pb-0">
          <a
            href="https://miden.xyz"
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-row space-x-1 items-center cursor-pointer hover:opacity-80 transition-opacity"
          >
            <div className="relative w-[13px] h-[13px]">
              <Image src={Svg.logo} alt="logo" fill objectFit="contain" />
            </div>
            <div className="text-[13px] md:text-[15px] font-[500] tracking-[-3%] uppercase">
              miden
            </div>
          </a>

          <div className="flex flex-row items-center space-x-4">
            <a href="https://x.com/0xMiden" target="_blank" rel="noopener noreferrer" className="relative w-[14px] h-[14px] cursor-pointer hover:opacity-80 transition-opacity">
              <Image src={Svg.X} alt="X" fill objectFit="contain" />
            </a>
            <a href="https://t.me/BuildOnMiden" target="_blank" rel="noopener noreferrer" className="relative w-[14px] h-[14px] cursor-pointer hover:opacity-80 transition-opacity">
              <Image src={Svg.tgIcon} alt="tg" fill objectFit="contain" />
            </a>
            <a href="https://github.com/0xMiden/MultiSig" target="_blank" rel="noopener noreferrer" className="relative w-[14px] h-[14px] cursor-pointer hover:opacity-80 transition-opacity">
              <Image src={Svg.githubIcon} alt="github" fill objectFit="contain" />
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Page
