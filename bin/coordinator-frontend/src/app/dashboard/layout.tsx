"use client";

import React, { useState } from "react";
import Sidebar from "./components/Sidebar";
import TaskBar from "./components/Taskbar";

// Force dynamic rendering to avoid WASM loading issues during build
export const dynamic = 'force-dynamic';

export default function Layout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [collapsed, setCollapsed] = useState(false);
  const sidebarWidth = collapsed ? 64 : 220;

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <TaskBar />
      <div className="flex flex-1 overflow-hidden">
        <aside
          className="shrink-0 overflow-y-auto transition-all duration-300 ease-out"
          style={{ width: sidebarWidth }}
        >
          <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} />
        </aside>
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
