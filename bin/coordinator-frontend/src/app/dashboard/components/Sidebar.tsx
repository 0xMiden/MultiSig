"use client";

import React from "react";
import Image from "next/image";
import { useRouter, usePathname } from "next/navigation";
import media from "../../../../public/media";
import { SidebarPage } from "@/types";

const sidebarPages: SidebarPage[] = [
  { pageName: "Home", path: "/dashboard/home", pageIcon: media.HomeIcon },
  { pageName: "Assets", path: "/dashboard/assets", pageIcon: media.assetsIcon },
  { pageName: "Transactions", path: "/dashboard/transactions", pageIcon: media.transactionsIcon },
  { pageName: "Settings", path: "/dashboard/settings", pageIcon: media.settingsIcon },
];

interface SidebarProps {
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ collapsed, setCollapsed }) => {
  const router = useRouter();
  const pathname = usePathname();

  const isActive = (path: string) => pathname === path;

  const handleLogout = () => {
    localStorage.clear();
    document.cookie.split(";").forEach((c) => {
      document.cookie = c
        .replace(/^ +/, "")
        .replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
    });
    window.location.reload();
  };

  return (
    <div className="w-full h-full flex flex-col bg-[#f9f9f9] overflow-hidden">

      {/* Collapse toggle — always right-aligned */}
      <div className="flex justify-end px-2 pt-4 shrink-0">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-[rgba(0,0,0,0.04)] text-[rgba(0,0,0,0.6)] hover:text-[#111] transition-colors shrink-0"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
            className={`w-4 h-4 transition-transform duration-300 ${collapsed ? "rotate-180" : ""}`}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>
      </div>

      {/* Nav items */}
      <div className="flex flex-col pt-2 pb-3 gap-1 flex-1">
        {sidebarPages.map((page, index) => (
          <div
            key={index}
            className={`mx-2 py-2.5 px-2 flex items-center gap-3 cursor-pointer rounded-[8px] transition-colors ${
              isActive(page.path) ? "bg-[#FF5500]/10" : "hover:bg-[rgba(0,0,0,0.04)]"
            }`}
            onClick={() => router.push(page.path)}
          >
            {/* Icon — always at same position, never moves */}
            <div className="w-[20px] h-[20px] relative shrink-0">
              <Image src={page.pageIcon} alt={page.pageName} quality={100} fill />
            </div>

            {/* Label — fades and slides out, never unmounts */}
            <span
              className={`text-[13px] font-[500] whitespace-nowrap overflow-hidden transition-all duration-300 ${
                isActive(page.path) ? "text-[#FF5500]" : "text-[#111]"
              } ${collapsed ? "w-0 opacity-0" : "w-auto opacity-100"}`}
            >
              {page.pageName}
            </span>
          </div>
        ))}
      </div>

      {/* Logout */}
      <div className="mb-4 shrink-0">
        <div
          className="mx-2 py-2.5 px-2 flex items-center gap-3 cursor-pointer hover:bg-red-50 rounded-[8px] transition-colors"
          onClick={handleLogout}
        >
          <div className="w-[20px] h-[20px] flex items-center justify-center shrink-0">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-5 h-5 text-gray-700"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75"
              />
            </svg>
          </div>
          <span
            className={`text-[13px] font-[500] whitespace-nowrap overflow-hidden text-gray-700 transition-all duration-300 ${
              collapsed ? "w-0 opacity-0" : "w-auto opacity-100"
            }`}
          >
            Logout
          </span>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
