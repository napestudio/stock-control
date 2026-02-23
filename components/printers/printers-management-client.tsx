"use client";

import { useState, useTransition } from "react";
import { getPrinters, deletePrinter } from "@/app/actions/printer-actions";
import PrinterTable from "@/components/printers/printer-table";
import PrinterFormSidebar from "@/components/printers/printer-form-sidebar";
import DeletePrinterModal from "@/components/printers/delete-printer-modal";
import { Button } from "@/components/ui/button";
import type { PrinterSerialized } from "@/types/printer";
import type { CashRegisterWithStats } from "@/types/cash-register";

interface PrintersManagementClientProps {
  initialPrinters: PrinterSerialized[];
  cashRegisters: CashRegisterWithStats[];
}

export default function PrintersManagementClient({
  initialPrinters,
  cashRegisters,
}: PrintersManagementClientProps) {
  const [printers, setPrinters] = useState<PrinterSerialized[]>(initialPrinters);
  const [isPending, startTransition] = useTransition();

  const [createSidebarOpen, setCreateSidebarOpen] = useState(false);
  const [editSidebarOpen, setEditSidebarOpen] = useState(false);
  const [editingPrinter, setEditingPrinter] = useState<PrinterSerialized | null>(null);

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletingPrinter, setDeletingPrinter] = useState<PrinterSerialized | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [error, setError] = useState("");

  async function refreshPrinters() {
    try {
      const updated = await getPrinters();
      setPrinters(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al actualizar la lista");
    }
  }

  function handleCreateSuccess() {
    setCreateSidebarOpen(false);
    startTransition(() => {
      refreshPrinters();
    });
  }

  function handleEditSuccess() {
    setEditSidebarOpen(false);
    setEditingPrinter(null);
    startTransition(() => {
      refreshPrinters();
    });
  }

  function handleEdit(printer: PrinterSerialized) {
    setEditingPrinter(printer);
    setEditSidebarOpen(true);
  }

  function handleDeleteClick(printer: PrinterSerialized) {
    setDeletingPrinter(printer);
    setDeleteModalOpen(true);
  }

  async function handleDeleteConfirm() {
    if (!deletingPrinter) return;

    setDeleteLoading(true);
    setError("");

    // Optimistic update
    setPrinters((prev) => prev.filter((p) => p.id !== deletingPrinter.id));
    setDeleteModalOpen(false);

    try {
      await deletePrinter({ id: deletingPrinter.id });
      setDeletingPrinter(null);
    } catch (err) {
      // Revert optimistic update on error
      setPrinters((prev) => [...prev, deletingPrinter]);
      setError(err instanceof Error ? err.message : "Error al eliminar la impresora");
      setDeleteModalOpen(true);
    } finally {
      setDeleteLoading(false);
    }
  }

  return (
    <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      <div className="mb-6 flex justify-between items-center">
        <div>
          <p className="text-sm text-gray-500">
            {printers.length === 0
              ? "No hay impresoras configuradas"
              : `${printers.length} impresora${printers.length !== 1 ? "s" : ""} configurada${printers.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        <Button onClick={() => setCreateSidebarOpen(true)} disabled={isPending}>
          Nueva Impresora
        </Button>
      </div>

      <PrinterTable
        printers={printers}
        onEdit={handleEdit}
        onDelete={handleDeleteClick}
      />

      <PrinterFormSidebar
        mode="create"
        cashRegisters={cashRegisters}
        isOpen={createSidebarOpen}
        onClose={() => setCreateSidebarOpen(false)}
        onSuccess={handleCreateSuccess}
      />

      {editingPrinter && (
        <PrinterFormSidebar
          mode="edit"
          printer={editingPrinter}
          cashRegisters={cashRegisters}
          isOpen={editSidebarOpen}
          onClose={() => {
            setEditSidebarOpen(false);
            setEditingPrinter(null);
          }}
          onSuccess={handleEditSuccess}
        />
      )}

      <DeletePrinterModal
        isOpen={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false);
          setDeletingPrinter(null);
        }}
        onConfirm={handleDeleteConfirm}
        printerName={deletingPrinter?.name ?? ""}
        loading={deleteLoading}
      />
    </div>
  );
}
