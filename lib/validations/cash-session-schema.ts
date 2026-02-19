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

// Close session with multi-method verification
export const closeSessionSchema = z.object({
  sessionId: z.string().regex(UUID_REGEX, "ID de sesión inválido"),

  // CASH is always required (even if zero)
  closingAmountCash: z
    .number()
    .min(0, "El monto de efectivo no puede ser negativo")
    .multipleOf(0.01, "El monto debe tener máximo 2 decimales"),

  // Other methods are optional (only required if used in session - enforced server-side)
  closingAmountCreditCard: z
    .number()
    .min(0, "El monto de tarjeta crédito no puede ser negativo")
    .multipleOf(0.01, "El monto debe tener máximo 2 decimales")
    .optional(),
  closingAmountDebitCard: z
    .number()
    .min(0, "El monto de tarjeta débito no puede ser negativo")
    .multipleOf(0.01, "El monto debe tener máximo 2 decimales")
    .optional(),
  closingAmountTransfer: z
    .number()
    .min(0, "El monto de transferencia no puede ser negativo")
    .multipleOf(0.01, "El monto debe tener máximo 2 decimales")
    .optional(),
  closingAmountCheck: z
    .number()
    .min(0, "El monto de cheque no puede ser negativo")
    .multipleOf(0.01, "El monto debe tener máximo 2 decimales")
    .optional(),

  // Optional closing notes
  closingNotes: z.string().max(1000, "Las notas no pueden exceder 1000 caracteres").optional(),
});

// Cash movement (manual transactions only - INCOME and EXPENSE)
// SALE and REFUND movements are created automatically from sales
export const cashMovementSchema = z.object({
  sessionId: z.string().regex(UUID_REGEX, "ID de sesión inválido"),

  // Only allow INCOME and EXPENSE for manual movements
  type: z.enum(["INCOME", "EXPENSE"], {
    message: "Tipo de movimiento inválido. Solo se permiten INGRESO y EGRESO manuales.",
  }),

  paymentMethod: z.nativeEnum(PaymentMethod, {
    message: "Método de pago inválido",
  }),

  amount: z
    .number()
    .refine((val) => !isNaN(val) && isFinite(val), "El monto debe ser un número válido")
    .positive("El monto debe ser mayor a 0")
    .max(99999999.99, "El monto es demasiado grande")
    .multipleOf(0.01, "El monto debe tener máximo 2 decimales"),

  description: z
    .string()
    .max(500, "La descripción debe tener 500 caracteres o menos")
    .optional(),
});

// Export types
export type OpenSessionInput = z.infer<typeof openSessionSchema>;
export type CloseSessionInput = z.infer<typeof closeSessionSchema>;
export type CashMovementInput = z.infer<typeof cashMovementSchema>;
