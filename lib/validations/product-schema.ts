import { z } from "zod";

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
    message: 'Image must be less than 5MB',
  })
  .refine(
    (file) => ACCEPTED_IMAGE_TYPES.includes(file.type as typeof ACCEPTED_IMAGE_TYPES[number]),
    {
      message: 'Only .jpg, .jpeg, .png and .webp formats are supported',
    }
  )
  .optional();

// Image URL schema for server-side validation
export const imageUrlSchema = z
  .string()
  .url('Invalid image URL')
  .regex(/^https:\/\/res\.cloudinary\.com/, 'Must be a Cloudinary URL')
  .optional();

export const imagePublicIdSchema = z.string().optional();

// Product variant schema (nested within product)
export const variantSchema = z.object({
  id: z.string().regex(UUID_REGEX, "Invalid ID").optional(), // Optional for new variants
  sku: z.string().min(1, "SKU is required").max(50, "SKU must be 50 characters or less"),
  name: z.string().max(100, "Variant name must be 100 characters or less").optional(),
  price: z.number().min(0, "Price must be a positive number"),
  costPrice: z.number().min(0, "Cost price must be a positive number"),
  _action: z.enum(["create", "update", "delete"]).optional(), // Track action for updates
});

// Create product schema
export const createProductSchema = z.object({
  name: z.string().min(1, "Product name is required").max(200, "Product name must be 200 characters or less"),
  description: z.string().max(500, "Description must be 500 characters or less").optional(),
  categoryId: z.string()
    .optional()
    .transform(val => !val || val === "" ? undefined : val)
    .refine(val => !val || UUID_REGEX.test(val), "Invalid category"),
  variants: z.array(variantSchema).min(1, "At least one variant is required"),
  imageUrl: imageUrlSchema,
  imagePublicId: imagePublicIdSchema,
});

// Edit product schema
export const editProductSchema = z.object({
  id: z.string().regex(UUID_REGEX, "Invalid ID"),
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(500).nullable().optional(),
  categoryId: z.string()
    .optional()
    .transform(val => !val || val === "" ? undefined : val)
    .refine(val => !val || UUID_REGEX.test(val), "Invalid category"),
  active: z.boolean().optional(),
  variants: z.array(variantSchema).optional(),
  imageUrl: imageUrlSchema,
  imagePublicId: imagePublicIdSchema,
});

// Category schema
export const createCategorySchema = z.object({
  name: z.string().min(1, "Category name is required").max(100, "Category name must be 100 characters or less"),
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
