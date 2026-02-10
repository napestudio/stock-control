import { z } from "zod";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Create cash register
export const createCashRegisterSchema = z.object({
  name: z
    .string()
    .min(1, "El nombre es obligatorio")
    .max(100, "El nombre debe tener 100 caracteres o menos"),
  active: z.boolean().default(true),
});

// Update cash register
export const updateCashRegisterSchema = z.object({
  id: z.string().regex(UUID_REGEX, "ID inválido"),
  name: z
    .string()
    .min(1, "El nombre es obligatorio")
    .max(100, "El nombre debe tener 100 caracteres o menos")
    .optional(),
  active: z.boolean().optional(),
});

// Export types
export type CreateCashRegisterInput = z.infer<typeof createCashRegisterSchema>;
export type UpdateCashRegisterInput = z.infer<typeof updateCashRegisterSchema>;
