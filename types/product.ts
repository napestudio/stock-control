import { Prisma } from "@prisma/client";

// Product with all relations (category, variants with stock)
export type ProductWithRelations = Prisma.ProductGetPayload<{
  include: {
    category: true;
    variants: {
      include: {
        stock: true;
      };
    };
  };
}>;

// Variant with stock
export type VariantWithStock = Prisma.ProductVariantGetPayload<{
  include: {
    stock: true;
  };
}>;

// Optimistic update action types for useOptimistic hook
export type OptimisticAction =
  | { type: "create"; tempId: string; product: ProductWithRelations }
  | { type: "update"; id: string; product: Partial<ProductWithRelations> }
  | { type: "delete"; id: string };
