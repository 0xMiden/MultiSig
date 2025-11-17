"use client";

import React from "react";
import Sidebar from "./components/Sidebar";
import TaskBar from "./components/Taskbar";

// Force dynamic rendering to avoid WASM loading issues during build
export const dynamic = 'force-dynamic';

export default function Layout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex flex-col h-full">
      <div className="fixed top-0 left-0 right-0 z-10">
        <TaskBar />
      </div>
      <div className="flex h-full pt-8">
        <aside className="fixed left-0 top-[50px] h-[calc(100vh-4rem)] z-10">
          <Sidebar />
        </aside>
        <main className="flex-1 ml-[50px] lg:ml-[100px] overflow-y-auto px-0 py-4 lg:p-4">
          {children}
        </main>
      </div>
    </div>
  );
}
