"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { cashMovementSchema, type CashMovementInput } from "@/lib/validations/cash-session-schema";
import { addCashMovement } from "@/app/actions/cash-session-actions";
import FormInput from "@/components/ui/form-input";
import Sidebar from "@/components/ui/sidebar";
import { CashMovementType, PaymentMethod } from "@prisma/client";

interface CashMovementFormSidebarProps {
  sessionId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function CashMovementFormSidebar({
  sessionId,
  isOpen,
  onClose,
  onSuccess,
}: CashMovementFormSidebarProps) {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
  } = useForm<CashMovementInput>({
    resolver: zodResolver(cashMovementSchema),
    defaultValues: {
      sessionId,
      type: CashMovementType.INCOME,
      paymentMethod: PaymentMethod.CASH,
      amount: 0,
      description: "",
    },
  });

  const selectedType = watch("type");
  const selectedPaymentMethod = watch("paymentMethod");

  async function onSubmit(data: CashMovementInput) {
    setError("");
    setLoading(true);

    try {
      await addCashMovement(data);
      onSuccess();
      reset();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ocurrió un error al agregar el movimiento");
    } finally {
      setLoading(false);
    }
  }

  // Only INCOME and EXPENSE for manual movements
  // SALE and REFUND are created automatically from sales
  const movementTypeOptions = [
    {
      value: CashMovementType.INCOME,
      label: "Ingreso Manual",
      description: "Dinero que ingresa a la caja (ej: depósito inicial, fondeo)",
    },
    {
      value: CashMovementType.EXPENSE,
      label: "Egreso Manual",
      description: "Dinero que sale de la caja (ej: pago a proveedor, retiro de efectivo)",
    },
  ];

  return (
    <Sidebar isOpen={isOpen} onClose={onClose} title="Agregar Movimiento de Efectivo" size="md">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        <div>
          <label htmlFor="type" className="block text-sm font-medium text-gray-700">
            Tipo de Movimiento <span className="text-red-500">*</span>
          </label>
          <select
            id="type"
            {...register("type")}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          >
            {movementTypeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {errors.type && <p className="mt-1 text-sm text-red-600">{errors.type.message}</p>}
          {/* Show description for selected type */}
          {selectedType && (
            <p className="mt-2 text-sm text-gray-600 bg-gray-50 p-2 rounded">
              💡 {movementTypeOptions.find((opt) => opt.value === selectedType)?.description}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="paymentMethod" className="block text-sm font-medium text-gray-700">
            Método de Pago <span className="text-red-500">*</span>
          </label>
          <select
            id="paymentMethod"
            {...register("paymentMethod")}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value={PaymentMethod.CASH}>Efectivo</option>
            <option value={PaymentMethod.CREDIT_CARD}>Tarjeta de Crédito</option>
            <option value={PaymentMethod.DEBIT_CARD}>Tarjeta de Débito</option>
            <option value={PaymentMethod.TRANSFER}>Transferencia</option>
            <option value={PaymentMethod.CHECK}>Cheque</option>
          </select>
          {errors.paymentMethod && (
            <p className="mt-1 text-sm text-red-600">{errors.paymentMethod.message}</p>
          )}
          {/* Warning for non-CASH methods */}
          {selectedPaymentMethod && selectedPaymentMethod !== PaymentMethod.CASH && (
            <div className="mt-2 text-sm text-amber-700 bg-amber-50 p-2 rounded border border-amber-200">
              ⚠️ <strong>Nota:</strong> Los movimientos con {selectedPaymentMethod === PaymentMethod.CREDIT_CARD ? "tarjeta de crédito" : selectedPaymentMethod === PaymentMethod.DEBIT_CARD ? "tarjeta de débito" : selectedPaymentMethod === PaymentMethod.TRANSFER ? "transferencia" : "cheque"} se registran para el seguimiento, pero no afectan el efectivo físico de la caja.
            </div>
          )}
        </div>

        <FormInput
          label="Monto"
          type="number"
          step="0.01"
          min="0.01"
          {...register("amount", { valueAsNumber: true })}
          error={errors.amount?.message}
          required
          placeholder="0.00"
        />

        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700">
            Descripción
          </label>
          <textarea
            id="description"
            rows={3}
            {...register("description")}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            placeholder="Detalles del movimiento (opcional)"
          />
          {errors.description && (
            <p className="mt-1 text-sm text-red-600">{errors.description.message}</p>
          )}
        </div>

        <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded text-sm">
          <p className="font-medium mb-1">Tipos de movimiento:</p>
          <ul className="list-disc list-inside space-y-1 text-xs">
            <li>
              <strong>Depósito:</strong> Efectivo agregado a la caja (ej: fondo adicional).
            </li>
            <li>
              <strong>Retiro:</strong> Efectivo retirado de la caja (ej: depósito bancario).
            </li>
            <li>
              <strong>Gasto:</strong> Dinero gastado de la caja (ej: compra de insumos).
            </li>
            <li>
              <strong>Devolución:</strong> Reembolso en efectivo a cliente.
            </li>
            <li>
              <strong>Ajuste:</strong> Corrección manual del saldo.
            </li>
          </ul>
        </div>

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
            className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Agregando..." : "Agregar Movimiento"}
          </button>
        </div>
      </form>
    </Sidebar>
  );
}
