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
import { deleteImage } from "@/lib/cloudinary/upload-helper";

/**
 * Generate display name from variant attributes
 */
function generateDisplayName(
  attributes?: { templateName: string; optionValue: string }[],
  fallbackName?: string | null
): string {
  if (attributes && attributes.length > 0) {
    return attributes.map((a) => a.optionValue).join(" / ");
  }
  return fallbackName || "Default";
}

/**
 * Generate SKU from product name and attributes
 */
function generateSku(
  productName: string,
  attributes?: { optionValue: string }[]
): string {
  const prefix = productName
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 10);

  if (!attributes || attributes.length === 0) {
    return prefix;
  }

  const suffix = attributes
    .map((attr) =>
      attr.optionValue
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "")
        .slice(0, 5)
    )
    .join("-");

  return `${prefix}-${suffix}`;
}

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
        imageUrl: validated.imageUrl || null,
        imagePublicId: validated.imagePublicId || null,
        variants: {
          create: validated.variants.map((variant) => ({
            sku: variant.sku,
            name: variant.name,
            price: variant.price,
            costPrice: variant.costPrice,
            imageUrl: variant.imageUrl || null,
            imagePublicId: variant.imagePublicId || null,
            displayName:
              variant.displayName ||
              generateDisplayName(variant.attributes, variant.name),
            stock: {
              create: {
                quantity: 0, // Initial stock is 0
              },
            },
            attributes: variant.attributes
              ? {
                  create: variant.attributes.map((attr) => ({
                    optionId: attr.optionId,
                  })),
                }
              : undefined,
          })),
        },
      },
      include: {
        category: true,
        variants: {
          include: {
            stock: true,
            attributes: {
              include: {
                option: {
                  include: {
                    template: true,
                  },
                },
              },
            },
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
    // Fetch current product to check for existing image
    const currentProduct = await tx.product.findUnique({
      where: { id },
      select: { imagePublicId: true },
    });

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

    // Handle image update/deletion
    if (validated.imageUrl !== undefined) {
      updateData.imageUrl = validated.imageUrl;
    }
    if (validated.imagePublicId !== undefined) {
      updateData.imagePublicId = validated.imagePublicId;
    }

    // Update product
    const updatedProduct = await tx.product.update({
      where: { id },
      data: updateData,
      include: {
        category: true,
        variants: {
          include: {
            stock: true,
            attributes: {
              include: {
                option: {
                  include: {
                    template: true,
                  },
                },
              },
            },
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
              imageUrl: variant.imageUrl || null,
              imagePublicId: variant.imagePublicId || null,
              displayName:
                variant.displayName ||
                generateDisplayName(variant.attributes, variant.name),
              stock: {
                create: {
                  quantity: 0,
                },
              },
              attributes: variant.attributes
                ? {
                    create: variant.attributes.map((attr) => ({
                      optionId: attr.optionId,
                    })),
                  }
                : undefined,
            },
          });
        } else if (variant._action === "update" && variant.id) {
          // Delete existing attributes
          await tx.variantAttribute.deleteMany({
            where: { variantId: variant.id },
          });

          // Update variant with new attributes
          await tx.productVariant.update({
            where: { id: variant.id },
            data: {
              sku: variant.sku,
              name: variant.name,
              price: variant.price,
              costPrice: variant.costPrice,
              imageUrl: variant.imageUrl || null,
              imagePublicId: variant.imagePublicId || null,
              displayName:
                variant.displayName ||
                generateDisplayName(variant.attributes, variant.name),
              attributes: variant.attributes
                ? {
                    create: variant.attributes.map((attr) => ({
                      optionId: attr.optionId,
                    })),
                  }
                : undefined,
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
      const refetchedProduct = await tx.product.findUnique({
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

      // Delete old image from Cloudinary after successful transaction
      // Only delete if we're replacing with a new image
      if (
        currentProduct?.imagePublicId &&
        validated.imagePublicId &&
        currentProduct.imagePublicId !== validated.imagePublicId
      ) {
        // Async deletion - don't await to avoid blocking
        deleteImage(currentProduct.imagePublicId).catch((err) => {
          console.error("Failed to delete old image:", err);
          // Don't throw - product update was successful
        });
      }

      return refetchedProduct;
    }

    // Delete old image if replacing
    if (
      currentProduct?.imagePublicId &&
      validated.imagePublicId &&
      currentProduct.imagePublicId !== validated.imagePublicId
    ) {
      deleteImage(currentProduct.imagePublicId).catch((err) => {
        console.error("Failed to delete old image:", err);
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

  // Fetch product to get image public ID
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { imagePublicId: true },
  });

  // Soft delete product
  await prisma.product.update({
    where: { id: productId },
    data: {
      deletedAt: new Date(),
      active: false,
    },
  });

  // Delete image from Cloudinary (async, non-blocking)
  if (product?.imagePublicId) {
    deleteImage(product.imagePublicId).catch((err) => {
      console.error("Failed to delete product image:", err);
      // Don't throw - product deletion was successful
    });
  }

  revalidatePath("/panel/products");

  return {
    success: true,
  };
}

/**
 * Get products with filters and pagination
 */
export async function getProducts(
  filter?: "all" | "active" | "inactive",
  categoryId?: string,
  search?: string,
  page: number = 1,
  pageSize: number = 50
) {
  const session = await auth();

  if (!isAdmin(session)) {
    throw new Error("Unauthorized: Admin access required");
  }

  // Calculate pagination
  const skip = (page - 1) * pageSize;
  const take = pageSize;

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
            OR: [
              { sku: { contains: search, mode: "insensitive" } },
              { displayName: { contains: search, mode: "insensitive" } },
            ],
          },
        },
      },
    ];
  }

  // Query products with pagination and get total count
  const [productsRaw, totalCount] = await Promise.all([
    prisma.product.findMany({
      where,
      include: {
        category: true,
        variants: {
          include: {
            stock: true,
            attributes: {
              include: {
                option: {
                  include: {
                    template: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      skip,
      take,
    }),
    prisma.product.count({ where }),
  ]);

  // Serialize Decimal fields to numbers for client components
  const products = productsRaw.map((product) => ({
    ...product,
    variants: product.variants.map((variant) => ({
      ...variant,
      price: Number(variant.price),
      costPrice: Number(variant.costPrice),
    })),
  }));

  return {
    products,
    pagination: {
      page,
      pageSize,
      totalCount,
      totalPages: Math.ceil(totalCount / pageSize),
      hasMore: page * pageSize < totalCount,
    },
  };
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
