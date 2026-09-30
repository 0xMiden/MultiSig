"use client";

import React, { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import dynamicImport from "next/dynamic";
import Sidebar from "./components/Sidebar";
import TaskBar from "./components/Taskbar";
import SendModal from "./home/components/SendModal";
import ReceiveModal from "./home/components/ReceiveModal";
import { DashboardUIProvider, useDashboardUI } from "@/contexts/DashboardUIContext";
import type { ActionType } from "medina-agent";
import "medina-agent/styles.css";
import AccountStatusBanner from "./components/AccountStatusBanner";

const CHAT_ENDPOINT = process.env.NEXT_PUBLIC_CHAT_ENDPOINT?.trim() ?? "";

// The assistant is optional. Load it in the browser only (its markdown renderer
// touches `document` at import time) and only when an endpoint is configured,
// so an unconfigured deployment ships no chat widget at all.
const ChatLauncher = CHAT_ENDPOINT
  ? dynamicImport(() => import("medina-agent").then((mod) => mod.ChatLauncher), { ssr: false })
  : null;

// Force dynamic rendering to avoid WASM loading issues during build
export const dynamic = 'force-dynamic';

function DashboardShell({ children }: Readonly<{ children: React.ReactNode }>) {
  const [collapsed, setCollapsed] = useState(false);
  const router = useRouter();
  const {
    isSendModalOpen,
    openSendModal,
    closeSendModal,
    isReceiveModalOpen,
    openReceiveModal,
    closeReceiveModal,
    setSettingsTab,
  } = useDashboardUI();

  const handleChatAction = useCallback(
    (actionType: ActionType) => {
      switch (actionType) {
        case "send_funds":
          openSendModal();
          break;
        case "receive_funds":
          openReceiveModal();
          break;
        case "add_signer":
        case "remove_signer":
        case "change_threshold":
          setSettingsTab("signers");
          router.push("/dashboard/settings");
          break;
      }
    },
    [openSendModal, openReceiveModal, setSettingsTab, router]
  );

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Taskbar — fixed height row */}
      <div className="shrink-0">
        <TaskBar />
      </div>

      {/* Body — sidebar + main sit side by side in a flex row */}
      <div className="flex flex-1 overflow-hidden">
        <aside
          className={`shrink-0 overflow-hidden transition-all duration-300 ease-out ${
            collapsed ? "w-[52px]" : "w-[200px]"
          }`}
        >
          <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} />
        </aside>

        <main className="flex-1 overflow-y-auto p-4 scrollbar-hidden" style={{ scrollbarGutter: 'stable' }}>
          <AccountStatusBanner />
          {children}
        </main>
      </div>

      <SendModal open={isSendModalOpen} onClose={closeSendModal} />
      <ReceiveModal open={isReceiveModalOpen} onClose={closeReceiveModal} />

      {ChatLauncher && (
        <ChatLauncher
          endpoint={CHAT_ENDPOINT}
          title="Miden Assistant"
          onAction={(actionType) => handleChatAction(actionType)}
        />
      )}
    </div>
  );
}

export default function Layout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <DashboardUIProvider>
      <DashboardShell>{children}</DashboardShell>
    </DashboardUIProvider>
  );
}
