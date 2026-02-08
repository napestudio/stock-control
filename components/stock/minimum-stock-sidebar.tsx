"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { updateMinimumStockSchema } from "@/lib/validations/stock-schema";
import Sidebar from "@/components/ui/sidebar";
import FormInput from "@/components/ui/form-input";
import { Button } from "@/components/ui/button";
import type { StockWithVariantSerialized } from "@/types/stock";

type MinimumStockFormData = z.infer<typeof updateMinimumStockSchema>;

interface MinimumStockSidebarProps {
  stock: StockWithVariantSerialized;
  onSubmit: (data: MinimumStockFormData) => void;
  onClose: () => void;
  isPending?: boolean;
}

export default function MinimumStockSidebar({
  stock,
  onSubmit,
  onClose,
  isPending,
}: MinimumStockSidebarProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<MinimumStockFormData>({
    resolver: zodResolver(updateMinimumStockSchema),
    defaultValues: {
      productVariantId: stock.productVariantId,
      minimumStock: stock.minimumStock,
    },
  });

  return (
    <Sidebar isOpen onClose={onClose} title="Actualizar Stock Mínimo" size="sm">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="bg-gray-50 p-4 rounded-md">
          <p className="text-sm font-medium text-gray-900">
            {stock.variant.product.name} - {stock.variant.displayName || stock.variant.name}
          </p>
          <p className="text-xs text-gray-600 mt-1">
            Stock actual: <span className="font-semibold">{stock.quantity}</span> |
            Mínimo actual: <span className="font-semibold">{stock.minimumStock}</span>
          </p>
        </div>

        <div>
          <FormInput
            label="Stock mínimo"
            type="number"
            {...register("minimumStock", { valueAsNumber: true })}
            error={errors.minimumStock?.message}
            placeholder="0"
            min="0"
          />
          <p className="mt-1 text-xs text-gray-500">
            Recibirás alertas cuando el stock llegue a este nivel o esté por debajo
          </p>
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? "Guardando..." : "Actualizar Mínimo"}
          </Button>
        </div>
      </form>
    </Sidebar>
  );
}
