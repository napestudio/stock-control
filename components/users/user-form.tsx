"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createUserSchema, type CreateUserInput } from "@/lib/validations/user-schema";
import { createUser, updateUser } from "@/app/actions/user-actions";
import FormInput from "@/components/ui/form-input";
import FormSelect from "@/components/ui/form-select";
import type { Role, User } from "@prisma/client";

interface UserFormProps {
  mode: "create" | "edit";
  user?: User & { role: Role };
  roles: Role[];
  onSuccess: (data?: { user: User & { role: Role }; temporaryPassword: string }) => void;
  onCancel: () => void;
}

export default function UserForm({
  mode,
  user,
  roles,
  onSuccess,
  onCancel,
}: UserFormProps) {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateUserInput>({
    resolver: zodResolver(createUserSchema),
    defaultValues: mode === "edit" && user
      ? {
          name: user.name || "",
          roleId: user.roleId,
        }
      : undefined,
  });

  async function onSubmit(data: CreateUserInput) {
    setError("");
    setLoading(true);

    try {
      if (mode === "create") {
        const result = await createUser(data);
        onSuccess(result.data);
      } else if (mode === "edit" && user) {
        await updateUser(user.id, data);
        onSuccess();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      <FormInput
        label="Name"
        {...register("name")}
        error={errors.name?.message}
        required
        placeholder="Enter full name"
      />

      <FormSelect
        label="Role"
        {...register("roleId")}
        options={roles.map((role) => ({
          value: role.id,
          label: role.name,
        }))}
        error={errors.roleId?.message}
        required
      />

      {mode === "edit" && (
        <div className="flex items-center">
          <input
            type="checkbox"
            id="active"
            defaultChecked={user?.active}
            className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
            {...register("active" as any)}
          />
          <label htmlFor="active" className="ml-2 block text-sm text-gray-900">
            Active
          </label>
        </div>
      )}

      <div className="flex justify-end gap-3 pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
          disabled={loading}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading
            ? mode === "create"
              ? "Creating..."
              : "Saving..."
            : mode === "create"
              ? "Create User"
              : "Save Changes"}
        </button>
      </div>
    </form>
  );
}
