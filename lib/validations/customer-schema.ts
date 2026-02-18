import { z } from "zod";

// ============================================
// CUSTOMER SCHEMAS (standalone CRUD)
// ============================================

export const createCustomerSchema = z.object({
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
    .max(255, "El email no puede exceder 255 caracteres")
    .optional()
    .or(z.literal("")),
  phone: z
    .string()
    .max(30, "El teléfono no puede exceder 30 caracteres")
    .optional()
    .or(z.literal("")),
  address: z
    .string()
    .max(300, "La dirección no puede exceder 300 caracteres")
    .optional()
    .or(z.literal("")),
  dni: z
    .string()
    .max(20, "El DNI no puede exceder 20 caracteres")
    .optional()
    .or(z.literal("")),
  membershipNumber: z
    .string()
    .max(50, "El número de socio no puede exceder 50 caracteres")
    .optional()
    .or(z.literal("")),
});

export const updateCustomerSchema = createCustomerSchema.extend({
  id: z.string().uuid("ID de cliente inválido"),
});

export const customerFiltersSchema = z.object({
  search: z.string().optional(),
});

export const customerPaginationSchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(50),
});

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
export type CustomerFiltersInput = z.infer<typeof customerFiltersSchema>;
