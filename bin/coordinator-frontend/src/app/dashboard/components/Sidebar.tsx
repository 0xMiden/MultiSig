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

const Sidebar: React.FC = () => {
  const router = useRouter();
  const pathname = usePathname();

  const handleNavigation = (path: string) => {
    router.push(path);
  };

  const isActive = (path: string) => {
    return pathname === path;
  };

  const handleLogout = () => {
    // Clear localStorage
    localStorage.clear();
    
    // Clear cookies
    document.cookie.split(";").forEach((c) => {
      document.cookie = c
        .replace(/^ +/, "")
        .replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
    });
    
    // Reload the page
    window.location.reload();
  };

  return (
    <div className="relative w-[50px] lg:w-[120px] h-full flex flex-col">
      {/* Right border, only 50vh tall */}
      <div className="absolute top-0 right-0 w-px h-[75vh] bg-[#0000001A]" />

      <div className="flex flex-col text-center py-5 flex-1">
        {sidebarPages.map((page, index) => (
          <div
            key={index}
            className={`py-2 px-3 flex items-center gap-1 cursor-pointer ${
              isActive(page.path) ? 'bg-[#FF5500] bg-opacity-10 rounded-md' : ''
            }`}
            onClick={() => handleNavigation(page.path)}
          >
            <div className="w-[100%] lg:w-[15%] h-[20px] relative">
              <Image src={page.pageIcon} alt={page.pageName} quality={100} fill />
            </div>
            <div className={`lg:block hidden text-[10px] text-left font-[500] lg:w-[85%] px-2 hover:text-[#FF5500] ${
              isActive(page.path) ? 'text-[#FF5500]' : ''
            }`}>
              {page.pageName}
            </div>
          </div>
        ))}
      </div>

      {/* Logout button at the bottom */}
      <div className="mt-auto mb-4">
        <div
          className="py-2 px-3 flex items-center gap-1 cursor-pointer hover:bg-red-50 rounded-md"
          onClick={handleLogout}
        >
          <div className="w-[100%] lg:w-[15%] h-[20px] relative flex items-center justify-center">
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
          <div className="lg:block hidden text-[12px] text-left font-[500] lg:w-[85%] px-2 hover:text-red-500 text-gray-700">
            Logout
          </div>
        </div>
      </div>
    
    </div>
  );
};

export default Sidebar;
