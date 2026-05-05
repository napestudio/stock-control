"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { useState, useRef, useEffect } from "react";
import { navigationItems } from "@/lib/config/navigation";
import type { NavEntry, NavGroup } from "@/lib/config/navigation";
import { isAdmin } from "@/lib/utils/auth-helpers";
import NavIcon from "./nav-icon";
import type { Session } from "next-auth";

interface SidebarProps {
  session: Session;
  isMobileOpen: boolean;
  onMobileClose: () => void;
}

function isNavGroup(item: NavEntry): item is NavGroup {
  return "children" in item;
}

export default function Sidebar({
  session,
  isMobileOpen,
  onMobileClose,
}: SidebarProps) {
  const pathname = usePathname();
  const [dropupOpen, setDropupOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        userMenuRef.current &&
        !userMenuRef.current.contains(event.target as Node)
      ) {
        setDropupOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Derive effective open groups during render: manually opened OR has an active child path
  const effectiveOpenGroups = new Set(openGroups);
  for (const item of navigationItems) {
    if (isNavGroup(item)) {
      if (item.children.some((child) => pathname.startsWith(child.path))) {
        effectiveOpenGroups.add(item.label);
      }
    }
  }

  function toggleGroup(label: string) {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) {
        next.delete(label);
      } else {
        next.add(label);
      }
      return next;
    });
  }

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
        fixed top-0 left-0 h-svh w-72 bg-white shadow-lg z-50
        transform transition-transform duration-300 ease-in-out
        lg:translate-x-0 flex justify-between flex-col
        ${isMobileOpen ? "translate-x-0" : "-translate-x-full"}
      `}
      >
        <div className="h-16 flex items-center justify-between px-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-indigo-600">StockPro</h2>
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
            {visibleItems.map((item) => {
              if (isNavGroup(item)) {
                const isOpen = effectiveOpenGroups.has(item.label);
                const hasActiveChild = item.children.some((child) =>
                  isActive(child.path)
                );
                return (
                  <li key={item.label}>
                    <button
                      onClick={() => toggleGroup(item.label)}
                      className={`
                        flex items-center gap-3 px-4 py-3 rounded-lg w-full
                        transition-colors duration-200
                        ${
                          hasActiveChild
                            ? "text-indigo-600 bg-indigo-50"
                            : "text-gray-700 hover:bg-indigo-50 hover:text-indigo-600"
                        }
                      `}
                    >
                      <NavIcon
                        name={item.icon}
                        className={
                          hasActiveChild ? "text-indigo-600" : "text-gray-500"
                        }
                      />
                      <span className="font-medium">{item.label}</span>
                      <svg
                        className={`w-4 h-4 ml-auto shrink-0 transition-transform duration-200 ${
                          isOpen ? "rotate-180" : ""
                        } ${hasActiveChild ? "text-indigo-600" : "text-gray-400"}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </button>
                    {isOpen && (
                      <ul className="mt-1 space-y-1 ml-4">
                        {item.children.map((child) => (
                          <li key={child.path}>
                            <Link
                              href={child.path}
                              onClick={onMobileClose}
                              className={`
                                flex items-center gap-3 px-4 py-2 rounded-lg
                                transition-colors duration-200
                                ${
                                  isActive(child.path)
                                    ? "bg-indigo-600 text-white"
                                    : "text-gray-700 hover:bg-indigo-50 hover:text-indigo-600"
                                }
                              `}
                            >
                              <NavIcon
                                name={child.icon}
                                className={
                                  isActive(child.path)
                                    ? "text-white"
                                    : "text-gray-500"
                                }
                              />
                              <span className="text-sm font-medium">
                                {child.label}
                              </span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              }

              return (
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
              );
            })}
          </ul>
        </nav>

        <div className="border-t border-gray-200 p-3 relative" ref={userMenuRef}>
          {dropupOpen && (
            <div className="absolute bottom-full left-3 right-3 mb-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
              <button
                onClick={() => signOut({ callbackUrl: "/" })}
                className="w-full px-4 py-2.5 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                  />
                </svg>
                Cerrar sesión
              </button>
            </div>
          )}

          <button
            onClick={() => setDropupOpen((v) => !v)}
            className="w-full flex items-center gap-3 rounded-lg hover:bg-gray-50 p-2 transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
              <span className="text-indigo-600 font-semibold text-sm">
                {session.user.name?.[0]?.toUpperCase() ||
                  session.user.email?.[0]?.toUpperCase() ||
                  "U"}
              </span>
            </div>
            <div className="flex-1 min-w-0 text-left">
              <p className="text-sm font-medium text-gray-900 truncate">
                {session.user.name || session.user.email}
              </p>
              <p className="text-xs text-gray-500">{session.user.role}</p>
            </div>
            <svg
              className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${dropupOpen ? "rotate-180" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 15l7-7 7 7"
              />
            </svg>
          </button>
        </div>
      </aside>
    </>
  );
}
