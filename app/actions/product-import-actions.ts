"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/utils/auth-helpers";
import {
  importProductsSchema,
  type CSVProductRow,
  type ImportResult,
} from "@/lib/validations/product-import-schema";
import { revalidatePath } from "next/cache";

/**
 * Generate a base SKU for a product without category or attributes.
 * Format: XX-{PRODUCTNAME} (max 10 chars from product name)
 */
function generateBaseSku(productName: string): string {
  const productPrefix = productName
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 10);
  return `XX-${productPrefix}`;
}

/**
 * Import products from a parsed CSV.
 *
 * Performance approach:
 * 1. One query to fetch all existing product names → check duplicates in memory
 * 2. One query to fetch all existing XX- prefixed SKUs → resolve uniqueness in memory
 * 3. One transaction with all creates batched → single DB round trip for writes
 *
 * Total: 3 read queries + 1 write transaction, regardless of row count.
 */
export async function importProductsFromCSV(
  rows: CSVProductRow[]
): Promise<ImportResult> {
  const session = await auth();

  if (!isAdmin(session)) {
    throw new Error("No autorizado: se requieren permisos de administrador");
  }

  const validated = importProductsSchema.parse({ rows });

  // 1. Fetch all existing (non-deleted) product names in one query
  const existingProducts = await prisma.product.findMany({
    where: { deletedAt: null },
    select: { name: true },
  });
  const existingNames = new Set(
    existingProducts.map((p) => p.name.toLowerCase().trim())
  );

  // 2. Fetch all existing SKUs with XX- prefix in one query
  //    (covers all products created without a category, including previous imports)
  const existingVariants = await prisma.productVariant.findMany({
    where: { sku: { startsWith: "XX-" } },
    select: { sku: true },
  });
  const existingSkus = new Set(existingVariants.map((v) => v.sku));

  // 3. Resolve each row in memory — no DB queries in the loop
  const result: ImportResult = { created: 0, skipped: 0, errors: [] };
  const toCreate: { row: CSVProductRow; sku: string }[] = [];
  // Track SKUs generated in this import batch to avoid intra-batch collisions
  const reservedSkus = new Set<string>();

  for (let i = 0; i < validated.rows.length; i++) {
    const row = validated.rows[i];

    // Duplicate name check (in memory)
    if (existingNames.has(row.name.toLowerCase().trim())) {
      result.skipped++;
      result.errors.push({
        row: i + 1,
        name: row.name,
        message: "El producto ya existe",
      });
      continue;
    }

    // SKU uniqueness resolution (in memory)
    const baseSku = generateBaseSku(row.name);
    let sku = baseSku;
    let counter = 2;

    while (existingSkus.has(sku) || reservedSkus.has(sku)) {
      sku = `${baseSku}-${counter}`;
      counter++;

      if (counter > 100) {
        result.errors.push({
          row: i + 1,
          name: row.name,
          message: "No se pudo generar un SKU único",
        });
        break;
      }
    }

    if (counter > 100) continue;

    reservedSkus.add(sku);
    // Also add to existingNames so duplicate rows within the CSV are caught
    existingNames.add(row.name.toLowerCase().trim());
    toCreate.push({ row, sku });
  }

  // 4. Single transaction with all creates batched
  if (toCreate.length > 0) {
    await prisma.$transaction(
      toCreate.map(({ row, sku }) =>
        prisma.product.create({
          data: {
            name: row.name,
            description: null,
            categoryId: null,
            active: true,
            variants: {
              create: {
                sku,
                name: null,
                price: row.price,
                costPrice: 0,
                displayName: "Default",
                stock: {
                  create: {
                    quantity: row.quantity,
                    minimumStock: 0,
                  },
                },
              },
            },
          },
        })
      )
    );
    result.created = toCreate.length;
  }

  revalidatePath("/panel/products");

  return result;
}
