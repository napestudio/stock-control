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
 * Generate SKU from category, product name, and attributes
 * Format: CATEGORY-PRODUCT-VARIANT
 * Example: SH-TSHIRT-BLK-MED
 */
function generateSku(
  categoryName: string | null | undefined,
  productName: string,
  attributes?: { optionValue: string }[]
): string {
  // Category prefix: First 2 letters, pad with X if needed, or "XX" if no category
  const categoryPrefix = categoryName
    ? categoryName.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 2).padEnd(2, "X")
    : "XX";

  const productPrefix = productName
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 10);

  if (!attributes || attributes.length === 0) {
    return `${categoryPrefix}-${productPrefix}`;
  }

  const attributeSuffix = attributes
    .map((attr) =>
      attr.optionValue
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "")
        .slice(0, 5)
    )
    .join("-");

  return `${categoryPrefix}-${productPrefix}-${attributeSuffix}`;
}

/**
 * Ensure SKU uniqueness by appending numeric suffix if needed
 */
async function ensureUniqueSku(
  baseSku: string,
  excludeProductId?: string
): Promise<string> {
  let sku = baseSku;
  let counter = 2;

  while (true) {
    const existing = await prisma.productVariant.findUnique({
      where: { sku },
      select: { productId: true },
    });

    // No conflict, or conflict is with same product (during edit)
    if (!existing || (excludeProductId && existing.productId === excludeProductId)) {
      return sku;
    }

    // Conflict: append counter
    sku = `${baseSku}-${counter}`;
    counter++;

    // Safety limit to prevent infinite loop
    if (counter > 100) {
      throw new Error("Unable to generate unique SKU after 100 attempts");
    }
  }
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

  // Create product with variants in transaction
  const product = await prisma.$transaction(async (tx) => {
    console.log("💾 Saving to database with categoryId:", validated.categoryId || null);

    // Fetch category name if categoryId is provided
    let categoryName: string | null = null;
    if (validated.categoryId) {
      const category = await tx.productCategory.findUnique({
        where: { id: validated.categoryId },
        select: { name: true },
      });
      categoryName = category?.name || null;
    }

    // Generate unique SKUs for all variants
    const variantsWithSkus = await Promise.all(
      validated.variants.map(async (variant) => {
        const baseSku = generateSku(categoryName, validated.name, variant.attributes);
        const uniqueSku = await ensureUniqueSku(baseSku);
        return { ...variant, sku: uniqueSku };
      })
    );

    const newProduct = await tx.product.create({
      data: {
        name: validated.name,
        description: validated.description,
        categoryId: validated.categoryId || null,
        active: true,
        imageUrl: validated.imageUrl || null,
        imagePublicId: validated.imagePublicId || null,
        variants: {
          create: variantsWithSkus.map((variant) => ({
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
                minimumStock: 0,
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

  // Update product with variants in transaction
  const product = await prisma.$transaction(async (tx) => {
    // Fetch current product to check for existing image and get name/category for SKU generation
    const currentProduct = await tx.product.findUnique({
      where: { id },
      select: {
        imagePublicId: true,
        name: true,
        categoryId: true,
      },
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
      // Fetch category name for SKU generation
      let categoryName: string | null = null;
      const categoryIdToUse = validated.categoryId !== undefined ? validated.categoryId : currentProduct?.categoryId;
      if (categoryIdToUse) {
        const category = await tx.productCategory.findUnique({
          where: { id: categoryIdToUse },
          select: { name: true },
        });
        categoryName = category?.name || null;
      }

      // Get product name (use updated name if provided, otherwise use current)
      const productName = validated.name || currentProduct?.name || "";

      for (const variant of validated.variants) {
        if (variant._action === "create") {
          // Generate unique SKU for new variant
          const baseSku = generateSku(categoryName, productName, variant.attributes);
          const uniqueSku = await ensureUniqueSku(baseSku, id);

          await tx.productVariant.create({
            data: {
              productId: id,
              sku: uniqueSku,
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
                  minimumStock: 0,
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
