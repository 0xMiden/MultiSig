"use client";

import React, { createContext, useContext, useState } from "react";

export type SettingsTab = "general" | "security" | "signers" | "notifications" | "transactionguard";

export interface SendProposalDraft {
  recipientId: string;
  faucetId: string;
  amount: string;
  isPrivate: boolean;
}

interface DashboardUIContextValue {
  isSendModalOpen: boolean;
  sendProposalDraft: SendProposalDraft | null;
  openSendModal: (draft?: SendProposalDraft) => void;
  closeSendModal: () => void;
  clearSendProposalDraft: () => void;

  isReceiveModalOpen: boolean;
  receiveProposalDraft: string[];
  openReceiveModal: (noteIds?: string[]) => void;
  closeReceiveModal: () => void;
  clearReceiveProposalDraft: () => void;

  settingsTab: SettingsTab;
  setSettingsTab: (tab: SettingsTab) => void;
}

const DashboardUIContext = createContext<DashboardUIContextValue | undefined>(undefined);

export function DashboardUIProvider({ children }: { children: React.ReactNode }) {
  const [isSendModalOpen, setIsSendModalOpen] = useState(false);
  const [sendProposalDraft, setSendProposalDraft] = useState<SendProposalDraft | null>(null);
  const [isReceiveModalOpen, setIsReceiveModalOpen] = useState(false);
  const [receiveProposalDraft, setReceiveProposalDraft] = useState<string[]>([]);
  const [settingsTab, setSettingsTab] = useState<SettingsTab>("general");

  return (
    <DashboardUIContext.Provider
      value={{
        isSendModalOpen,
        sendProposalDraft,
        openSendModal: (draft) => {
          setSendProposalDraft(draft ?? null);
          setIsSendModalOpen(true);
        },
        closeSendModal: () => setIsSendModalOpen(false),
        clearSendProposalDraft: () => setSendProposalDraft(null),
        isReceiveModalOpen,
        receiveProposalDraft,
        openReceiveModal: (noteIds) => {
          setReceiveProposalDraft(noteIds ?? []);
          setIsReceiveModalOpen(true);
        },
        closeReceiveModal: () => setIsReceiveModalOpen(false),
        clearReceiveProposalDraft: () => setReceiveProposalDraft([]),
        settingsTab,
        setSettingsTab,
      }}
    >
      {children}
    </DashboardUIContext.Provider>
  );
}

export function useDashboardUI() {
  const ctx = useContext(DashboardUIContext);
  if (!ctx) throw new Error("useDashboardUI must be used within a DashboardUIProvider");
  return ctx;
}
