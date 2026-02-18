import { Prisma, StockMovementType } from "@prisma/client";

// Stock with variant and product information
export type StockWithVariant = Prisma.StockGetPayload<{
  include: {
    variant: {
      include: {
        product: {
          include: {
            category: true;
          };
        };
        attributes: {
          include: {
            option: {
              include: {
                template: true;
              };
            };
          };
        };
      };
    };
  };
}>;

// Serialized stock for client (Decimal prices → number)
export type StockWithVariantSerialized = Omit<StockWithVariant, "variant"> & {
  variant: Omit<StockWithVariant["variant"], "price" | "costPrice"> & {
    price: number;
    costPrice: number;
  };
  isLowStock: boolean; // Computed field
};

// Stock movement with variant info (raw Prisma, internal use only)
type StockMovementWithVariantRaw = Prisma.StockMovementGetPayload<{
  include: {
    variant: {
      include: {
        product: true;
      };
    };
  };
}>;

// Serialized stock movement for client (Decimal → number)
export type StockMovementWithVariant = Omit<
  StockMovementWithVariantRaw,
  "variant"
> & {
  variant: Omit<
    StockMovementWithVariantRaw["variant"],
    "price" | "costPrice"
  > & {
    price: number;
    costPrice: number;
  };
};

// Optimistic action types for stock operations
export type StockOptimisticAction =
  | { type: "adjust"; variantId: string; newQuantity: number }
  | { type: "updateMinimum"; variantId: string; newMinimum: number };

// Stock adjustment input
export interface StockAdjustmentInput {
  productVariantId: string;
  type: StockMovementType;
  quantity: number;
  reason?: string;
}

// Update minimum stock input
export interface UpdateMinimumStockInput {
  productVariantId: string;
  minimumStock: number;
}

// Stock filter options
export interface StockFilterOptions {
  search?: string;
  categoryId?: string;
  lowStockOnly?: boolean;
  page?: number;
  pageSize?: number;
}

// Pagination info
export interface StockPaginationInfo {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasMore: boolean;
}
