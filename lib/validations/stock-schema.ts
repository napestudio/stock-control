import { z } from "zod";
import { StockMovementType } from "@prisma/client";

// UUID regex pattern
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Stock adjustment schema
export const stockAdjustmentSchema = z.object({
  productVariantId: z
    .string()
    .regex(UUID_REGEX, "ID de variante inválido"),
  type: z.nativeEnum(StockMovementType, {
    message: "Tipo de movimiento inválido",
  }),
  quantity: z
    .number()
    .int("La cantidad debe ser un número entero")
    .positive("La cantidad debe ser mayor a 0"),
  reason: z
    .string()
    .max(200, "La razón debe tener 200 caracteres o menos")
    .optional(),
});

// Update minimum stock schema
export const updateMinimumStockSchema = z.object({
  productVariantId: z.string().regex(UUID_REGEX, "ID de variante inválido"),
  minimumStock: z
    .number()
    .int("El stock mínimo debe ser un número entero")
    .min(0, "El stock mínimo no puede ser negativo"),
});

// Bulk update minimum stock schema (for future use)
export const bulkUpdateMinimumStockSchema = z.object({
  updates: z
    .array(
      z.object({
        productVariantId: z.string().regex(UUID_REGEX),
        minimumStock: z.number().int().min(0),
      })
    )
    .min(1, "Se requiere al menos una actualización"),
});

// Export types
export type StockAdjustmentInput = z.infer<typeof stockAdjustmentSchema>;
export type UpdateMinimumStockInput = z.infer<typeof updateMinimumStockSchema>;
export type BulkUpdateMinimumStockInput = z.infer<
  typeof bulkUpdateMinimumStockSchema
>;
