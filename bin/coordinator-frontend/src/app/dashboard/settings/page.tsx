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
    { id: "general", label: "GENERAL" },
    { id: "security", label: "SECURITY" },
    { id: "signers", label: "SIGNERS" },
    { id: "notifications", label: "NOTIFICATIONS" },
    { id: "transactionguard", label: "TRANSACTION GUARD" },
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
      <div className="flex flex-col w-full h-full space-y-4 p-6">
        <div className="flex flex-col w-full">
          <span className="uppercase text-[24px] font-dmmono font-[500] text-[#000000]">
            SETTINGS
          </span>
          <span className="text-[16px] font-dmmono font-[500] text-[#0000007A]">
            Configure multisig account preferences and security
          </span>
        </div>

        {/* tab menu */}
        <div className="w-full h-[56px] grid grid-cols-5 border-[0.5px] border-[#00000033] uppercase relative overflow-hidden rounded-sm">
          {/* Animated background indicator */}
          <div
            className="absolute top-0 left-0 h-[56px] bg-[#FF5500] rounded-sm shadow-sm transition-transform duration-300 ease-in-out"
            style={{
              width: `${100 / tabs.length}%`,
              transform: `translateX(${tabs.findIndex((tab) => tab.id === activeTab) * 100
                }%)`,
            }}
          />

          {tabs.map((tab, index) => (
            <div
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
              }}
              className={`flex items-center  h-[56px] justify-center cursor-pointer text-[16px] font-dmmono font-[500] transition-all duration-300 relative z-10 select-none ${activeTab === tab.id
                  ? "text-white font-semibold"
                  : "text-black hover:text-gray-700"
                }`}
            >
              <span
                className={`transition-colors duration-150 ${activeTab === tab.id ? "text-white" : "text-black"
                  }`}
              >
                {tab.label}
              </span>
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
