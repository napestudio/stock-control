"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  changePasswordSchema,
  type ChangePasswordInput,
} from "@/lib/validations/user-schema";
import { changePassword } from "@/app/actions/user-actions";
import FormInput from "@/components/ui/form-input";

interface ChangePasswordFormProps {
  isFirstLogin: boolean;
}

export default function ChangePasswordForm({
  isFirstLogin,
}: ChangePasswordFormProps) {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { update } = useSession();

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
  });

  const newPassword = watch("newPassword");

  async function onSubmit(data: ChangePasswordInput) {
    setError("");
    setLoading(true);

    try {
      await changePassword(data.currentPassword, data.newPassword);

      // Update session to refresh JWT token with new requirePasswordChange value
      await update();

      // Redirect to dashboard after successful password change
      router.push("/panel");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to change password");
    } finally {
      setLoading(false);
    }
  }

  // Password strength indicator
  function getPasswordStrength(password: string): {
    score: number;
    label: string;
    color: string;
  } {
    if (!password) return { score: 0, label: "", color: "" };

    let score = 0;
    if (password.length >= 8) score++;
    if (password.length >= 12) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[a-z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;

    if (score <= 2) return { score, label: "Weak", color: "bg-red-500" };
    if (score <= 4) return { score, label: "Fair", color: "bg-yellow-500" };
    return { score, label: "Strong", color: "bg-green-500" };
  }

  const passwordStrength = getPasswordStrength(newPassword || "");

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {!isFirstLogin && (
        <FormInput
          label="Current Password"
          type="password"
          {...register("currentPassword")}
          error={errors.currentPassword?.message}
          required
          autoComplete="current-password"
        />
      )}

      <div>
        <FormInput
          label="New Password"
          type="password"
          {...register("newPassword")}
          error={errors.newPassword?.message}
          required
          autoComplete="new-password"
        />
        {newPassword && (
          <div className="mt-2">
            <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
              <span>Password Strength</span>
              <span className="font-medium">{passwordStrength.label}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${passwordStrength.color}`}
                style={{
                  width: `${(passwordStrength.score / 6) * 100}%`,
                }}
              />
            </div>
          </div>
        )}
        <p className="mt-2 text-xs text-gray-500">
          Password must contain at least 8 characters, including uppercase,
          lowercase, and a number.
        </p>
      </div>

      <FormInput
        label="Confirm New Password"
        type="password"
        {...register("confirmPassword")}
        error={errors.confirmPassword?.message}
        required
        autoComplete="new-password"
      />

      <button
        type="submit"
        disabled={loading}
        className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? "Changing Password..." : "Change Password"}
      </button>
    </form>
  );
}
