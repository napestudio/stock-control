import { Prisma } from "@prisma/client";

// Raw product from database with Decimal types
type RawProductWithRelations = Prisma.ProductGetPayload<{
  include: {
    category: true;
    variants: {
      include: {
        stock: true;
      };
    };
  };
}>;

// Serialized product for client (Decimal → number)
export type ProductWithRelations = Omit<RawProductWithRelations, 'variants'> & {
  variants: Array<
    Omit<RawProductWithRelations['variants'][0], 'price' | 'costPrice'> & {
      price: number;
      costPrice: number;
    }
  >;
};

// Variant with stock (serialized)
export type VariantWithStock = Omit<
  Prisma.ProductVariantGetPayload<{
    include: {
      stock: true;
    };
  }>,
  'price' | 'costPrice'
> & {
  price: number;
  costPrice: number;
};

// Optimistic update action types for useOptimistic hook
export type OptimisticAction =
  | { type: "create"; tempId: string; product: ProductWithRelations }
  | { type: "update"; id: string; product: Partial<ProductWithRelations> }
  | { type: "delete"; id: string };

// Pagination information
export interface PaginationInfo {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasMore: boolean;
}

// Product list result with pagination
export interface ProductListResult {
  products: ProductWithRelations[];
  pagination: PaginationInfo;
}
