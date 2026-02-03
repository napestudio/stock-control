"use client";

import { useState } from "react";
import type { Role, User } from "@prisma/client";
import UserTable from "@/components/users/user-table";
import UserForm from "@/components/users/user-form";
import ResetPasswordSidebar from "@/components/users/reset-password-sidebar";
import DeleteConfirmationModal from "@/components/users/delete-confirmation-modal";
import Sidebar from "@/components/ui/sidebar";
import { getUsers, resetUserPassword, softDeleteUser } from "@/app/actions/user-actions";

type UserWithRole = User & { role: Role };
type FilterType = "all" | "active" | "inactive";

interface UserManagementClientProps {
  initialUsers: UserWithRole[];
  roles: Role[];
}

export default function UserManagementClient({
  initialUsers,
  roles,
}: UserManagementClientProps) {
  const [users, setUsers] = useState<UserWithRole[]>(initialUsers);
  const [filter, setFilter] = useState<FilterType>("all");

  // Modal states
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserWithRole | null>(null);
  const [resetPasswordModalOpen, setResetPasswordModalOpen] = useState(false);
  const [resetPasswordData, setResetPasswordData] = useState<string>("");
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletingUser, setDeletingUser] = useState<UserWithRole | null>(null);

  // Loading states
  const [loading, setLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Error state
  const [error, setError] = useState("");

  // Refresh users list
  async function refreshUsers() {
    try {
      const fetchedUsers = await getUsers(filter);
      setUsers(fetchedUsers);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch users");
    }
  }

  // Filter tabs handler
  async function handleFilterChange(newFilter: FilterType) {
    setFilter(newFilter);
    setLoading(true);
    try {
      const fetchedUsers = await getUsers(newFilter);
      setUsers(fetchedUsers);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch users");
    } finally {
      setLoading(false);
    }
  }

  // Handle create success
  function handleCreateSuccess(data?: { user: unknown; temporaryPassword: string }) {
    setCreateModalOpen(false);
    if (data?.temporaryPassword) {
      setResetPasswordData(data.temporaryPassword);
      setResetPasswordModalOpen(true);
    }
    refreshUsers();
  }

  // Handle edit success
  function handleEditSuccess() {
    setEditModalOpen(false);
    setEditingUser(null);
    refreshUsers();
  }

  // Handle edit button click
  function handleEdit(user: UserWithRole) {
    setEditingUser(user);
    setEditModalOpen(true);
  }

  // Handle reset password
  async function handleResetPassword(userId: string) {
    try {
      const result = await resetUserPassword(userId);
      setResetPasswordData(result.data.temporaryPassword);
      setResetPasswordModalOpen(true);
      refreshUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reset password");
    }
  }

  // Handle delete button click
  function handleDeleteClick(user: UserWithRole) {
    setDeletingUser(user);
    setDeleteModalOpen(true);
  }

  // Handle delete confirm
  async function handleDeleteConfirm() {
    if (!deletingUser) return;

    setDeleteLoading(true);
    try {
      await softDeleteUser(deletingUser.id);
      setDeleteModalOpen(false);
      setDeletingUser(null);
      refreshUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete user");
    } finally {
      setDeleteLoading(false);
    }
  }

  // Get filtered users for display
  const filteredUsers = users.filter((user) => {
    if (filter === "active") {
      return user.active && !user.requirePasswordChange;
    } else if (filter === "inactive") {
      return !user.active || user.requirePasswordChange;
    }
    return true;
  });

  return (
    <div className="mt-8">
      {/* Error display */}
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
          <button
            onClick={() => setError("")}
            className="ml-2 font-medium underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Filter tabs and new user button */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex space-x-2">
          <button
            onClick={() => handleFilterChange("all")}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              filter === "all"
                ? "bg-indigo-600 text-white"
                : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
            }`}
          >
            All
          </button>
          <button
            onClick={() => handleFilterChange("active")}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              filter === "active"
                ? "bg-indigo-600 text-white"
                : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
            }`}
          >
            Active
          </button>
          <button
            onClick={() => handleFilterChange("inactive")}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              filter === "inactive"
                ? "bg-indigo-600 text-white"
                : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
            }`}
          >
            Inactive
          </button>
        </div>

        <button
          onClick={() => setCreateModalOpen(true)}
          className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 flex items-center gap-2"
        >
          <svg
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4v16m8-8H4"
            />
          </svg>
          New User
        </button>
      </div>

      {/* Users table */}
      {loading ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          <p className="mt-2 text-sm text-gray-500">Loading users...</p>
        </div>
      ) : (
        <UserTable
          users={filteredUsers}
          onEdit={handleEdit}
          onResetPassword={handleResetPassword}
          onDelete={handleDeleteClick}
        />
      )}

      {/* Create user modal */}
      {createModalOpen && (
        <Sidebar
          isOpen={createModalOpen}
          onClose={() => setCreateModalOpen(false)}
          title="Create New User"
          size="md"
        >
          <UserForm
            mode="create"
            roles={roles}
            onSuccess={handleCreateSuccess}
            onCancel={() => setCreateModalOpen(false)}
          />
        </Sidebar>
      )}

      {/* Edit user sidebar */}
      {editModalOpen && editingUser && (
        <Sidebar
          isOpen={editModalOpen}
          onClose={() => {
            setEditModalOpen(false);
            setEditingUser(null);
          }}
          title="Edit User"
          size="md"
        >
          <UserForm
            mode="edit"
            user={editingUser}
            roles={roles}
            onSuccess={handleEditSuccess}
            onCancel={() => {
              setEditModalOpen(false);
              setEditingUser(null);
            }}
          />
        </Sidebar>
      )}

      {/* Reset password modal */}
      <ResetPasswordSidebar
        isOpen={resetPasswordModalOpen}
        onClose={() => setResetPasswordModalOpen(false)}
        password={resetPasswordData}
      />

      {/* Delete confirmation modal */}
      {deletingUser && (
        <DeleteConfirmationModal
          isOpen={deleteModalOpen}
          onClose={() => {
            setDeleteModalOpen(false);
            setDeletingUser(null);
          }}
          onConfirm={handleDeleteConfirm}
          userName={deletingUser.name || deletingUser.email}
          loading={deleteLoading}
        />
      )}
    </div>
  );
}
