"use client";

import type { SessionClosingSummary } from "@/types/cash-session";

interface PaymentSummaryCardProps {
  summary: SessionClosingSummary;
}

export default function PaymentSummaryCard({ summary }: PaymentSummaryCardProps) {
  return (
    <div className="bg-gray-50 rounded-lg p-4 space-y-3">
      <h4 className="font-medium text-gray-900">Resumen de Pagos</h4>

      {/* Opening Amount */}
      <div className="flex justify-between text-sm">
        <span className="text-gray-600">Monto Inicial:</span>
        <span className="font-medium">${summary.openingAmount.toFixed(2)}</span>
      </div>

      <div className="border-t border-gray-300 my-2"></div>

      {/* Sales by Payment Method */}
      <div className="space-y-2">
        <p className="text-sm font-medium text-gray-700">Ventas:</p>

        <div className="flex justify-between text-sm pl-4">
          <span className="text-gray-600">Efectivo:</span>
          <span className="font-medium text-green-600">
            ${summary.cashSalesTotal.toFixed(2)}
          </span>
        </div>

        <div className="flex justify-between text-sm pl-4">
          <span className="text-gray-600">Tarjeta de Crédito:</span>
          <span className="font-medium">${summary.creditCardSalesTotal.toFixed(2)}</span>
        </div>

        <div className="flex justify-between text-sm pl-4">
          <span className="text-gray-600">Tarjeta de Débito:</span>
          <span className="font-medium">${summary.debitCardSalesTotal.toFixed(2)}</span>
        </div>

        <div className="flex justify-between text-sm pl-4">
          <span className="text-gray-600">Transferencia:</span>
          <span className="font-medium">${summary.transferSalesTotal.toFixed(2)}</span>
        </div>

        <div className="flex justify-between text-sm pl-4">
          <span className="text-gray-600">Cheque:</span>
          <span className="font-medium">${summary.checkSalesTotal.toFixed(2)}</span>
        </div>

        <div className="flex justify-between text-sm pl-4">
          <span className="text-gray-600">Otro:</span>
          <span className="font-medium">${summary.otherSalesTotal.toFixed(2)}</span>
        </div>

        <div className="flex justify-between text-sm pl-4 font-medium border-t border-gray-200 pt-1">
          <span className="text-gray-700">Total Ventas:</span>
          <span>${summary.salesTotal.toFixed(2)}</span>
        </div>
      </div>

      <div className="border-t border-gray-300 my-2"></div>

      {/* Cash Movements */}
      <div className="space-y-2">
        <p className="text-sm font-medium text-gray-700">Movimientos de Efectivo:</p>

        {summary.depositsTotal > 0 && (
          <div className="flex justify-between text-sm pl-4">
            <span className="text-gray-600">Depósitos:</span>
            <span className="font-medium text-green-600">
              +${summary.depositsTotal.toFixed(2)}
            </span>
          </div>
        )}

        {summary.withdrawalsTotal > 0 && (
          <div className="flex justify-between text-sm pl-4">
            <span className="text-gray-600">Retiros:</span>
            <span className="font-medium text-red-600">
              -${summary.withdrawalsTotal.toFixed(2)}
            </span>
          </div>
        )}

        {summary.expensesTotal > 0 && (
          <div className="flex justify-between text-sm pl-4">
            <span className="text-gray-600">Gastos:</span>
            <span className="font-medium text-red-600">
              -${summary.expensesTotal.toFixed(2)}
            </span>
          </div>
        )}

        {summary.depositsTotal === 0 &&
          summary.withdrawalsTotal === 0 &&
          summary.expensesTotal === 0 && (
            <div className="text-sm pl-4 text-gray-500 italic">Sin movimientos</div>
          )}
      </div>

      <div className="border-t border-gray-300 my-2"></div>

      {/* Expected Cash */}
      <div className="flex justify-between text-sm font-medium bg-blue-50 p-2 rounded">
        <span className="text-blue-900">Efectivo Esperado:</span>
        <span className="text-blue-900 text-lg">${summary.expectedCash.toFixed(2)}</span>
      </div>

      <div className="text-xs text-gray-500 mt-2 bg-yellow-50 p-2 rounded">
        <p className="font-medium text-gray-700">Nota:</p>
        <p className="mt-1">
          El efectivo esperado solo incluye movimientos pagados en efectivo.
        </p>
        <p className="mt-1">
          Fórmula: Inicial + Ventas (efectivo) + Depósitos (efectivo) - Retiros (efectivo) - Gastos (efectivo)
        </p>
      </div>
    </div>
  );
}
