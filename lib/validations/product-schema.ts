import { z } from "zod";
import { variantAttributeInputSchema } from "./attribute-schema";

// UUID regex pattern
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// File validation constants
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
const ACCEPTED_IMAGE_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
] as const;

// Image file schema for client-side validation
export const imageFileSchema = z
  .instanceof(File)
  .refine((file) => file.size <= MAX_IMAGE_SIZE, {
    message: 'La imagen debe ser menor a 5MB',
  })
  .refine(
    (file) => ACCEPTED_IMAGE_TYPES.includes(file.type as typeof ACCEPTED_IMAGE_TYPES[number]),
    {
      message: 'Solo se admiten formatos .jpg, .jpeg, .png y .webp',
    }
  )
  .optional();

// Image URL schema for server-side validation - allow empty, null, undefined
export const imageUrlSchema = z
  .union([
    z.string().url().regex(/^https:\/\/res\.cloudinary\.com/, 'Debe ser una URL de Cloudinary'),
    z.literal(''),
    z.null(),
    z.undefined()
  ])
  .optional();

export const imagePublicIdSchema = z
  .union([
    z.string(),
    z.literal(''),
    z.null(),
    z.undefined()
  ])
  .optional();

// Product variant schema (nested within product)
export const variantSchema = z.object({
  id: z.string().regex(UUID_REGEX, "ID inválido").optional(), // Optional for new variants
  sku: z.string().min(1, "El SKU es obligatorio").max(50, "El SKU debe tener 50 caracteres o menos"),
  name: z.string().max(100, "El nombre de variante debe tener 100 caracteres o menos").optional(),
  price: z.number().min(0, "El precio debe ser un número positivo"),
  costPrice: z.number().min(0, "El precio de costo debe ser un número positivo"),

  // NEW FIELDS for variant attributes
  imageUrl: imageUrlSchema,
  imagePublicId: imagePublicIdSchema,
  attributes: z.array(variantAttributeInputSchema).max(3, "Máximo 3 atributos permitidos").optional(),
  displayName: z.string().max(200).optional(),

  _action: z.enum(["create", "update", "delete"]).optional(), // Track action for updates
});

// Create product schema
export const createProductSchema = z.object({
  name: z.string().min(1, "El nombre del producto es obligatorio").max(200, "El nombre del producto debe tener 200 caracteres o menos"),
  description: z.string().max(500, "La descripción debe tener 500 caracteres o menos").optional(),
  categoryId: z.string()
    .optional()
    .transform(val => !val || val === "" ? undefined : val)
    .refine(val => !val || UUID_REGEX.test(val), "Categoría inválida"),
  variants: z.array(variantSchema).min(1, "Se requiere al menos una variante"),
  imageUrl: imageUrlSchema,
  imagePublicId: imagePublicIdSchema,
});

// Edit product schema
export const editProductSchema = z.object({
  id: z.string().regex(UUID_REGEX, "ID inválido"),
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(500).nullable().optional(),
  categoryId: z.string()
    .optional()
    .transform(val => !val || val === "" ? undefined : val)
    .refine(val => !val || UUID_REGEX.test(val), "Categoría inválida"),
  active: z.boolean().optional(),
  variants: z.array(variantSchema).optional(),
  imageUrl: imageUrlSchema,
  imagePublicId: imagePublicIdSchema,
});

// Category schemas
export const createCategorySchema = z.object({
  name: z.string().min(1, "El nombre de categoría es obligatorio").max(100, "El nombre de categoría debe tener 100 caracteres o menos"),
  description: z.string().max(300, "La descripción debe tener 300 caracteres o menos").optional(),
});

export const editCategorySchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
});

// Export types
export type CreateProductInput = z.infer<typeof createProductSchema>;
export type EditProductInput = z.infer<typeof editProductSchema>;
export type VariantInput = z.infer<typeof variantSchema>;
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type ImageFileInput = z.infer<typeof imageFileSchema>;
