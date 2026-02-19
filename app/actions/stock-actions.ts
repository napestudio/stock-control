"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/utils/auth-helpers";
import {
  stockAdjustmentSchema,
  updateMinimumStockSchema,
  bulkUpdateMinimumStockSchema,
  type StockAdjustmentInput,
  type UpdateMinimumStockInput,
  type BulkUpdateMinimumStockInput,
} from "@/lib/validations/stock-schema";
import { revalidatePath } from "next/cache";
import { Prisma, StockMovementType } from "@prisma/client";

/**
 * Get all stock with filters and pagination
 * Includes low stock indicators
 */
export async function getStockList(
  filter?: {
    search?: string;
    categoryId?: string;
    lowStockOnly?: boolean;
  },
  page: number = 1,
  pageSize: number = 50,
) {
  const session = await auth();

  if (!isAdmin(session)) {
    throw new Error("No autorizado: Se requiere acceso de administrador");
  }

  const skip = (page - 1) * pageSize;
  const take = pageSize;

  // Build where clause
  const where: Prisma.StockWhereInput = {};

  // Build variant filter conditions
  const variantWhere: Prisma.ProductVariantWhereInput = {};

  // Add search filter
  if (filter?.search) {
    variantWhere.OR = [
      { sku: { contains: filter.search, mode: "insensitive" } },
      { displayName: { contains: filter.search, mode: "insensitive" } },
      {
        product: {
          name: { contains: filter.search, mode: "insensitive" },
          ...(filter.categoryId ? { categoryId: filter.categoryId } : {}),
        },
      },
    ];
  }

  // Add category filter (only if no search, otherwise it's already included)
  if (filter?.categoryId && !filter?.search) {
    variantWhere.product = {
      categoryId: filter.categoryId,
    };
  }

  // Apply variant filter if any conditions exist
  if (Object.keys(variantWhere).length > 0) {
    where.variant = variantWhere;
  }

  // Query stock with pagination
  const [stockListRaw, totalCount] = await Promise.all([
    prisma.stock.findMany({
      where,
      include: {
        variant: {
          include: {
            product: {
              include: {
                category: true,
              },
            },
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
      orderBy: [{ updatedAt: "desc" }],
      skip,
      take,
    }),
    prisma.stock.count({ where }),
  ]);

  // Serialize and add low stock indicator
  const stockList = stockListRaw
    .map((stock) => ({
      ...stock,
      variant: {
        ...stock.variant,
        price: Number(stock.variant.price),
        costPrice: Number(stock.variant.costPrice),
      },
      isLowStock: stock.quantity <= stock.minimumStock,
    }))
    .filter((stock) => !filter?.lowStockOnly || stock.isLowStock); // Apply JS filter if needed

  const finalTotalCount = filter?.lowStockOnly ? stockList.length : totalCount;

  return {
    stockList,
    pagination: {
      page,
      pageSize,
      totalCount: finalTotalCount,
      totalPages: Math.ceil(finalTotalCount / pageSize),
      hasMore: page * pageSize < finalTotalCount,
    },
  };
}

/**
 * Adjust stock (IN, OUT, ADJUSTMENT, RETURN)
 * Creates StockMovement record and updates Stock quantity
 */
export async function adjustStock(data: StockAdjustmentInput) {
  const session = await auth();

  if (!isAdmin(session)) {
    throw new Error("No autorizado: Se requiere acceso de administrador");
  }

  // Validate input
  const validated = stockAdjustmentSchema.parse(data);

  // Perform stock adjustment in transaction
  const result = await prisma.$transaction(async (tx) => {
    // Get current stock
    const currentStock = await tx.stock.findUnique({
      where: { productVariantId: validated.productVariantId },
    });

    if (!currentStock) {
      throw new Error("Stock no encontrado");
    }

    // Calculate new quantity based on movement type
    let newQuantity = currentStock.quantity;

    switch (validated.type) {
      case StockMovementType.IN:
      case StockMovementType.RETURN:
        newQuantity += validated.quantity;
        break;
      case StockMovementType.OUT:
        newQuantity -= validated.quantity;
        if (newQuantity < 0) {
          throw new Error("Stock insuficiente para realizar esta operación");
        }
        break;
      case StockMovementType.ADJUSTMENT:
        // For adjustment, quantity is the new absolute value
        newQuantity = validated.quantity;
        break;
    }

    // Create stock movement record
    const movement = await tx.stockMovement.create({
      data: {
        productVariantId: validated.productVariantId,
        type: validated.type,
        quantity: validated.quantity,
        reason: validated.reason,
      },
    });

    // Update stock quantity
    const updatedStock = await tx.stock.update({
      where: { productVariantId: validated.productVariantId },
      data: { quantity: newQuantity },
      include: {
        variant: {
          include: {
            product: true,
          },
        },
      },
    });

    return { movement, stock: updatedStock };
  });

  revalidatePath("/panel/stock");
  revalidatePath("/panel/products");

  return {
    success: true,
    data: {
      ...result.stock,
      variant: {
        ...result.stock.variant,
        price: Number(result.stock.variant.price),
        costPrice: Number(result.stock.variant.costPrice),
      },
    },
  };
}

/**
 * Update minimum stock level for a variant
 */
export async function updateMinimumStock(data: UpdateMinimumStockInput) {
  const session = await auth();

  if (!isAdmin(session)) {
    throw new Error("No autorizado: Se requiere acceso de administrador");
  }

  // Validate input
  const validated = updateMinimumStockSchema.parse(data);

  // Update minimum stock
  const updatedStock = await prisma.stock.update({
    where: { productVariantId: validated.productVariantId },
    data: { minimumStock: validated.minimumStock },
    include: {
      variant: {
        include: {
          product: true,
        },
      },
    },
  });

  revalidatePath("/panel/stock");

  return {
    success: true,
    data: {
      ...updatedStock,
      variant: {
        ...updatedStock.variant,
        price: Number(updatedStock.variant.price),
        costPrice: Number(updatedStock.variant.costPrice),
      },
    },
  };
}

/**
 * Bulk update minimum stock levels
 */
export async function bulkUpdateMinimumStock(
  data: BulkUpdateMinimumStockInput,
) {
  const session = await auth();

  if (!isAdmin(session)) {
    throw new Error("No autorizado: Se requiere acceso de administrador");
  }

  // Validate input
  const validated = bulkUpdateMinimumStockSchema.parse(data);

  // Update all in transaction
  await prisma.$transaction(
    validated.updates.map((update) =>
      prisma.stock.update({
        where: { productVariantId: update.productVariantId },
        data: { minimumStock: update.minimumStock },
      }),
    ),
  );

  revalidatePath("/panel/stock");

  return { success: true };
}

/**
 * Get stock movement history for a variant
 */
export async function getStockMovements(
  productVariantId: string,
  page: number = 1,
  pageSize: number = 20,
) {
  const session = await auth();

  if (!isAdmin(session)) {
    throw new Error("No autorizado: Se requiere acceso de administrador");
  }

  const skip = (page - 1) * pageSize;
  const take = pageSize;

  const [movements, totalCount] = await Promise.all([
    prisma.stockMovement.findMany({
      where: { productVariantId },
      include: {
        variant: {
          include: {
            product: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take,
    }),
    prisma.stockMovement.count({
      where: { productVariantId },
    }),
  ]);

  return {
    movements: movements.map((m) => ({
      ...m,
      variant: {
        ...m.variant,
        price: Number(m.variant.price),
        costPrice: Number(m.variant.costPrice),
      },
    })),
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
 * Get low stock count (count of variants below minimum)
 * Optimized with raw SQL for performance
 */
export async function getLowStockCount() {
  const session = await auth();

  if (!isAdmin(session)) {
    throw new Error("No autorizado: Se requiere acceso de administrador");
  }

  // Use raw query for performance
  const result = await prisma.$queryRaw<[{ count: bigint }]>`
    SELECT COUNT(*) as count
    FROM "Stock"
    WHERE quantity <= "minimumStock" AND "minimumStock" > 0
  `;

  return Number(result[0].count);
}
