"use client";

import { useState } from "react";
import Modal from "@/components/ui/modal";

interface ResetPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  password: string;
}

export default function ResetPasswordModal({
  isOpen,
  onClose,
  password,
}: ResetPasswordModalProps) {
  const [copied, setCopied] = useState(false);

  async function copyToClipboard() {
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Password Reset" size="md">
      <div className="space-y-4">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex">
            <svg
              className="h-5 w-5 text-yellow-400 mr-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <div className="text-sm text-yellow-700">
              <p className="font-medium">Important:</p>
              <p className="mt-1">
                Share this password securely with the user. They will be
                required to change it on first login.
              </p>
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Temporary Password
          </label>
          <div className="relative">
            <input
              type="text"
              value={password}
              readOnly
              className="block w-full px-4 py-3 font-mono text-lg bg-gray-50 border border-gray-300 rounded-md"
            />
            <button
              onClick={copyToClipboard}
              className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 rounded transition-colors"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700"
          >
            Done
          </button>
        </div>
      </div>
    </Modal>
  );
}
