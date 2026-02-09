"use client";

import { useState, useEffect } from "react";
import { getMyActiveSession } from "@/app/actions/cash-session-actions";
import Badge from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { PaymentMethod } from "@prisma/client";

interface ActiveSessionPanelProps {
  onCloseSession: (sessionId: string) => void;
  onAddMovement: (sessionId: string) => void;
}

export default function ActiveSessionPanel({
  onCloseSession,
  onAddMovement,
}: ActiveSessionPanelProps) {
  const [session, setSession] = useState<Awaited<ReturnType<typeof getMyActiveSession>>>(null);
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
          <h3 className="mt-2 text-sm font-medium text-gray-900">No hay sesión activa</h3>
          <p className="mt-1 text-sm text-gray-500">
            Abra una sesión de caja para comenzar a trabajar.
          </p>
        </div>
      </div>
    );
  }

  // Calculate totals by payment method
  const totals = {
    cash: 0,
    creditCard: 0,
    debitCard: 0,
    transfer: 0,
    check: 0,
    other: 0,
  };

  session.sales.forEach((sale) => {
    sale.payments.forEach((payment) => {
      switch (payment.method) {
        case PaymentMethod.CASH:
          totals.cash += payment.amount;
          break;
        case PaymentMethod.CREDIT_CARD:
          totals.creditCard += payment.amount;
          break;
        case PaymentMethod.DEBIT_CARD:
          totals.debitCard += payment.amount;
          break;
        case PaymentMethod.TRANSFER:
          totals.transfer += payment.amount;
          break;
        case PaymentMethod.CHECK:
          totals.check += payment.amount;
          break;
        case PaymentMethod.OTHER:
          totals.other += payment.amount;
          break;
      }
    });
  });

  const totalSales =
    totals.cash +
    totals.creditCard +
    totals.debitCard +
    totals.transfer +
    totals.check +
    totals.other;

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-medium text-gray-900">Sesión Activa</h3>
          <Badge variant="success">ABIERTA</Badge>
        </div>
        <button
          onClick={loadSession}
          className="text-sm text-gray-600 hover:text-gray-900"
          title="Actualizar"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
      <div className="grid grid-cols-2 gap-4 mb-4 pb-4 border-b border-gray-200">
        <div>
          <p className="text-sm text-gray-600">Caja:</p>
          <p className="font-medium">{session.cashRegister.name}</p>
        </div>
        <div>
          <p className="text-sm text-gray-600">Apertura:</p>
          <p className="font-medium">
            {formatDistanceToNow(new Date(session.openedAt), {
              addSuffix: true,
              locale: es,
            })}
          </p>
        </div>
        <div>
          <p className="text-sm text-gray-600">Monto Inicial:</p>
          <p className="font-medium text-lg">${session.openingAmount.toFixed(2)}</p>
        </div>
        <div>
          <p className="text-sm text-gray-600">Ventas:</p>
          <p className="font-medium">{session.sales.length} transacciones</p>
        </div>
      </div>

      {/* Sales by Payment Method */}
      <div className="mb-4">
        <h4 className="text-sm font-medium text-gray-700 mb-2">Ventas por Método de Pago:</h4>
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-green-50 p-3 rounded">
            <p className="text-xs text-gray-600">Efectivo</p>
            <p className="text-lg font-semibold text-green-700">${totals.cash.toFixed(2)}</p>
          </div>
          <div className="bg-blue-50 p-3 rounded">
            <p className="text-xs text-gray-600">T. Crédito</p>
            <p className="text-lg font-semibold text-blue-700">${totals.creditCard.toFixed(2)}</p>
          </div>
          <div className="bg-indigo-50 p-3 rounded">
            <p className="text-xs text-gray-600">T. Débito</p>
            <p className="text-lg font-semibold text-indigo-700">${totals.debitCard.toFixed(2)}</p>
          </div>
          <div className="bg-purple-50 p-3 rounded">
            <p className="text-xs text-gray-600">Transferencia</p>
            <p className="text-lg font-semibold text-purple-700">${totals.transfer.toFixed(2)}</p>
          </div>
          <div className="bg-yellow-50 p-3 rounded">
            <p className="text-xs text-gray-600">Cheque</p>
            <p className="text-lg font-semibold text-yellow-700">${totals.check.toFixed(2)}</p>
          </div>
          <div className="bg-gray-100 p-3 rounded">
            <p className="text-xs text-gray-600">Otro</p>
            <p className="text-lg font-semibold text-gray-700">${totals.other.toFixed(2)}</p>
          </div>
        </div>
        <div className="mt-3 bg-slate-50 p-3 rounded border-2 border-slate-200">
          <p className="text-xs text-gray-600">Total Ventas</p>
          <p className="text-xl font-bold text-slate-700">${totalSales.toFixed(2)}</p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <button
          onClick={() => onAddMovement(session.id)}
          className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700"
        >
          Agregar Movimiento
        </button>
        <button
          onClick={() => onCloseSession(session.id)}
          className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700"
        >
          Cerrar Sesión
        </button>
      </div>
    </div>
  );
}
