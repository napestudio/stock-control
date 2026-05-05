"use client";

import { useState, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  openSessionSchema,
  type OpenSessionInput,
} from "@/lib/validations/cash-session-schema";
import { openCashSession } from "@/app/actions/cash-session-actions";
import FormInput from "@/components/ui/form-input";
import Sidebar from "@/components/ui/sidebar";
import type { CashRegisterWithStats } from "@/types/cash-register";

interface OpenSessionSidebarProps {
  registers: CashRegisterWithStats[];
  selectedRegisterId?: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function OpenSessionSidebar({
  registers,
  selectedRegisterId,
  isOpen,
  onClose,
  onSuccess,
}: OpenSessionSidebarProps) {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Filter only active registers without active sessions
  // Memoize to prevent recreating on every render
  const availableRegisters = useMemo(
    () => registers.filter((r) => r.active && !r.hasActiveSession),
    [registers],
  );

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<OpenSessionInput>({
    resolver: zodResolver(openSessionSchema),
    defaultValues: {
      cashRegisterId: "",
      openingAmount: 0,
    },
  });

  // Update form when sidebar opens or registers change
  useEffect(() => {
    if (isOpen) {
      const defaultRegisterId =
        selectedRegisterId || availableRegisters[0]?.id || "";
      reset({
        cashRegisterId: defaultRegisterId,
        openingAmount: 0,
      });
    }
  }, [isOpen, selectedRegisterId, availableRegisters, reset]);

  async function onSubmit(data: OpenSessionInput) {
    setError("");
    setLoading(true);

    try {
      await openCashSession(data);
      onSuccess();
      onClose();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Ocurrió un error al abrir la sesión",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <Sidebar
      isOpen={isOpen}
      onClose={onClose}
      title="Iniciar Arqueo de Caja"
      size="md"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        {availableRegisters.length === 0 ? (
          <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded">
            <p>No hay cajas disponibles para iniciar arqueo.</p>
            <p className="text-sm mt-1">
              Todas las cajas activas tienen sesiones abiertas o no hay cajas
              registradas.
            </p>
          </div>
        ) : (
          <>
            <div>
              <label
                htmlFor="cashRegisterId"
                className="block text-sm font-medium text-gray-700"
              >
                Caja Registradora <span className="text-red-500">*</span>
              </label>
              <select
                id="cashRegisterId"
                {...register("cashRegisterId")}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              >
                {availableRegisters.map((reg) => (
                  <option key={reg.id} value={reg.id}>
                    {reg.name}
                  </option>
                ))}
              </select>
              {errors.cashRegisterId && (
                <p className="mt-1 text-sm text-red-600">
                  {errors.cashRegisterId.message}
                </p>
              )}
            </div>

            <FormInput
              label="Monto Inicial (Apertura)"
              type="number"
              step="0.01"
              min="0"
              {...register("openingAmount", { valueAsNumber: true })}
              error={errors.openingAmount?.message}
              required
              placeholder="0.00"
            />

            {/* <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded text-sm">
              <p className="font-medium">Información:</p>
              <ul className="list-disc list-inside mt-1 space-y-1">
                <li>
                  El monto inicial es el efectivo con el que abre la caja.
                </li>
                <li>
                  Al cerrar la sesión, se comparará con el efectivo contado.
                </li>
                <li>Solo puede tener una sesión activa a la vez.</li>
              </ul>
            </div> */}
          </>
        )}

        <div className="flex justify-end gap-3 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
            disabled={loading}
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading || availableRegisters.length === 0}
            className="px-4 py-2 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Iniciando..." : "Iniciar Arqueo"}
          </button>
        </div>
      </form>
    </Sidebar>
  );
}
