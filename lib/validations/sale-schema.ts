import { z } from "zod";
import { PaymentMethod, SaleStatus } from "@prisma/client";

// UUID validation pattern
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ============================================
// CUSTOMER SCHEMAS
// ============================================

export const customerSchema = z.object({
  firstName: z
    .string()
    .min(1, "El nombre es requerido")
    .max(100, "El nombre no puede exceder 100 caracteres"),
  lastName: z
    .string()
    .min(1, "El apellido es requerido")
    .max(100, "El apellido no puede exceder 100 caracteres"),
  email: z
    .string()
    .email("Debe ser un email válido")
    .max(255, "El email no puede exceder 255 caracteres"),
  phone: z
    .string()
    .max(50, "El teléfono no puede exceder 50 caracteres")
    .optional(),
  address: z
    .string()
    .max(500, "La dirección no puede exceder 500 caracteres")
    .optional(),
});

export type CustomerInput = z.infer<typeof customerSchema>;

// ============================================
// SALE SCHEMAS
// ============================================

export const createSaleSchema = z.object({
  sessionId: z
    .string()
    .regex(UUID_REGEX, "ID de sesión inválido")
    .optional()
    .nullable(),
});

export type CreateSaleInput = z.infer<typeof createSaleSchema>;

// ============================================
// SALE ITEM SCHEMAS
// ============================================

export const addSaleItemSchema = z.object({
  saleId: z.string().regex(UUID_REGEX, "ID de venta inválido"),
  productVariantId: z
    .string()
    .regex(UUID_REGEX, "ID de variante de producto inválido"),
  quantity: z
    .number()
    .int("La cantidad debe ser un número entero")
    .positive("La cantidad debe ser mayor a 0")
    .max(99999, "La cantidad no puede exceder 99,999"),
});

export type AddSaleItemInput = z.infer<typeof addSaleItemSchema>;

export const updateSaleItemQuantitySchema = z.object({
  saleItemId: z.string().regex(UUID_REGEX, "ID de item inválido"),
  quantity: z
    .number()
    .int("La cantidad debe ser un número entero")
    .positive("La cantidad debe ser mayor a 0")
    .max(99999, "La cantidad no puede exceder 99,999"),
});

export type UpdateSaleItemQuantityInput = z.infer<
  typeof updateSaleItemQuantitySchema
>;

// ============================================
// PAYMENT SCHEMAS
// ============================================

export const paymentEntrySchema = z.object({
  method: z.nativeEnum(PaymentMethod, {
    message: "Método de pago inválido",
  }),
  amount: z
    .number()
    .positive("El monto debe ser mayor a 0")
    .multipleOf(0.01, "El monto debe tener máximo 2 decimales")
    .max(99999999.99, "El monto no puede exceder 99,999,999.99"),
});

export type PaymentEntry = z.infer<typeof paymentEntrySchema>;

// ============================================
// COMPLETE SALE SCHEMA
// ============================================

export const completeSaleSchema = z
  .object({
    saleId: z.string().regex(UUID_REGEX, "ID de venta inválido"),
    payments: z
      .array(paymentEntrySchema)
      .min(1, "Debe proporcionar al menos un método de pago"),
    customerId: z
      .string()
      .regex(UUID_REGEX, "ID de cliente inválido")
      .optional(),
    customerData: customerSchema.optional(),
    sessionId: z
      .string()
      .regex(UUID_REGEX, "ID de sesión inválido")
      .optional()
      .nullable(),
    discountPercentage: z
      .number()
      .min(0, "El descuento no puede ser negativo")
      .max(100, "El descuento no puede superar el 100%")
      .multipleOf(0.01, "El descuento debe tener máximo 2 decimales")
      .optional()
      .default(0),
    items: z
      .array(
        z.object({
          saleItemId: z.string().regex(UUID_REGEX, "ID de ítem inválido"),
          quantity: z
            .number()
            .int("La cantidad debe ser un número entero")
            .min(1, "La cantidad mínima es 1")
            .max(99999, "La cantidad no puede exceder 99,999"),
        }),
      )
      .optional(),
  })
  .refine((data) => data.customerId || data.customerData, {
    message: "Debe proporcionar un cliente (ID o datos)",
    path: ["customerId"],
  });

export type CompleteSaleInput = z.infer<typeof completeSaleSchema>;

// ============================================
// QUICK SALE SCHEMA
// ============================================

export const quickSaleSchema = z.object({
  productVariantId: z
    .string()
    .regex(UUID_REGEX, "ID de variante de producto inválido"),
  quantity: z
    .number()
    .int("La cantidad debe ser un número entero")
    .positive("La cantidad debe ser mayor a 0")
    .max(99999, "La cantidad no puede exceder 99,999")
    .default(1),
  paymentMethod: z.nativeEnum(PaymentMethod, {
    message: "Método de pago inválido",
  }),
  sessionId: z
    .string()
    .regex(UUID_REGEX, "ID de sesión inválido")
    .optional()
    .nullable(),
});

export type QuickSaleInput = z.infer<typeof quickSaleSchema>;

// ============================================
// SALE FILTERS SCHEMA
// ============================================

export const saleFiltersSchema = z.object({
  status: z.nativeEnum(SaleStatus).optional(),
  userId: z.string().regex(UUID_REGEX).optional(),
  customerId: z.string().regex(UUID_REGEX).optional(),
  sessionId: z.string().regex(UUID_REGEX).optional(),
  paymentMethod: z.nativeEnum(PaymentMethod).optional(),
  createdAfter: z.coerce.date().optional(),
  createdBefore: z.coerce.date().optional(),
  minTotal: z.number().nonnegative().optional(),
  maxTotal: z.number().positive().optional(),
  search: z.string().max(200).optional(),
});

export type SaleFiltersInput = z.infer<typeof saleFiltersSchema>;

// ============================================
// PAGINATION SCHEMA
// ============================================

export const paginationSchema = z.object({
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().positive().max(100).default(50),
});

export type PaginationInput = z.infer<typeof paginationSchema>;
