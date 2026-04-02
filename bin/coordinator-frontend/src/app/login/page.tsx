'use client'

import React, { useEffect } from 'react'
import Image from 'next/image'
import Svg from "../../../public/svg/index.js";

import { useRouter } from "next/navigation";
import { useWalletForm } from '../../hooks/useWalletForm';

// Force dynamic rendering to avoid WASM loading issues during build
export const dynamic = 'force-dynamic';

const Page = () => {
  const router = useRouter()
  const { reset } = useWalletForm()

  useEffect(() => {
    reset()
    localStorage.removeItem('walletFormData')
    localStorage.removeItem('walletCurrentStep')
  }, [reset])

  return (
    <div className="w-full h-screen">
      <div className="relative w-full md:w-[90%] lg:w-[70%] mx-auto h-full flex flex-col space-y-6 sm:space-y-8 md:space-y-12 py-4 sm:py-6 md:py-10">
        {/* Header Section */}
        <div className="flex flex-col w-full items-center space-y-1">
          <div>
            <div className="relative w-[38px] h-[38px]">
              <Image src={Svg.logo} alt="logo" fill objectFit="contain" />
            </div>
          </div>
          <div className="text-[24px] md:text-[36px] px-4 font-[500] font-geist tracking-[-0.02em]">
            Multi-Signature Account
          </div>
          <div className="text-[13px] md:text-[15px] text-[rgba(255,85,0,1)] px-4 tracking-[-0.02em] font-geist">
            Secure, Enterprise-Grade Multi-Signature Account Management
          </div>
        </div>

        {/* Two Cards */}
        <div className="flex flex-col md:flex-row space-y-2 md:space-y-0 md:space-x-4 items-center   md:items-stretch md:justify-center w-full">
          {/* CREATE NEW ACCOUNT */}
          <div className="md:w-1/2 w-[90%] relative flex flex-col border border-[rgba(0,0,0,0.12)] rounded-[10px] p-[28px] md:p-[36px] gap-0">
            <div className="w-[36px] h-[36px] rounded-[8px] bg-[rgba(255,85,0,0.08)] flex items-center justify-center mb-3">
              <div className="text-[rgba(255,85,0,1)] text-[20px] font-[300]">
                +
              </div>
            </div>
            <div className="text-[18px] md:text-[22px] font-geist font-[600] tracking-[-0.02em] text-[#111]">
              Create New Account
            </div>
            <div className="text-[13px] md:text-[14px] font-[400] text-[#000] leading-relaxed mt-2 mb-6 bg-[#f9f9f9] px-3 py-1.5 rounded-[4px]">
              Create a new multisig account with a custom signature threshold
            </div>

            <div className="flex flex-col gap-[14px] flex-1">
              <div className="flex flex-row w-full items-start space-x-3">
                <span className="shrink-0 mt-[2px] rounded-full w-[20px] h-[20px] bg-[rgba(255,85,0,1)] text-white flex items-center justify-center text-[10px] font-[500]">
                  1
                </span>
                <div className="text-[14px] font-geist font-[400] text-[#333] leading-[1.5]">
                  Choose account name and configure signature threshold (e.g., 2-of-3)
                </div>
              </div>

              <div className="flex flex-row w-full items-start space-x-3">
                <span className="shrink-0 mt-[2px] rounded-full w-[20px] h-[20px] bg-[rgba(255,85,0,1)] text-white flex items-center justify-center text-[10px] font-[500]">
                  2
                </span>
                <div className="text-[14px] font-geist font-[400] text-[#333] leading-[1.5]">
                  Add signer addresses
                </div>
              </div>

              <div className="flex flex-row w-full items-start space-x-3">
                <span className="shrink-0 mt-[2px] rounded-full w-[20px] h-[20px] bg-[rgba(255,85,0,1)] text-white flex items-center justify-center text-[10px] font-[500]">
                  3
                </span>
                <div className="text-[14px] font-geist font-[400] text-[#333] leading-[1.5]">
                  Deploy multisig account smart contract on Miden network
                </div>
              </div>

              <div className="flex flex-row w-full items-start space-x-3">
                <span className="shrink-0 mt-[2px] rounded-full w-[20px] h-[20px] bg-[rgba(255,85,0,1)] text-white flex items-center justify-center text-[10px] font-[500]">
                  4
                </span>
                <div className="text-[14px] font-geist font-[400] text-[#333] leading-[1.5]">
                  Share account address with other signers
                </div>
              </div>
            </div>

            <button onClick={() => router.push("/login/createNewAccount")} className="group mt-8 h-[44px] w-full flex flex-row items-center justify-center gap-2 border border-[rgba(0,0,0,0.12)] rounded-[8px] bg-white hover:bg-[#FF5500] transition-colors cursor-pointer">
              <div className="text-[rgba(255,85,0,1)] group-hover:text-white text-[15px] font-[300] transition-colors">+</div>
              <div className="font-geist text-[rgba(255,85,0,1)] group-hover:text-white text-[13px] md:text-[14px] font-[500] transition-colors">
                Create Account
              </div>
            </button>
          </div>

          {/* LOAD EXISTING ACCOUNT */}
          <div className="md:w-1/2 w-[90%] relative flex flex-col border border-[rgba(0,0,0,0.12)] rounded-[10px] p-[28px] md:p-[36px] gap-0">
            <div className="w-[36px] h-[36px] rounded-[8px] bg-[rgba(255,85,0,0.08)] flex items-center justify-center mb-3">
              <div className="relative w-[18px] h-[18px]">
                <Image src={Svg.upload} alt="upload" fill objectFit="contain" />
              </div>
            </div>
            <div className="text-[18px] md:text-[22px] font-geist font-[600] tracking-[-0.02em] text-[#111]">
              Load Existing Account
            </div>
            <div className="text-[13px] md:text-[14px] font-[400] text-[#000] leading-relaxed mt-2 mb-6 bg-[#f9f9f9] px-3 py-1.5 rounded-[4px]">
              Load an existing multisig account by entering its address
            </div>

            <div className="flex flex-col gap-[14px] flex-1">
              <div className="flex flex-row w-full items-start space-x-3">
                <span className="shrink-0 mt-[2px] rounded-full w-[20px] h-[20px] bg-[rgba(255,85,0,1)] text-white flex items-center justify-center text-[10px] font-[500]">
                  1
                </span>
                <div className="text-[14px] font-geist font-[400] text-[#333] leading-[1.5]">
                  Enter existing multisig account address
                </div>
              </div>

              <div className="flex flex-row w-full items-start space-x-3">
                <span className="shrink-0 mt-[2px] rounded-full w-[20px] h-[20px] bg-[rgba(255,85,0,1)] text-white flex items-center justify-center text-[10px] font-[500]">
                  2
                </span>
                <div className="text-[14px] font-geist font-[400] text-[#333] leading-[1.5]">
                  Connect your wallet
                </div>
              </div>

              <div className="flex flex-row w-full items-start space-x-3">
                <span className="shrink-0 mt-[2px] rounded-full w-[20px] h-[20px] bg-[rgba(255,85,0,1)] text-white flex items-center justify-center text-[10px] font-[500]">
                  3
                </span>
                <div className="text-[14px] font-geist font-[400] text-[#333] leading-[1.5]">
                  Verify you&apos;re authorized as a signer to sign transactions
                </div>
              </div>

              <div className="flex flex-row w-full items-start space-x-3">
                <span className="shrink-0 mt-[2px] rounded-full w-[20px] h-[20px] bg-[rgba(255,85,0,1)] text-white flex items-center justify-center text-[10px] font-[500]">
                  4
                </span>
                <div className="text-[14px] font-geist font-[400] text-[#333] leading-[1.5]">
                  Access account dashboard and transaction history
                </div>
              </div>
            </div>

            <button onClick={() => router.push("/login/loadExistingAccount")} className="group mt-8 h-[44px] w-full flex flex-row items-center justify-center gap-2 border border-[rgba(0,0,0,0.12)] rounded-[8px] bg-white hover:bg-[#FF5500] transition-colors cursor-pointer">
              <div className="relative w-[16px] h-[16px]">
                <Image
                  src={Svg.upload_black}
                  alt="upload"
                  fill
                  objectFit="contain"
                />
              </div>
              <div className="font-geist text-[rgba(255,85,0,1)] group-hover:text-white text-[13px] md:text-[14px] font-[500] transition-colors">
                Load Existing Account
              </div>
            </button>
          </div>
        </div>
        <div className="text-center text-[13px] md:text-[14px] uppercase font-[400] font-geist text-[rgba(0,0,0,0.5)] pb-[20px] md:pb-0">
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
            <div className="font-geist text-[13px] md:text-[15px] font-[500] tracking-[-3%] uppercase">
              miden
            </div>
          </a>

          <div className="flex flex-row items-center space-x-4">
            <a
              href="https://x.com/0xMiden"
              target="_blank"
              rel="noopener noreferrer"
              className="relative w-[14px] h-[14px] cursor-pointer hover:opacity-80 transition-opacity"
            >
              <Image src={Svg.X} alt="X" fill objectFit="contain" />
            </a>
            <a
              href="https://t.me/BuildOnMiden"
              target="_blank"
              rel="noopener noreferrer"
              className="relative w-[14px] h-[14px] cursor-pointer hover:opacity-80 transition-opacity"
            >
              <Image src={Svg.tgIcon} alt="tg" fill objectFit="contain" />
            </a>
            <a
              href="https://github.com/0xMiden/MultiSig"
              target="_blank"
              rel="noopener noreferrer"
              className="relative w-[14px] h-[14px] cursor-pointer hover:opacity-80 transition-opacity"
            >
              <Image src={Svg.githubIcon} alt="github" fill objectFit="contain" />
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Page
