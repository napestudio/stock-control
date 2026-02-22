"use client";

import { useState, useEffect } from "react";
import { PaymentMethod } from "@prisma/client";
import type { PaymentEntry } from "@/lib/validations/sale-schema";
import { Button } from "@/components/ui/button";

interface PaymentBreakdownProps {
  total: number;
  payments: PaymentEntry[];
  onPaymentsChange: (payments: PaymentEntry[]) => void;
  onCurrentChange?: (method: PaymentMethod, amount: number) => void;
  disabled?: boolean;
}

const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: "Efectivo",
  CREDIT_CARD: "Tarjeta de Crédito",
  DEBIT_CARD: "Tarjeta de Débito",
  TRANSFER: "Transferencia",
  CHECK: "Cheque",
};

export default function PaymentBreakdown({
  total,
  payments,
  onPaymentsChange,
  onCurrentChange,
  disabled = false,
}: PaymentBreakdownProps) {
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>(
    PaymentMethod.CASH,
  );
  // null means "use auto-fill (remaining)"; a string means user has manually typed a value
  const [manualAmount, setManualAmount] = useState<string | null>(null);

  const paymentsTotal = payments.reduce((sum, p) => sum + p.amount, 0);
  const remaining = total - paymentsTotal;
  const isComplete = Math.abs(remaining) < 0.01; // Allow 1 cent difference for rounding

  const amount =
    manualAmount ?? (remaining > 0.01 ? remaining.toFixed(2) : "");

  // Notify parent of the current pending selection so it can enable submit
  useEffect(() => {
    onCurrentChange?.(selectedMethod, parseFloat(amount) || 0);
  }, [selectedMethod, amount, onCurrentChange]);

  function handleAddPayment() {
    const numAmount = parseFloat(amount);

    if (!numAmount || numAmount <= 0) {
      return;
    }

    if (numAmount > remaining + 0.01) {
      alert(
        `El monto no puede exceder el restante (${remaining.toLocaleString("es-Ar")})`,
      );
      return;
    }

    const newPayment: PaymentEntry = {
      method: selectedMethod,
      amount: numAmount,
    };

    onPaymentsChange([...payments, newPayment]);
    setManualAmount(null); // Reset to auto-fill with new remaining
  }

  function handleRemovePayment(index: number) {
    const newPayments = payments.filter((_, i) => i !== index);
    onPaymentsChange(newPayments);
  }

  function handleKeyPress(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddPayment();
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium text-gray-900">
          Métodos de Pago
        </h3>
      </div>

      {/* Payment summary */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium text-gray-700">Total:</span>
          <span className="text-lg font-bold text-gray-900">
            ${total.toLocaleString("es-Ar")}
          </span>
        </div>
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium text-gray-700">Pagado:</span>
          <span className="text-lg font-bold text-green-600">
            ${paymentsTotal.toLocaleString("es-Ar")}
          </span>
        </div>
        <div className="flex justify-between items-center pt-2 border-t border-blue-300">
          <span className="text-sm font-medium text-gray-700">Restante:</span>
          <span
            className={`text-lg font-bold ${
              remaining > 0.01
                ? "text-red-600"
                : Math.abs(remaining) < 0.01
                  ? "text-green-600"
                  : "text-yellow-600"
            }`}
          >
            ${Math.abs(remaining).toLocaleString("es-Ar")}
          </span>
        </div>
      </div>

      {/* Payment entries */}
      {payments.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-700">
            Pagos registrados:
          </p>
          {payments.map((payment, index) => (
            <div
              key={index}
              className="flex justify-between items-center p-3 bg-gray-50 rounded-lg border border-gray-200"
            >
              <div>
                <p className="font-medium text-gray-900">
                  {PAYMENT_METHOD_LABELS[payment.method]}
                </p>
                <p className="text-sm text-gray-600">
                  ${payment.amount.toLocaleString("es-Ar")}
                </p>
              </div>
              <button
                onClick={() => handleRemovePayment(index)}
                disabled={disabled}
                className="text-red-600 hover:text-red-800 disabled:opacity-50"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add payment */}
      {!isComplete && (
        <div className="space-y-3">
          <div>
            <label
              htmlFor="payment-method"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Método de pago
            </label>
            <select
              id="payment-method"
              value={selectedMethod}
              onChange={(e) =>
                setSelectedMethod(e.target.value as PaymentMethod)
              }
              disabled={disabled}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
            >
              {Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="payment-amount"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Monto
            </label>
            <input
              id="payment-amount"
              type="number"
              step="0.01"
              min="0.01"
              max={remaining}
              value={amount}
              onChange={(e) => setManualAmount(e.target.value)}
              onKeyUp={handleKeyPress}
              disabled={disabled}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
              placeholder="0.00"
            />
          </div>

          <Button
            type="button"
            onClick={handleAddPayment}
            disabled={disabled || !amount || parseFloat(amount) <= 0}
            className="w-full"
          >
            Dividir Pago
          </Button>
        </div>
      )}

      {/* Status message */}
      {isComplete && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
          <p className="text-sm font-medium text-green-800 text-center">
            ✓ Pago completo
          </p>
        </div>
      )}

      {remaining < -0.01 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <p className="text-sm font-medium text-yellow-800 text-center">
            ⚠️ El total de pagos excede el monto de la venta
          </p>
        </div>
      )}
    </div>
  );
}
