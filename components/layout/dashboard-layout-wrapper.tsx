"use client";

import { useState } from "react";
import Sidebar from "./sidebar";
import NavIcon from "./nav-icon";
import FloatingToolbar from "@/components/toolbar/FloatingToolbar";
import type { Session } from "next-auth";

interface DashboardLayoutWrapperProps {
  session: Session;
  children: React.ReactNode;
}

export default function DashboardLayoutWrapper({
  session,
  children,
}: DashboardLayoutWrapperProps) {
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  return (
    <div className="h-svh flex bg-gray-50 overflow-hidden">
      <Sidebar
        session={session}
        isMobileOpen={isMobileOpen}
        onMobileClose={() => setIsMobileOpen(false)}
      />

      <div className="flex-1 min-w-0 flex flex-col overflow-hidden lg:ml-72">
        {/* Mobile menu button */}
        <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-white border-b border-gray-200 z-30 flex items-center px-4">
          <button
            onClick={() => setIsMobileOpen(true)}
            className="p-2 rounded-lg text-gray-600 hover:bg-gray-100"
            aria-label="Abrir menú"
          >
            <NavIcon name="menu" />
          </button>
          <h1 className="ml-4 text-lg font-semibold text-gray-900">StockPro</h1>
        </div>

        {/* Main content */}
        <main className="flex-1 min-h-0 flex flex-col overflow-y-auto pt-16 lg:pt-0 p-4 lg:p-8">{children}</main>

        <FloatingToolbar />
      </div>
    </div>
  );
}
