import { Prisma, SaleStatus, PaymentMethod } from "@prisma/client";

export const SALE_STATUS_LABELS: Record<SaleStatus, string> = {
  PENDING: "Pendiente",
  COMPLETED: "Completada",
  CANCELED: "Cancelada",
  REFUNDED: "Reembolsada",
} as const;

// Raw sale item from database
type RawSaleItem = Prisma.SaleItemGetPayload<{
  include: {
    variant: {
      include: {
        product: true;
        stock: true;
      };
    };
  };
}>;

// Serialized sale item for client (Decimal → number)
export type SaleItem = Omit<RawSaleItem, "priceAtSale" | "costAtSale" | "variant"> & {
  priceAtSale: number;
  costAtSale: number;
  variant: Omit<RawSaleItem["variant"], "price" | "costPrice"> & {
    price: number;
    costPrice: number;
    product: RawSaleItem["variant"]["product"];
  };
};

// Raw payment from database
type RawPayment = Prisma.PaymentGetPayload<{
  include: {
    sale: false;
  };
}>;

// Serialized payment for client (Decimal → number, DateTime → string)
export type Payment = Omit<RawPayment, "amount" | "createdAt"> & {
  amount: number;
  createdAt: string;
};

// Raw sale from database with all relations
type RawSaleWithRelations = Prisma.SaleGetPayload<{
  include: {
    items: {
      include: {
        variant: {
          include: {
            product: true;
            stock: true;
          };
        };
      };
    };
    payments: true;
    customer: true;
    user: {
      select: {
        id: true;
        name: true;
        email: true;
      };
    };
  };
}>;

// Serialized sale for client (Decimal → number, DateTime → string)
export type SaleWithRelations = Omit<
  RawSaleWithRelations,
  "subtotal" | "tax" | "discount" | "total" | "totalCost" | "createdAt" | "items" | "payments"
> & {
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  totalCost: number | null;
  createdAt: string;
  items: SaleItem[];
  payments: Payment[];
};

// Sale summary (for list/table views - without full item details)
export type SaleSummary = Omit<SaleWithRelations, "items"> & {
  itemCount: number;
  items?: SaleItem[]; // Optional full items
};

// Optimistic sale item action for useOptimistic hook
export type OptimisticSaleItemAction =
  | { type: "add"; tempId: string; variantId: string; quantity: number }
  | { type: "remove"; itemId: string }
  | { type: "updateQuantity"; itemId: string; quantity: number };

// Pagination information
export interface SalePaginationInfo {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasMore: boolean;
}

// Sale list result with pagination
export interface SaleListResult {
  sales: SaleSummary[];
  pagination: SalePaginationInfo;
}

// Sale filters
export interface SaleFilters {
  status?: SaleStatus;
  userId?: string;
  customerId?: string;
  sessionId?: string;
  paymentMethod?: PaymentMethod;
  createdAfter?: Date;
  createdBefore?: Date;
  minTotal?: number;
  maxTotal?: number;
  search?: string; // Search by customer name or email
}

// Product variant search result (for product search in sale form)
export interface ProductVariantSearchResult {
  id: string;
  sku: string;
  displayName: string | null;
  productName: string;
  price: number;
  costPrice: number;
  stockQuantity: number;
}

// Sale statistics
export interface SaleStatistics {
  totalSales: number;
  totalRevenue: number;
  totalCost: number;
  totalProfit: number;
  averageSaleValue: number;
  salesByStatus: Record<SaleStatus, number>;
  salesByPaymentMethod: Record<PaymentMethod, number>;
}
