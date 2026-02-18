"use client";

import type { SessionClosingSummary } from "@/types/cash-session";

interface PaymentSummaryCardProps {
  summary: SessionClosingSummary;
}

interface PaymentMethodBreakdown {
  method: string;
  sales: number;
  income: number;
  expense: number;
  expected: number;
  hasOpeningAmount?: boolean;
  openingAmount?: number;
}

export default function PaymentSummaryCard({
  summary,
}: PaymentSummaryCardProps) {
  // Build payment method breakdowns (only show if expected > 0)
  const paymentMethods: PaymentMethodBreakdown[] = [];

  // CASH - always include with opening amount
  if (summary.expectedCash > 0.01 || summary.openingAmount > 0) {
    paymentMethods.push({
      method: "Efectivo",
      sales: summary.cashSalesTotal,
      income: summary.cashDepositsTotal,
      expense: summary.cashWithdrawalsTotal + summary.cashExpensesTotal,
      expected: summary.expectedCash,
      hasOpeningAmount: true,
      openingAmount: summary.openingAmount,
    });
  }

  // CREDIT CARD
  if (summary.expectedCreditCard > 0.01) {
    paymentMethods.push({
      method: "Tarjeta de Crédito",
      sales: summary.creditCardSalesTotal,
      income: 0, // No breakdown for non-cash manual movements
      expense: 0, // No breakdown for non-cash manual movements
      expected: summary.expectedCreditCard,
    });
  }

  // DEBIT CARD
  if (summary.expectedDebitCard > 0.01) {
    paymentMethods.push({
      method: "Tarjeta de Débito",
      sales: summary.debitCardSalesTotal,
      income: 0, // No breakdown for non-cash manual movements
      expense: 0, // No breakdown for non-cash manual movements
      expected: summary.expectedDebitCard,
    });
  }

  // TRANSFER
  if (summary.expectedTransfer > 0.01) {
    paymentMethods.push({
      method: "Transferencia",
      sales: summary.transferSalesTotal,
      income: 0, // No breakdown for non-cash manual movements
      expense: 0, // No breakdown for non-cash manual movements
      expected: summary.expectedTransfer,
    });
  }

  // CHECK
  if (summary.expectedCheck > 0.01) {
    paymentMethods.push({
      method: "Cheque",
      sales: summary.checkSalesTotal,
      income: 0, // No breakdown for non-cash manual movements
      expense: 0, // No breakdown for non-cash manual movements
      expected: summary.expectedCheck,
    });
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <h4 className="font-semibold text-gray-900">
          Resumen por Método de Pago
        </h4>
        <div className="group relative">
          <svg
            className="h-4 w-4 text-gray-400 hover:text-gray-600 cursor-help"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <div className="absolute right-0 top-6 w-72 bg-gray-900 text-white text-xs rounded-lg p-3 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10 shadow-lg">
            <p className="font-medium mb-1">
              Todos los métodos deben verificarse al cerrar la caja
            </p>
            <ul className="space-y-1 list-disc list-inside">
              <li>Efectivo: Cuente el dinero físico</li>
              <li>Tarjetas: Verifique totales en terminal</li>
              <li>Transferencias: Revise confirmaciones</li>
              <li>Cheques: Cuente los cheques recibidos</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Payment Methods Breakdown */}
      <div className="space-y-4">
        {paymentMethods.map((pm, index) => (
          <div
            key={pm.method}
            className={`${
              index > 0 ? "border-t border-gray-200 pt-4" : ""
            }`}
          >
            {/* Method Name */}
            <h5 className="font-medium text-gray-900 mb-2">{pm.method}</h5>

            {/* Breakdown */}
            <div className="space-y-1.5 text-sm">
              {/* Opening Amount (CASH only) */}
              {pm.hasOpeningAmount && (
                <div className="flex justify-between text-gray-600 pl-3">
                  <span>Monto Inicial:</span>
                  <span className="font-medium">
                    ${pm.openingAmount?.toFixed(2) || "0.00"}
                  </span>
                </div>
              )}

              {/* Sales */}
              {pm.sales > 0 && (
                <div className="flex justify-between text-gray-600 pl-3">
                  <span>Ventas:</span>
                  <span className="font-medium text-green-600">
                    +${pm.sales.toFixed(2)}
                  </span>
                </div>
              )}

              {/* Income (manual - CASH only) */}
              {pm.income > 0 && (
                <div className="flex justify-between text-gray-600 pl-3">
                  <span>Ingresos:</span>
                  <span className="font-medium text-green-600">
                    +${pm.income.toFixed(2)}
                  </span>
                </div>
              )}

              {/* Expense (manual - CASH only) */}
              {pm.expense > 0 && (
                <div className="flex justify-between text-gray-600 pl-3">
                  <span>Egresos:</span>
                  <span className="font-medium text-red-600">
                    -${pm.expense.toFixed(2)}
                  </span>
                </div>
              )}

              {/* Expected Total */}
              <div className="flex justify-between bg-indigo-50 px-3 py-2 rounded mt-2">
                <span className="font-semibold text-indigo-900">Esperado:</span>
                <span className="font-bold text-indigo-900 text-base">
                  ${pm.expected.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Grand Total */}
      <div className="border-t-2 border-gray-300 pt-3">
        <div className="flex justify-between items-center">
          <span className="font-bold text-gray-900">Total General:</span>
          <span className="font-bold text-gray-900 text-xl">
            ${summary.expectedTotal.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Info Note */}
      <div className="text-xs text-gray-500 bg-blue-50 p-3 rounded-lg border border-blue-100">
        <p className="font-medium text-blue-900 mb-1">
          📊 Cómo se calcula el esperado:
        </p>
        <p className="text-blue-800">
          Para cada método de pago, el sistema suma: <strong>Ventas</strong> +{" "}
          <strong>Ingresos manuales</strong> -{" "}
          <strong>Egresos manuales</strong> (+ monto inicial para efectivo).
        </p>
      </div>
    </div>
  );
}
