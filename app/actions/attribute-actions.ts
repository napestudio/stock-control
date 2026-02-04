"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/utils/auth-helpers";
import { revalidatePath } from "next/cache";
import {
  attributeTemplateSchema,
  attributeOptionSchema,
  type AttributeTemplateInput,
  type AttributeOptionInput,
} from "@/lib/validations/attribute-schema";

/**
 * Get all active attribute templates with their options
 */
export async function getAttributeTemplates() {
  return await prisma.attributeTemplate.findMany({
    where: { active: true },
    include: {
      options: {
        where: { active: true },
        orderBy: { displayOrder: "asc" },
      },
    },
    orderBy: { displayOrder: "asc" },
  });
}

/**
 * Get a single attribute template by ID
 */
export async function getAttributeTemplate(id: string) {
  return await prisma.attributeTemplate.findUnique({
    where: { id },
    include: {
      options: {
        where: { active: true },
        orderBy: { displayOrder: "asc" },
      },
    },
  });
}

/**
 * Create a new attribute template
 */
export async function createAttributeTemplate(data: AttributeTemplateInput) {
  const session = await auth();
  if (!isAdmin(session)) {
    throw new Error("Unauthorized: Admin access required");
  }

  const validated = attributeTemplateSchema.parse(data);
  const template = await prisma.attributeTemplate.create({
    data: validated,
  });

  revalidatePath("/panel/settings/attributes");
  return template;
}

/**
 * Update an attribute template
 */
export async function updateAttributeTemplate(
  id: string,
  data: Partial<AttributeTemplateInput>
) {
  const session = await auth();
  if (!isAdmin(session)) {
    throw new Error("Unauthorized: Admin access required");
  }

  const template = await prisma.attributeTemplate.update({
    where: { id },
    data,
  });

  revalidatePath("/panel/settings/attributes");
  return template;
}

/**
 * Soft delete an attribute template (only if not in use)
 */
export async function deleteAttributeTemplate(id: string) {
  const session = await auth();
  if (!isAdmin(session)) {
    throw new Error("Unauthorized: Admin access required");
  }

  // Check if any variants use this template's options
  const usageCount = await prisma.variantAttribute.count({
    where: {
      option: {
        templateId: id,
      },
    },
  });

  if (usageCount > 0) {
    throw new Error(`Cannot delete template. Used by ${usageCount} variants.`);
  }

  await prisma.attributeTemplate.update({
    where: { id },
    data: { active: false },
  });

  revalidatePath("/panel/settings/attributes");
}

/**
 * Create a new attribute option
 */
export async function createAttributeOption(data: AttributeOptionInput) {
  const session = await auth();
  if (!isAdmin(session)) {
    throw new Error("Unauthorized: Admin access required");
  }

  const validated = attributeOptionSchema.parse(data);
  const option = await prisma.attributeOption.create({
    data: validated,
  });

  revalidatePath("/panel/settings/attributes");
  return option;
}

/**
 * Update an attribute option
 */
export async function updateAttributeOption(
  id: string,
  data: Partial<AttributeOptionInput>
) {
  const session = await auth();
  if (!isAdmin(session)) {
    throw new Error("Unauthorized: Admin access required");
  }

  const option = await prisma.attributeOption.update({
    where: { id },
    data,
  });

  revalidatePath("/panel/settings/attributes");
  return option;
}

/**
 * Delete an attribute option (only if not in use)
 */
export async function deleteAttributeOption(id: string) {
  const session = await auth();
  if (!isAdmin(session)) {
    throw new Error("Unauthorized: Admin access required");
  }

  // Check if any variants use this option
  const usageCount = await prisma.variantAttribute.count({
    where: { optionId: id },
  });

  if (usageCount > 0) {
    throw new Error(`Cannot delete option. Used by ${usageCount} variants.`);
  }

  await prisma.attributeOption.delete({
    where: { id },
  });

  revalidatePath("/panel/settings/attributes");
}

/**
 * Bulk reorder attribute options
 */
export async function reorderAttributeOptions(
  updates: { id: string; displayOrder: number }[]
) {
  const session = await auth();
  if (!isAdmin(session)) {
    throw new Error("Unauthorized: Admin access required");
  }

  await prisma.$transaction(
    updates.map(({ id, displayOrder }) =>
      prisma.attributeOption.update({
        where: { id },
        data: { displayOrder },
      })
    )
  );

  revalidatePath("/panel/settings/attributes");
}
