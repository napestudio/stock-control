"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { closeSessionSchema, type CloseSessionInput } from "@/lib/validations/cash-session-schema";
import {
  closeCashSession,
  getSessionClosingSummary,
} from "@/app/actions/cash-session-actions";
import FormInput from "@/components/ui/form-input";
import Sidebar from "@/components/ui/sidebar";
import PaymentSummaryCard from "./payment-summary-card";
import type { SessionClosingSummary } from "@/types/cash-session";

interface CloseSessionSidebarProps {
  sessionId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function CloseSessionSidebar({
  sessionId,
  isOpen,
  onClose,
  onSuccess,
}: CloseSessionSidebarProps) {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [summary, setSummary] = useState<SessionClosingSummary | null>(null);
  const [difference, setDifference] = useState<number | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<CloseSessionInput>({
    resolver: zodResolver(closeSessionSchema),
    defaultValues: {
      sessionId,
      closingAmount: 0,
    },
  });

  const closingAmount = watch("closingAmount");

  // Load summary
  useEffect(() => {
    if (isOpen && sessionId) {
      setLoadingSummary(true);
      getSessionClosingSummary(sessionId)
        .then((data) => {
          setSummary(data);
          setLoadingSummary(false);
        })
        .catch((err) => {
          setError(err instanceof Error ? err.message : "Error al cargar el resumen");
          setLoadingSummary(false);
        });
    }
  }, [isOpen, sessionId]);

  // Calculate difference when closing amount changes
  useEffect(() => {
    if (summary && closingAmount !== undefined) {
      const diff = closingAmount - summary.expectedCash;
      setDifference(diff);
    }
  }, [closingAmount, summary]);

  async function onSubmit(data: CloseSessionInput) {
    setError("");
    setLoading(true);

    try {
      await closeCashSession(data);
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ocurrió un error al cerrar la sesión");
    } finally {
      setLoading(false);
    }
  }

  // Color coding for difference
  function getDifferenceColor(diff: number): string {
    if (diff === 0) return "text-green-600";
    if (Math.abs(diff) < 10) return "text-yellow-600";
    return "text-red-600";
  }

  function getDifferenceBackgroundColor(diff: number): string {
    if (diff === 0) return "bg-green-50 border-green-200";
    if (Math.abs(diff) < 10) return "bg-yellow-50 border-yellow-200";
    return "bg-red-50 border-red-200";
  }

  return (
    <Sidebar isOpen={isOpen} onClose={onClose} title="Cerrar Sesión de Caja (Arqueo)" size="lg">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        {loadingSummary ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
            <p className="mt-2 text-sm text-gray-600">Cargando resumen...</p>
          </div>
        ) : summary ? (
          <>
            {/* Summary Card */}
            <PaymentSummaryCard summary={summary} />

            {/* Closing Amount Input */}
            <div className="border-t border-gray-200 pt-4">
              <FormInput
                label="Efectivo Contado (Cierre)"
                type="number"
                step="0.01"
                min="0"
                {...register("closingAmount", { valueAsNumber: true })}
                error={errors.closingAmount?.message}
                required
                placeholder="0.00"
                autoFocus
              />
            </div>

            {/* Difference Display */}
            {difference !== null && (
              <div
                className={`border ${getDifferenceBackgroundColor(difference)} p-4 rounded-lg`}
              >
                <div className="flex justify-between items-center">
                  <span className="font-medium text-gray-900">Diferencia:</span>
                  <span className={`text-2xl font-bold ${getDifferenceColor(difference)}`}>
                    {difference >= 0 ? "+" : ""}${difference.toFixed(2)}
                  </span>
                </div>

                {difference === 0 && (
                  <p className="mt-2 text-sm text-green-700">
                    ✓ Perfecto! El efectivo contado coincide con el esperado.
                  </p>
                )}

                {difference !== 0 && Math.abs(difference) < 10 && (
                  <p className="mt-2 text-sm text-yellow-700">
                    ⚠ Diferencia menor a $10. Revise el conteo.
                  </p>
                )}

                {Math.abs(difference) >= 10 && (
                  <p className="mt-2 text-sm text-red-700">
                    ⚠ Diferencia significativa. {difference > 0 ? "Sobrante" : "Faltante"} de $
                    {Math.abs(difference).toFixed(2)}. Verifique el conteo.
                  </p>
                )}
              </div>
            )}

            {/* Confirmation Info */}
            <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded text-sm">
              <p className="font-medium">Antes de cerrar:</p>
              <ul className="list-disc list-inside mt-1 space-y-1">
                <li>Cuente cuidadosamente el efectivo en la caja.</li>
                <li>Verifique que todas las ventas estén registradas.</li>
                <li>Confirme que no hay transacciones pendientes.</li>
                <li>Una vez cerrada, no se puede reabrir esta sesión.</li>
              </ul>
            </div>

            {/* Action Buttons */}
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
                disabled={loading}
                className="px-4 py-2 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Cerrando..." : "Cerrar Sesión"}
              </button>
            </div>
          </>
        ) : (
          <div className="text-center py-8 text-gray-500">
            No se pudo cargar el resumen de la sesión.
          </div>
        )}
      </form>
    </Sidebar>
  );
}
