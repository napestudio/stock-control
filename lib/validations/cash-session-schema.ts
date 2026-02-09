import { z } from "zod";
import { CashMovementType, PaymentMethod } from "@prisma/client";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Open session
export const openSessionSchema = z.object({
  cashRegisterId: z.string().regex(UUID_REGEX, "ID de caja inválido"),
  openingAmount: z
    .number()
    .min(0, "El monto inicial debe ser positivo o cero")
    .multipleOf(0.01, "El monto debe tener máximo 2 decimales"),
});

// Close session
export const closeSessionSchema = z.object({
  sessionId: z.string().regex(UUID_REGEX, "ID de sesión inválido"),
  closingAmount: z
    .number()
    .min(0, "El monto de cierre debe ser positivo o cero")
    .multipleOf(0.01, "El monto debe tener máximo 2 decimales"),
});

// Cash movement (non-sale transactions)
export const cashMovementSchema = z.object({
  sessionId: z.string().regex(UUID_REGEX, "ID de sesión inválido"),
  type: z.nativeEnum(CashMovementType, {
    message: "Tipo de movimiento inválido",
  }),
  paymentMethod: z.nativeEnum(PaymentMethod, {
    message: "Método de pago inválido",
  }),
  amount: z
    .number()
    .refine((val) => !isNaN(val) && isFinite(val), "El monto debe ser un número válido")
    .min(0.01, "El monto debe ser al menos 0.01")
    .max(99999999.99, "El monto es demasiado grande")
    .multipleOf(0.01, "El monto debe tener máximo 2 decimales"),
  description: z
    .string()
    .max(200, "La descripción debe tener 200 caracteres o menos")
    .optional(),
});

// Export types
export type OpenSessionInput = z.infer<typeof openSessionSchema>;
export type CloseSessionInput = z.infer<typeof closeSessionSchema>;
export type CashMovementInput = z.infer<typeof cashMovementSchema>;
