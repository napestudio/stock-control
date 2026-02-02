"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { navigationItems } from "@/lib/config/navigation";
import { isAdmin } from "@/lib/utils/auth-helpers";
import NavIcon from "./nav-icon";
import type { Session } from "next-auth";

interface SidebarProps {
  session: Session;
  isMobileOpen: boolean;
  onMobileClose: () => void;
}

export default function Sidebar({
  session,
  isMobileOpen,
  onMobileClose,
}: SidebarProps) {
  const pathname = usePathname();

  // Filter navigation items based on user role
  const visibleItems = navigationItems.filter((item) => {
    if (item.requiresAdmin) {
      return isAdmin(session);
    }
    return true;
  });

  // Determine if route is active
  const isActive = (path: string) => {
    if (path === "/panel") {
      return pathname === path;
    }
    return pathname.startsWith(path);
  };

  return (
    <>
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onMobileClose}
        />
      )}

      <aside
        className={`
        fixed top-0 left-0 h-svh w-96 bg-white shadow-lg z-50
        transform transition-transform duration-300 ease-in-out
        lg:translate-x-0 lg:static lg:z-auto flex justify-between flex-col
        ${isMobileOpen ? "translate-x-0" : "-translate-x-full"}
      `}
      >
        <div className="h-16 flex items-center justify-between px-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-indigo-600">Stock Control</h2>
          <button
            onClick={onMobileClose}
            className="lg:hidden text-gray-500 hover:text-gray-700"
            aria-label="Cerrar menú"
          >
            <NavIcon name="x" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-4">
          <ul className="space-y-2">
            {visibleItems.map((item) => (
              <li key={item.path}>
                <Link
                  href={item.path}
                  onClick={onMobileClose}
                  className={`
                    flex items-center gap-3 px-4 py-3 rounded-lg
                    transition-colors duration-200
                    ${
                      isActive(item.path)
                        ? "bg-indigo-600 text-white"
                        : "text-gray-700 hover:bg-indigo-50 hover:text-indigo-600"
                    }
                  `}
                >
                  <NavIcon
                    name={item.icon}
                    className={
                      isActive(item.path) ? "text-white" : "text-gray-500"
                    }
                  />
                  <span className="font-medium">{item.label}</span>
                  {item.path === "/panel/change-password" &&
                    session.user.requirePasswordChange && (
                      <span className="ml-auto w-2 h-2 bg-red-500 rounded-full" />
                    )}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="border-t border-gray-200 p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
              <span className="text-indigo-600 font-semibold text-sm">
                {session.user.name?.[0]?.toUpperCase() ||
                  session.user.email?.[0]?.toUpperCase() ||
                  "U"}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {session.user.name || session.user.email}
              </p>
              <p className="text-xs text-gray-500">{session.user.role}</p>
            </div>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
          >
            Cerrar sesión
          </button>
        </div>
      </aside>
    </>
  );
}
