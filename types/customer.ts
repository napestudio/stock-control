import { Prisma } from "@prisma/client";

// Raw customer from database
type RawCustomer = Prisma.CustomerGetPayload<{
  include: {
    sales: false;
  };
}>;

// Serialized customer for client (DateTime → ISO string)
export type Customer = Omit<RawCustomer, "createdAt" | "updatedAt" | "deletedAt"> & {
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

// Customer with sales count
export type CustomerWithSalesCount = Customer & {
  _count?: {
    sales: number;
  };
};

// Pagination information
export interface CustomerPaginationInfo {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasMore: boolean;
}

// Customer list result with pagination
export interface CustomerListResult {
  customers: CustomerWithSalesCount[];
  pagination: CustomerPaginationInfo;
}

// Customer filters
export interface CustomerFilters {
  search?: string; // Search by firstName, lastName or email
  hasEmail?: boolean;
  createdAfter?: Date;
  createdBefore?: Date;
}
