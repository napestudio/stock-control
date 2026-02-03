"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/utils/auth-helpers";
import {
  createProductSchema,
  editProductSchema,
  type CreateProductInput,
  type EditProductInput,
} from "@/lib/validations/product-schema";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";

/**
 * Create a new product with variants
 */
export async function createProduct(data: CreateProductInput) {
  const session = await auth();

  if (!isAdmin(session)) {
    throw new Error("Unauthorized: Admin access required");
  }

  // Debug logging
  console.log("📝 Raw data received:", {
    categoryId: data.categoryId,
    name: data.name
  });

  // Validate input
  const validated = createProductSchema.parse(data);

  console.log("✅ Validated data:", {
    categoryId: validated.categoryId,
    name: validated.name
  });

  // Check for SKU uniqueness
  const existingSkus = await prisma.productVariant.findMany({
    where: {
      sku: {
        in: validated.variants.map((v) => v.sku),
      },
    },
    select: { sku: true },
  });

  if (existingSkus.length > 0) {
    throw new Error(
      `SKU already exists: ${existingSkus.map((s) => s.sku).join(", ")}`
    );
  }

  // Create product with variants in transaction
  const product = await prisma.$transaction(async (tx) => {
    console.log("💾 Saving to database with categoryId:", validated.categoryId || null);

    const newProduct = await tx.product.create({
      data: {
        name: validated.name,
        description: validated.description,
        categoryId: validated.categoryId || null,
        active: true,
        variants: {
          create: validated.variants.map((variant) => ({
            sku: variant.sku,
            name: variant.name,
            price: variant.price,
            costPrice: variant.costPrice,
            stock: {
              create: {
                quantity: 0, // Initial stock is 0
              },
            },
          })),
        },
      },
      include: {
        category: true,
        variants: {
          include: {
            stock: true,
          },
        },
      },
    });

    return newProduct;
  });

  revalidatePath("/panel/products");

  // Serialize Decimal fields to numbers
  const serializedProduct = {
    ...product,
    variants: product.variants.map((variant) => ({
      ...variant,
      price: Number(variant.price),
      costPrice: Number(variant.costPrice),
    })),
  } as const;

  return {
    success: true,
    data: serializedProduct,
  };
}

/**
 * Update an existing product and its variants
 */
export async function updateProduct(
  id: string,
  data: Partial<EditProductInput>
) {
  const session = await auth();

  if (!isAdmin(session)) {
    throw new Error("Unauthorized: Admin access required");
  }

  // Validate input
  const validated = editProductSchema.partial().parse({ ...data, id });

  // If variants are being updated, check SKU uniqueness
  if (validated.variants) {
    const newSkus = validated.variants
      .filter((v) => v._action !== "delete")
      .map((v) => v.sku);

    const existingSkus = await prisma.productVariant.findMany({
      where: {
        sku: { in: newSkus },
        productId: { not: id },
      },
      select: { sku: true },
    });

    if (existingSkus.length > 0) {
      throw new Error(
        `SKU already exists: ${existingSkus.map((s) => s.sku).join(", ")}`
      );
    }
  }

  // Update product with variants in transaction
  const product = await prisma.$transaction(async (tx) => {
    // Prepare product update data
    const updateData: Prisma.ProductUpdateInput = {};
    if (validated.name !== undefined) updateData.name = validated.name;
    if (validated.description !== undefined)
      updateData.description = validated.description;
    if (validated.categoryId !== undefined) {
      updateData.category = validated.categoryId
        ? { connect: { id: validated.categoryId } }
        : { disconnect: true };
    }
    if (validated.active !== undefined) updateData.active = validated.active;

    // Update product
    const updatedProduct = await tx.product.update({
      where: { id },
      data: updateData,
      include: {
        category: true,
        variants: {
          include: {
            stock: true,
          },
        },
      },
    });

    // Handle variant updates if provided
    if (validated.variants) {
      for (const variant of validated.variants) {
        if (variant._action === "create") {
          await tx.productVariant.create({
            data: {
              productId: id,
              sku: variant.sku,
              name: variant.name,
              price: variant.price,
              costPrice: variant.costPrice,
              stock: {
                create: {
                  quantity: 0,
                },
              },
            },
          });
        } else if (variant._action === "update" && variant.id) {
          await tx.productVariant.update({
            where: { id: variant.id },
            data: {
              sku: variant.sku,
              name: variant.name,
              price: variant.price,
              costPrice: variant.costPrice,
            },
          });
        } else if (variant._action === "delete" && variant.id) {
          // Delete stock first (cascade won't work with manual delete)
          await tx.stock.deleteMany({
            where: { productVariantId: variant.id },
          });
          await tx.productVariant.delete({
            where: { id: variant.id },
          });
        }
      }

      // Re-fetch with updated variants
      return await tx.product.findUnique({
        where: { id },
        include: {
          category: true,
          variants: {
            include: {
              stock: true,
            },
          },
        },
      });
    }

    return updatedProduct;
  });

  revalidatePath("/panel/products");

  // Serialize Decimal fields to numbers
  const serializedProduct = product
    ? {
        ...product,
        variants: product.variants.map((variant) => ({
          ...variant,
          price: Number(variant.price),
          costPrice: Number(variant.costPrice),
        })),
      }
    : null;

  return {
    success: true,
    data: serializedProduct,
  };
}

/**
 * Soft delete a product (and cascade to variants)
 */
export async function softDeleteProduct(productId: string) {
  const session = await auth();

  if (!isAdmin(session)) {
    throw new Error("Unauthorized: Admin access required");
  }

  // Soft delete product
  await prisma.product.update({
    where: { id: productId },
    data: {
      deletedAt: new Date(),
      active: false,
    },
  });

  revalidatePath("/panel/products");

  return {
    success: true,
  };
}

/**
 * Get products with filters
 */
export async function getProducts(
  filter?: "all" | "active" | "inactive",
  categoryId?: string,
  search?: string
) {
  const session = await auth();

  if (!isAdmin(session)) {
    throw new Error("Unauthorized: Admin access required");
  }

  // Build where clause
  const where: Prisma.ProductWhereInput = {
    deletedAt: null,
  };

  if (filter === "active") {
    where.active = true;
  } else if (filter === "inactive") {
    where.active = false;
  }

  if (categoryId) {
    where.categoryId = categoryId;
  }

  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } },
      {
        variants: {
          some: {
            sku: { contains: search, mode: "insensitive" },
          },
        },
      },
    ];
  }

  // Query products
  const productsRaw = await prisma.product.findMany({
    where,
    include: {
      category: true,
      variants: {
        include: {
          stock: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  // Serialize Decimal fields to numbers for client components
  const products = productsRaw.map((product) => ({
    ...product,
    variants: product.variants.map((variant) => ({
      ...variant,
      price: Number(variant.price),
      costPrice: Number(variant.costPrice),
    })),
  }));

  return products;
}

/**
 * Get all categories
 */
export async function getCategories() {
  const session = await auth();

  if (!isAdmin(session)) {
    throw new Error("Unauthorized: Admin access required");
  }

  const categories = await prisma.productCategory.findMany({
    orderBy: { name: "asc" },
  });

  return categories;
}

/**
 * Create a new category
 */
export async function createCategory(name: string) {
  const session = await auth();

  if (!isAdmin(session)) {
    throw new Error("Unauthorized: Admin access required");
  }

  const category = await prisma.productCategory.create({
    data: { name },
  });

  revalidatePath("/panel/products");

  return {
    success: true,
    data: category,
  };
}
