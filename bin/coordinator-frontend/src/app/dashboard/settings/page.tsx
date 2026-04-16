"use client";
import React, { useState } from "react";
import General from "./components/General";
import Security from "./components/Security";
import Signers from "./components/Signers";
import Notifications from "./components/Notifications";
import Transactionguard from "./components/Transactionguard";

// Force dynamic rendering to avoid WASM loading issues during build
export const dynamic = 'force-dynamic';

const Settings = () => {
  const [activeTab, setActiveTab] = useState("general");

  const tabs = [
    { id: "general", label: "General" },
    { id: "security", label: "Security" },
    { id: "signers", label: "Signers" },
    { id: "notifications", label: "Notifications" },
    { id: "transactionguard", label: "Transaction Guard" },
  ];

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
      <div className="flex flex-col w-full p-4 font-geist">
        <div className="mb-4">
          <div className="text-[#111] text-[22px] md:text-[24px] font-[600] font-geist">
            Settings
          </div>
          <div className="text-[13px] md:text-[14px] text-[rgba(0,0,0,0.5)] font-geist font-[400] mt-1">
            Configure multisig account preferences and security
          </div>
        </div>

        {/* tab menu — segmented control */}
        <div className="w-full grid grid-cols-5 bg-[rgba(245,245,245,1)] rounded-[10px] p-1 relative overflow-hidden mb-4">
          {/* Animated background indicator */}
          <div
            className="absolute top-1 bottom-1 left-1 bg-white rounded-[8px] shadow-sm transition-transform duration-300 ease-in-out"
            style={{
              width: `calc(${100 / tabs.length}% - 8px)`,
              transform: `translateX(calc(${tabs.findIndex((tab) => tab.id === activeTab) * 100}% + ${tabs.findIndex((tab) => tab.id === activeTab) * 8}px))`,
            }}
          />

          {tabs.map((tab) => (
            <div
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
              }}
              className={`flex items-center h-10 justify-center cursor-pointer text-[12px] md:text-[13px] font-geist font-[500] transition-colors duration-200 relative z-10 select-none ${
                activeTab === tab.id
                  ? "text-[#FF5500]"
                  : "text-[rgba(0,0,0,0.55)] hover:text-[#111]"
              }`}
            >
              {tab.label}
            </div>
          ))}
        </div>

        {/* tab content */}
        <div className="w-full">
          <div key={activeTab} className="transition-opacity duration-200">
            {renderTabContent()}
          </div>
        </div>
      </div>
    </>
  );
};

export default Settings;
