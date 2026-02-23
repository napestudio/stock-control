"use client";

import { useState } from "react";
import { PaymentMethod } from "@prisma/client";
import type { PaymentEntry } from "@/lib/validations/sale-schema";
import { Button } from "@/components/ui/button";

interface PaymentBreakdownProps {
  total: number;
  onPaymentsChange: (payments: PaymentEntry[]) => void;
  disabled?: boolean;
}

type PaymentRow = {
  method: PaymentMethod;
  amount: string;
};

const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: "Efectivo",
  CREDIT_CARD: "Tarjeta de Crédito",
  DEBIT_CARD: "Tarjeta de Débito",
  TRANSFER: "Transferencia",
  CHECK: "Cheque",
};

export default function PaymentBreakdown({
  total,
  onPaymentsChange,
  disabled = false,
}: PaymentBreakdownProps) {
  const [rows, setRows] = useState<PaymentRow[]>([
    { method: PaymentMethod.CASH, amount: "" },
  ]);

  function updateRows(newRows: PaymentRow[]) {
    setRows(newRows);
    const validPayments: PaymentEntry[] = newRows
      .map((row) => ({
        method: row.method,
        amount: parseFloat(row.amount) || 0,
      }))
      .filter((p) => p.amount > 0);
    onPaymentsChange(validPayments);
  }

  function handleMethodChange(index: number, method: PaymentMethod) {
    const newRows = [...rows];
    newRows[index] = { ...newRows[index], method };
    updateRows(newRows);
  }

  function handleAmountChange(index: number, value: string) {
    const newRows = [...rows];
    newRows[index] = { ...newRows[index], amount: value };
    updateRows(newRows);
  }

  function handleAddRow() {
    updateRows([...rows, { method: PaymentMethod.CASH, amount: "" }]);
  }

  function handleRemoveRow(index: number) {
    updateRows(rows.filter((_, i) => i !== index));
  }

  const paymentsTotal = rows.reduce(
    (sum, r) => sum + (parseFloat(r.amount) || 0),
    0,
  );
  const remaining = total - paymentsTotal;
  const isComplete = Math.abs(remaining) < 0.01;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-900">Pago</h3>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleAddRow}
          disabled={disabled}
        >
          + Dividir pago
        </Button>
      </div>

      <div className="space-y-2">
        {rows.map((row, index) => (
          <div key={index} className="flex items-center gap-2">
            <select
              value={row.method}
              onChange={(e) =>
                handleMethodChange(index, e.target.value as PaymentMethod)
              }
              disabled={disabled}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 text-sm"
            >
              {Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>

            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">
                $
              </span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={row.amount}
                onChange={(e) => handleAmountChange(index, e.target.value)}
                disabled={disabled}
                placeholder="0.00"
                className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 text-sm"
              />
            </div>

            {rows.length > 1 && (
              <button
                type="button"
                onClick={() => handleRemoveRow(index)}
                disabled={disabled}
                className="text-gray-400 hover:text-gray-600 disabled:opacity-50 px-1 text-lg leading-none"
              >
                ×
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Summary */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm space-y-1">
        <div className="flex justify-between items-center">
          <span className="text-gray-700">Total:</span>

          <span className="font-bold text-gray-900 flex items-center gap-1 relative">
            {isComplete && (
              <div className="absolute text-green-700 border w-5 h-5 -left-8 border-green-700 rounded-full font-medium text-center">
                ✓
              </div>
            )}
            ${total.toLocaleString("es-Ar")}
          </span>
        </div>
        {paymentsTotal > 0 && !isComplete && (
          <div className="flex justify-between items-center pt-1 border-t border-blue-200">
            <span className="text-gray-600">Restante:</span>
            <span
              className={`font-medium ${remaining > 0 ? "text-red-600" : "text-yellow-600"}`}
            >
              ${Math.abs(remaining).toLocaleString("es-Ar")}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
