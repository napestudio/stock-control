"use client";

import { useState, useEffect } from "react";
import { getMyActiveSession } from "@/app/actions/cash-session-actions";
import Badge from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

interface ActiveSessionPanelProps {
  onCloseSession: (sessionId: string) => void;
  onAddMovement: (sessionId: string) => void;
}

export default function ActiveSessionPanel({
  onCloseSession,
  onAddMovement,
}: ActiveSessionPanelProps) {
  const [session, setSession] =
    useState<Awaited<ReturnType<typeof getMyActiveSession>>>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadSession() {
    try {
      setLoading(true);
      const data = await getMyActiveSession();
      setSession(data);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar sesión");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSession();
  }, []);

  if (loading) {
    return (
      <div className="bg-white shadow rounded-lg p-6">
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-2 text-sm text-gray-600">Cargando sesión...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white shadow rounded-lg p-6">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="bg-white shadow rounded-lg p-6">
        <div className="text-center py-8">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
            />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">
            No hay sesión activa
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            Abra una sesión de caja para comenzar a trabajar.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-medium text-gray-900">Sesión Activa</h3>
          <Badge variant="success">ABIERTA</Badge>
        </div>
        <button
          onClick={loadSession}
          className="text-sm text-gray-600 hover:text-gray-900"
          title="Actualizar"
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
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
        </button>
      </div>

      {/* Session Info */}
      <div className="mb-6 space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">Caja:</span>
          <span className="font-medium text-gray-900">
            {session.cashRegister.name}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">Apertura:</span>
          <span className="font-medium text-gray-900">
            {formatDistanceToNow(new Date(session.openedAt), {
              addSuffix: true,
              locale: es,
            })}
          </span>
        </div>
        <div className="flex justify-between items-center pt-3 border-t border-gray-200">
          <span className="text-sm text-gray-600">Monto Inicial:</span>
          <span className="font-semibold text-lg text-gray-900">
            ${session.openingAmount.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <button
          onClick={() => onAddMovement(session.id)}
          className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          Agregar Movimiento
        </button>
        <button
          onClick={() => onCloseSession(session.id)}
          className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700 transition-colors"
        >
          Finalizar Arqueo
        </button>
      </div>
    </div>
  );
}
