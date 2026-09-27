"use client";
import React from "react";
import General from "./components/General";
import Security from "./components/Security";
import Signers from "./components/Signers";
import Notifications from "./components/Notifications";
import Transactionguard from "./components/Transactionguard";
import { useDashboardUI } from "@/contexts/DashboardUIContext";

// Force dynamic rendering to avoid WASM loading issues during build
export const dynamic = 'force-dynamic';

const Settings = () => {
  const { settingsTab: activeTab, setSettingsTab: setActiveTab } = useDashboardUI();

  const tabs = [
    { id: "general", label: "GENERAL" },
    { id: "security", label: "SECURITY" },
    { id: "signers", label: "SIGNERS" },
    { id: "notifications", label: "NOTIFICATIONS" },
    { id: "transactionguard", label: "TRANSACTION GUARD" },
  ] as const;

  const renderTabContent = () => {
    switch (activeTab) {
      case "general":
        return <General />;
      case "security":
        return <Security />;
      case "signers":
        return <Signers />;
      case "notifications":
        return <Notifications />;
      case "transactionguard":
        return <Transactionguard />;
      default:
        return <General />;
    }
  };

  return (
    <>
      <div className="flex flex-col w-full h-full space-y-4 p-6">
        <div className="flex flex-col w-full">
          <span className="text-[22px] md:text-[24px] font-[600] text-[#111]">
            Settings
          </span>
          <span className="text-[13px] font-[500] text-[rgba(0,0,0,0.5)]">
            Configure multisig account preferences and security
          </span>
        </div>

        {/* Tab bar — flex instead of grid so h-10 is enforced on children */}
        <div className="w-full h-10 flex bg-[rgba(245,245,245,1)] rounded-[10px] p-1 relative overflow-hidden shrink-0">
          {/* Sliding white indicator */}
          <div
            className="absolute top-1 bottom-1 left-1 bg-white rounded-[8px] shadow-xs transition-transform duration-300 ease-in-out pointer-events-none"
            style={{
              width: `calc((100% - 8px) / ${tabs.length})`,
              transform: `translateX(${tabs.findIndex((tab) => tab.id === activeTab) * 100}%)`,
            }}
          />

          {tabs.map((tab) => (
            <div
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center cursor-pointer text-[13px] font-[500] transition-colors duration-150 relative z-10 select-none whitespace-nowrap ${
                activeTab === tab.id ? "text-[#111]" : "text-[rgba(0,0,0,0.5)] hover:text-[#111]"
              }`}
            >
              {tab.label}
            </div>
          ))}
        </div>

        {/* tab content */}
        <div className="w-full ">
          <div key={activeTab} className=" transition-opacity duration-200">
            {renderTabContent()}
          </div>
        </div>
      </div>
    </>
  );
};

export default Settings;
