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
    <div className="w-full h-screen ">
      <div className="relative w-full md:w-[90%] lg:w-[70%] mx-auto h-full flex flex-col space-y-4 sm:space-y-6 md:space-y-12 py-2 sm:py-5 md:py-10">
        {/* Header Section */}
        <div className="flex flex-col w-full items-center space-y-2">
          <div>
            <div className="relative w-[38px] h-[38px]">
              <Image src={Svg.logo} alt="logo" fill objectFit="contain" />
            </div>
          </div>
          <div className="uppercase text-[22px] md:text-[36px] px-4 font-[500] font-dmmono tracking-[-2%]">
            MULTI-SIGNATURE ACCOUNT
          </div>
          <div className="text-[12px] md:text-[16px] text-[rgba(255,85,0,1)] px-4 uppercase tracking-[-2%] font-dmmono">
            SECURE, ENTERPRISE-GRADE MULTI-SIGNATURE ACCOUNT MANAGEMENT
          </div>
        </div>

        {/* Two Cards */}
        <div className="flex flex-col md:flex-row space-y-2 md:space-y-0 md:space-x-4 items-center   md:items-stretch md:justify-center w-full">
          {/* CREATE NEW ACCOUNT */}
          <div className="md:w-1/2 w-[90%] lg:max-h-[460px] relative space-y-4 flex flex-col border-[rgba(0,0,0,0.19)] border-[1px] p-[20px] md:p-[24px]">
            <div className="w-[30px] bg-[rgba(249,249,249,1)] h-[30px] flex items-center justify-center">
              <div className="text-[rgba(255,85,0,1)] text-[18px] md:text-[22px]">
                +
              </div>
            </div>
            <div className="text-[20px] md:text-[24px] font-dmmono">
              CREATE NEW ACCOUNT
            </div>
            <div className="text-[10px] md:text-[12px] font-[400] text-[rgba(0,0,0,0.7)]">
              Create a new multisig account with a custom signature threshold
            </div>
            <div className="text-[10px] md:text-[12px] text-[rgba(0,0,0,1)] font-[500]">
              SETUP STEPS
            </div>

            <div className="flex flex-col space-y-4 flex-1">
              {/* Steps */}
              <div className="flex flex-row w-full items-center  space-x-2">
                <div className="flex items-center w-[10%]">
                  <span className="rounded-full w-[18px] h-[18px] bg-[rgba(255,85,0,1)] text-white flex items-center justify-center text-[10px]">
                    1
                  </span>
                </div>
                <div className="text-[10px] font-dmmono font-[400] tracking-[-2%]">
                  Choose account name and configure signature threshold (e.g., 2-of-3)
                </div>
              </div>

              <div className="flex flex-row w-full items-center  space-x-2">
                <div className="flex items-center w-[10%]">
                  <span className="rounded-full w-[18px] h-[18px] bg-[rgba(255,85,0,1)] text-white flex items-center justify-center text-[10px]">
                    2
                  </span>
                </div>
                <div className="text-[10px] font-dmmono font-[400] tracking-[-2%]">
                  Add signer addresses
                </div>
              </div>

              <div className="flex flex-row w-full items-center space-x-2">
                <div className="flex items-center w-[10%]">
                  <span className="rounded-full w-[18px] h-[18px] bg-[rgba(255,85,0,1)] text-white flex items-center justify-center text-[10px]">
                    3
                  </span>
                </div>
                <div className="text-[10px] font-dmmono font-[400] tracking-[-2%]">
                  Deploy multisig account smart contract on Miden network
                </div>
              </div>

              <div className="flex flex-row w-full items-center space-x-2">
                <div className="flex items-center w-[10%]">
                  <span className="rounded-full w-[18px] h-[18px] bg-[rgba(255,85,0,1)] text-white flex items-center justify-center text-[10px]">
                    4
                  </span>
                </div>
                <div className="text-[10px] font-dmmono font-[400] tracking-[-2%]">
                  Share account address with other signers
                </div>
              </div>
            </div>

            <button onClick={() => router.push("/login/createNewAccount")} className="mt-auto h-[38px] w-full flex flex-row items-center justify-center border border-[rgba(0,0,0,0.2)] bg-[rgba(249,249,249,1)] cursor-pointer">
              <div className="flex items-center justify-center w-[5%] h-full text-[14px] md:text-[16px]">
                +
              </div>
              <div className="uppercase font-dmmono text-[rgba(255,85,0,1)] text-[14px] md:text-[16px] tracking-[-4%] font-[500]">
                create account
              </div>
            </button>
          </div>

          {/* LOAD EXISTING ACCOUNT */}
          <div className="md:w-1/2 w-[90%] lg:max-h-[460px] relative space-y-4 flex flex-col border-[rgba(0,0,0,0.19)] border-[1px] p-[20px] md:p-[24px]">
            <div className="w-[30px] bg-[rgba(249,249,249,1)] h-[30px] flex items-center justify-center">
              <div className="relative w-[18px] h-[18px]">
                <Image src={Svg.upload} alt="upload" fill objectFit="contain" />
              </div>
            </div>
            <div className="text-[20px] md:text-[24px] font-dmmono">
              LOAD EXISTING ACCOUNT
            </div>
            <div className="text-[10px] md:text-[12px] font-[400] text-[rgba(0,0,0,0.7)]">
              Connect to an existing multi-signature account using the multisig account address
            </div>
            <div className="text-[10px] md:text-[12px] text-[rgba(0,0,0,1)] font-[500]">
              SETUP STEPS
            </div>

            <div className="flex flex-col space-y-4 flex-1">
              {/* Steps */}
              <div className="flex flex-row w-full items-center space-x-2">
                <div className="flex items-center w-[10%]">
                  <span className="rounded-full w-[18px] h-[18px] bg-[rgba(255,85,0,1)] text-white flex items-center justify-center text-[10px]">
                    1
                  </span>
                </div>
                <div className="text-[10px] font-dmmono font-[400] tracking-[-2%]">
                  Enter existing multisig account address
                </div>
              </div>

              <div className="flex flex-row w-full items-center space-x-2">
                <div className="flex items-center w-[10%]">
                  <span className="rounded-full w-[18px] h-[18px] bg-[rgba(255,85,0,1)] text-white flex items-center justify-center text-[10px]">
                    2
                  </span>
                </div>
                <div className="text-[10px] font-dmmono font-[400] tracking-[-2%]">
                  Connect your wallet
                </div>
              </div>

              <div className="flex flex-row w-full items-center space-x-2">
                <div className="flex items-center w-[10%]">
                  <span className="rounded-full w-[18px] h-[18px] bg-[rgba(255,85,0,1)] text-white flex items-center justify-center text-[10px]">
                    3
                  </span>
                </div>
                <div className="text-[10px] font-dmmono font-[400] tracking-[-2%]">
                  Verify you&apos;re authorized as a signer to sign transactions
                </div>
              </div>

              <div className="flex flex-row w-full items-center space-x-2 ">
                <div className="flex items-center w-[10%]">
                  <span className="rounded-full w-[18px] h-[18px] bg-[rgba(255,85,0,1)] text-white flex items-center justify-center text-[10px]">
                    4
                  </span>
                </div>
                <div className="text-[10px] font-dmmono font-[400] tracking-[-2%]">
                  Access account dashboard and transaction history
                </div>
              </div>
            </div>

            <button onClick={() => router.push("/login/loadExistingAccount")} className="mt-auto h-[38px] w-full flex flex-row items-center justify-center border border-[rgba(0,0,0,0.2)] bg-[rgba(249,249,249,1)] cursor-pointer">
              <div className="relative w-[24px] h-[24px]">
                <Image
                  src={Svg.upload_black}
                  alt="upload"
                  fill
                  objectFit="contain"
                />
              </div>
              <div className="uppercase font-dmmono text-[rgba(255,85,0,1)] text-[14px] md:text-[16px] tracking-[-4%] font-[500]">
                UPLOAD EXISTING ACCOUNT
              </div>
            </button>
          </div>
        </div>
        <div className="text-center text-[14px] md:text-[16px] uppercase font-[400] font-dmmono pb-[20px] md:pb-0">
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
            <div className="font-dmmono text-[13px] md:text-[15px] font-[500] tracking-[-3%] uppercase">
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
