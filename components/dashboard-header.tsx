"use client";

import { signOut } from "next-auth/react";

interface DashboardHeaderProps {
  title: string;
  subtitle?: string;
  userName?: string;
}

export default function DashboardHeader({
  title,
  subtitle,
  userName,
}: DashboardHeaderProps) {
  return (
    <header className="flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        {subtitle && <h2>{subtitle}</h2>}
      </div>
      <div className="flex items-center gap-4">
        {userName && <span className="text-sm text-gray-600">{userName}</span>}
        <button
          onClick={() => signOut({ callbackUrl: "/" })}
          className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          Cerrar sesión
        </button>
      </div>
    </header>
  );
}
