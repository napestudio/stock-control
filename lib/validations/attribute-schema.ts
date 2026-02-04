import { z } from "zod";

// UUID regex pattern
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ======================================
// ATTRIBUTE TEMPLATE SCHEMAS
// ======================================

export const attributeTemplateSchema = z.object({
  name: z.string().min(1, "Name is required").max(50, "Name too long"),
  description: z.string().max(200, "Description too long").optional(),
  displayOrder: z.number().int().min(0).default(0),
});

export const attributeOptionSchema = z.object({
  templateId: z.string().regex(UUID_REGEX, "Invalid template ID"),
  value: z.string().min(1, "Value is required").max(50, "Value too long"),
  displayOrder: z.number().int().min(0).default(0),
});

export const variantAttributeInputSchema = z.object({
  templateId: z.string().regex(UUID_REGEX),
  optionId: z.string().regex(UUID_REGEX),
  templateName: z.string(), // For display
  optionValue: z.string(),  // For display
});

// ======================================
// TYPE EXPORTS
// ======================================

export type AttributeTemplateInput = z.infer<typeof attributeTemplateSchema>;
export type AttributeOptionInput = z.infer<typeof attributeOptionSchema>;
export type VariantAttributeInput = z.infer<typeof variantAttributeInputSchema>;
