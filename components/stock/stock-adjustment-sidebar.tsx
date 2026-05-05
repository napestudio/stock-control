"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { stockAdjustmentSchema } from "@/lib/validations/stock-schema";
import Sidebar from "@/components/ui/sidebar";
import FormInput from "@/components/ui/form-input";
import { Button } from "@/components/ui/button";
import type { StockWithVariantSerialized } from "@/types/stock";
import { StockMovementType } from "@prisma/client";

type StockAdjustmentFormData = z.infer<typeof stockAdjustmentSchema>;

interface StockAdjustmentSidebarProps {
  stock: StockWithVariantSerialized;
  onSubmit: (data: StockAdjustmentFormData, minimumStock: number) => void;
  onClose: () => void;
  isPending?: boolean;
}

const MOVEMENT_TYPES = [
  { value: StockMovementType.IN, label: "+ Agregar" },
  { value: StockMovementType.OUT, label: "— Restar" },
  { value: StockMovementType.ADJUSTMENT, label: "◻ Establecer" },
] as const;

export default function StockAdjustmentSidebar({
  stock,
  onSubmit,
  onClose,
  isPending,
}: StockAdjustmentSidebarProps) {
  const [minimumStock, setMinimumStock] = useState(stock.minimumStock);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<StockAdjustmentFormData>({
    resolver: zodResolver(stockAdjustmentSchema),
    defaultValues: {
      productVariantId: stock.productVariantId,
      type: StockMovementType.IN,
      quantity: 0,
      reason: "",
    },
  });

  const movementType = watch("type");

  return (
    <Sidebar isOpen onClose={onClose} title="Ajustar Stock" size="md">
      <form
        onSubmit={handleSubmit((data) => onSubmit(data, minimumStock))}
        className="space-y-4"
      >
        <div className="bg-gray-50 p-4 rounded-md">
          <p className="text-sm font-medium text-gray-900">
            {stock.variant.product.name} -{" "}
            {stock.variant.displayName || stock.variant.name}
          </p>
          <p className="text-xs text-gray-600 mt-1">SKU: {stock.variant.sku}</p>
          <p className="text-sm mt-2">
            Stock actual:{" "}
            <span className="font-bold text-lg">{stock.quantity}</span>
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Tipo de Ajuste
          </label>
          <div className="grid grid-cols-3 gap-2">
            {MOVEMENT_TYPES.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => setValue("type", value)}
                className={`px-3 py-2 text-sm font-medium rounded-md border transition-colors ${
                  movementType === value
                    ? "border-green-500 text-green-700 bg-green-50"
                    : "border-gray-300 text-gray-700 bg-white hover:bg-gray-50"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {errors.type && (
            <p className="mt-1 text-sm text-red-600">{errors.type.message}</p>
          )}
        </div>

        <FormInput
          label={
            movementType === StockMovementType.ADJUSTMENT
              ? "Nuevo stock total"
              : "Cantidad"
          }
          type="number"
          {...register("quantity", { valueAsNumber: true })}
          error={errors.quantity?.message}
          placeholder="0"
          min="0"
        />

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Razón (opcional)
          </label>
          <textarea
            {...register("reason")}
            rows={3}
            placeholder="Motivo del ajuste..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          {errors.reason && (
            <p className="mt-1 text-sm text-red-600">{errors.reason.message}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Stock Mínimo
          </label>
          <input
            type="number"
            value={minimumStock}
            onChange={(e) => setMinimumStock(Number(e.target.value))}
            min="0"
            className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <p className="mt-1 text-xs text-gray-500">
            Recibirás alertas cuando el stock llegue a este nivel o esté por
            debajo
          </p>
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? "Guardando..." : "Guardar Ajuste"}
          </Button>
        </div>
      </form>
    </Sidebar>
  );
}
