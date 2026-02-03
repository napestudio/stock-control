"use client";

import { useEffect, useRef, memo, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

// useSyncExternalStore functions for client-side rendering detection
function subscribe() {
  // No-op because this value never changes after initial render
  return () => {};
}

function getSnapshot() {
  // Client-side: always return true
  return true;
}

function getServerSnapshot() {
  // Server-side: always return false
  return false;
}

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg";
}

function SidebarComponent({
  isOpen,
  onClose,
  title,
  children,
  size = "md",
}: SidebarProps) {
  // Use useSyncExternalStore to detect client-side rendering
  // This is the React-recommended way to handle server/client differences
  const isClient = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const sidebarRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const [shouldRender, setShouldRender] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  // Keep portal mounted during close animation
  useEffect(() => {
    if (isOpen) {
      // Wrap setState in requestAnimationFrame to make it async (avoids React Compiler warning)
      requestAnimationFrame(() => {
        setShouldRender(true);
        // Additional frames to ensure element renders before animating
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setIsAnimating(true);
          });
        });
      });
    } else {
      // Wrap setState in requestAnimationFrame to avoid React Compiler warning
      requestAnimationFrame(() => {
        setIsAnimating(false);
      });
      // Keep mounted for 300ms to allow exit animation
      const timer = setTimeout(() => setShouldRender(false), 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Handle ESC key to close sidebar
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      return () => document.removeEventListener("keydown", handleEscape);
    }
  }, [isOpen, onClose]);

  // Prevent body scroll when sidebar is open
  useEffect(() => {
    if (isOpen) {
      // Store current scroll position
      const scrollY = window.scrollY;
      document.body.style.overflow = "hidden";
      document.body.style.position = "fixed";
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = "100%";

      return () => {
        // Restore scroll position
        const scrollY = document.body.style.top;
        document.body.style.overflow = "";
        document.body.style.position = "";
        document.body.style.top = "";
        document.body.style.width = "";
        if (scrollY) {
          window.scrollTo(0, parseInt(scrollY || "0") * -1);
        }
      };
    }
  }, [isOpen]);

  // Focus management - trap focus within sidebar
  useEffect(() => {
    if (isOpen && sidebarRef.current) {
      // Store previous focus
      previousFocusRef.current = document.activeElement as HTMLElement;

      // Focus first focusable element in sidebar
      const focusableElements = sidebarRef.current.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const firstElement = focusableElements[0] as HTMLElement;
      if (firstElement) {
        firstElement.focus();
      }

      return () => {
        // Restore focus on close
        if (previousFocusRef.current) {
          previousFocusRef.current.focus();
        }
      };
    }
  }, [isOpen]);

  const widthClasses = {
    sm: "max-w-md", // 448px - for simple confirmations
    md: "max-w-lg", // 512px - for medium forms
    lg: "max-w-2xl", // 672px - for complex forms
  };

  // Don't render portal on server or before sidebar should be shown
  if (!isClient || !shouldRender) {
    return null;
  }

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity duration-300 ease-in-out ${
          isAnimating ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sidebar Panel */}
      <div
        ref={sidebarRef}
        className={`fixed inset-y-0 right-0 z-50 ${widthClasses[size]} w-full bg-white shadow-2xl flex flex-col transition-transform duration-300 ease-in-out will-change-transform ${
          isAnimating ? "translate-x-0" : "translate-x-full"
        }`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="sidebar-title"
      >
        {/* Header - Fixed */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 shrink-0">
          <h2
            id="sidebar-title"
            className="text-xl font-semibold text-gray-900"
          >
            {title}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close sidebar"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto px-6 py-6">{children}</div>
      </div>
    </>,
    document.body
  );
}

// Memoize component to prevent unnecessary re-renders
export default memo(SidebarComponent);
