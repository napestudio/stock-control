"use client";

import { useState, useTransition, useOptimistic } from "react";
import type {
  CashRegisterWithStats,
  CashRegisterOptimisticAction,
} from "@/types/cash-register";
import {
  getCashRegisters,
  deleteCashRegister,
} from "@/app/actions/cash-register-actions";
import CashRegisterTable from "@/components/cash-registers/cash-register-table";
import CashRegisterFormSidebar from "@/components/cash-registers/cash-register-form-sidebar";
import DeleteRegisterModal from "@/components/cash-registers/delete-register-modal";
import OpenSessionSidebar from "@/components/cash-registers/open-session-sidebar";
import CloseSessionSidebar from "@/components/cash-registers/close-session-sidebar";
import ActiveSessionPanel from "@/components/cash-registers/active-session-panel";
import CashMovementFormSidebar from "@/components/cash-registers/cash-movement-form-sidebar";
import { Button } from "@/components/ui/button";

interface CashRegisterManagementClientProps {
  initialRegisters: CashRegisterWithStats[];
}

export default function CashRegisterManagementClient({
  initialRegisters,
}: CashRegisterManagementClientProps) {
  const [registers, setRegisters] = useState(initialRegisters);

  // Optimistic updates for instant feedback
  const [optimisticRegisters, addOptimisticUpdate] = useOptimistic(
    registers,
    (state: CashRegisterWithStats[], action: CashRegisterOptimisticAction) => {
      switch (action.type) {
        case "create":
          return [...state, action.register];
        case "update":
          return state.map((r) => (r.id === action.id ? { ...r, ...action.data } : r));
        case "delete":
          return state.filter((r) => r.id !== action.id);
        default:
          return state;
      }
    }
  );

  const [isPending, startTransition] = useTransition();

  // Modal states
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingRegister, setEditingRegister] = useState<CashRegisterWithStats | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletingRegister, setDeletingRegister] = useState<CashRegisterWithStats | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Session modals
  const [openSessionModalOpen, setOpenSessionModalOpen] = useState(false);
  const [selectedRegisterId, setSelectedRegisterId] = useState<string>("");
  const [closeSessionModalOpen, setCloseSessionModalOpen] = useState(false);
  const [closingSessionId, setClosingSessionId] = useState<string>("");
  const [movementModalOpen, setMovementModalOpen] = useState(false);
  const [movementSessionId, setMovementSessionId] = useState<string>("");

  // Error state
  const [error, setError] = useState("");

  // Refresh registers list
  async function refreshRegisters() {
    try {
      const fetchedRegisters = await getCashRegisters();
      setRegisters(fetchedRegisters);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar cajas");
    }
  }

  // Handle create success
  function handleCreateSuccess() {
    setCreateModalOpen(false);
    refreshRegisters();
  }

  // Handle edit success
  function handleEditSuccess() {
    setEditModalOpen(false);
    setEditingRegister(null);
    refreshRegisters();
  }

  // Handle edit click
  function handleEdit(register: CashRegisterWithStats) {
    setEditingRegister(register);
    setEditModalOpen(true);
  }

  // Handle delete click
  function handleDeleteClick(register: CashRegisterWithStats) {
    setDeletingRegister(register);
    setDeleteModalOpen(true);
  }

  // Handle delete confirm
  async function handleDeleteConfirm() {
    if (!deletingRegister) return;

    setDeleteLoading(true);
    setError("");

    startTransition(async () => {
      try {
        // Optimistic update
        addOptimisticUpdate({
          type: "delete",
          id: deletingRegister.id,
        });

        await deleteCashRegister(deletingRegister.id);
        await refreshRegisters();
        setDeleteModalOpen(false);
        setDeletingRegister(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al eliminar caja");
      } finally {
        setDeleteLoading(false);
      }
    });
  }

  // Handle open session click
  function handleOpenSession(registerId: string) {
    setSelectedRegisterId(registerId);
    setOpenSessionModalOpen(true);
  }

  // Handle open session success
  function handleOpenSessionSuccess() {
    setOpenSessionModalOpen(false);
    setSelectedRegisterId("");
    refreshRegisters();
  }

  // Handle close session click
  function handleCloseSession(sessionId: string) {
    setClosingSessionId(sessionId);
    setCloseSessionModalOpen(true);
  }

  // Handle close session success
  function handleCloseSessionSuccess() {
    setCloseSessionModalOpen(false);
    setClosingSessionId("");
    refreshRegisters();
  }

  // Handle add movement click
  function handleAddMovement(sessionId: string) {
    setMovementSessionId(sessionId);
    setMovementModalOpen(true);
  }

  // Handle add movement success
  function handleAddMovementSuccess() {
    setMovementModalOpen(false);
    setMovementSessionId("");
    refreshRegisters();
  }

  return (
    <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
      {/* Error Display */}
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* Active Session Panel */}
      <div className="mb-6">
        <ActiveSessionPanel
          onCloseSession={handleCloseSession}
          onAddMovement={handleAddMovement}
        />
      </div>

      {/* Header with Create Button */}
      <div className="mb-6 flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Cajas Registradoras</h2>
        <Button onClick={() => setCreateModalOpen(true)}>Nueva Caja</Button>
      </div>

      {/* Cash Registers Table */}
      <CashRegisterTable
        registers={optimisticRegisters}
        onEdit={handleEdit}
        onDelete={handleDeleteClick}
        onOpenSession={handleOpenSession}
      />

      {/* Create Modal */}
      <CashRegisterFormSidebar
        mode="create"
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onSuccess={handleCreateSuccess}
      />

      {/* Edit Modal */}
      {editingRegister && (
        <CashRegisterFormSidebar
          mode="edit"
          register={editingRegister}
          isOpen={editModalOpen}
          onClose={() => {
            setEditModalOpen(false);
            setEditingRegister(null);
          }}
          onSuccess={handleEditSuccess}
        />
      )}

      {/* Delete Modal */}
      <DeleteRegisterModal
        isOpen={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false);
          setDeletingRegister(null);
        }}
        onConfirm={handleDeleteConfirm}
        registerName={deletingRegister?.name || ""}
        loading={deleteLoading}
      />

      {/* Open Session Modal */}
      <OpenSessionSidebar
        registers={registers}
        selectedRegisterId={selectedRegisterId}
        isOpen={openSessionModalOpen}
        onClose={() => {
          setOpenSessionModalOpen(false);
          setSelectedRegisterId("");
        }}
        onSuccess={handleOpenSessionSuccess}
      />

      {/* Close Session Modal */}
      {closingSessionId && (
        <CloseSessionSidebar
          sessionId={closingSessionId}
          isOpen={closeSessionModalOpen}
          onClose={() => {
            setCloseSessionModalOpen(false);
            setClosingSessionId("");
          }}
          onSuccess={handleCloseSessionSuccess}
        />
      )}

      {/* Cash Movement Modal */}
      {movementSessionId && (
        <CashMovementFormSidebar
          sessionId={movementSessionId}
          isOpen={movementModalOpen}
          onClose={() => {
            setMovementModalOpen(false);
            setMovementSessionId("");
          }}
          onSuccess={handleAddMovementSuccess}
        />
      )}
    </div>
  );
}
