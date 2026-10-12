"use client";

import { useEffect, useState } from "react";
import { useMultisig } from "@/contexts/MultisigContext";

/**
 * Start-up status of the in-browser Miden client. On a first visit the SDK
 * download and compile take a while; Create/Load wait for it, and this says
 * so. If start-up fails, it shows the real reason and a Retry.
 */
export function ClientStartupNotice() {
  const { clientStartup, retryClientStartup } = useMultisig();
  // Only mention start-up if it is noticeable, so fast (cached) starts don't flash a banner.
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (clientStartup.phase !== "starting") { setSlow(false); return; }
    const timer = setTimeout(() => setSlow(true), 1500);
    return () => clearTimeout(timer);
  }, [clientStartup.phase]);

  if (clientStartup.phase === "error") {
    return (
      <div role="alert" className="mx-auto mt-3 flex w-[90%] md:w-[70%] items-start justify-between gap-3 rounded-[8px] border border-red-200 bg-red-50 px-3 py-2.5">
        <div className="flex flex-col gap-0.5">
          <span className="text-[12px] font-[600] text-red-700">The Miden client could not start</span>
          <span className="text-[12px] text-red-600 wrap-break-word">{clientStartup.error}</span>
        </div>
        <button
          type="button"
          onClick={() => void retryClientStartup()}
          className="min-h-8 shrink-0 rounded-[6px] bg-red-600 px-3 text-[12px] font-[500] text-white hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    );
  }
  if (clientStartup.phase === "starting" && slow) {
    return (
      <div role="status" className="mx-auto mt-3 flex w-[90%] md:w-[70%] items-center gap-2 rounded-[8px] border border-[#FF550033] bg-[#FF55000A] px-3 py-2.5">
        <span aria-hidden className="h-3 w-3 shrink-0 rounded-full border-2 border-[#FF5500] border-t-transparent animate-spin" />
        <span className="text-[12px] text-[#9A3412]">
          Starting the Miden client… The first visit can take a few seconds while it downloads. You can fill in the form meanwhile; Create and Load continue as soon as it is ready.
        </span>
      </div>
    );
  }
  return null;
}
