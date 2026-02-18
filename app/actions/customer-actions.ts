"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  createCustomerSchema,
  customerFiltersSchema,
  customerPaginationSchema,
  updateCustomerSchema,
  type CreateCustomerInput,
  type UpdateCustomerInput,
} from "@/lib/validations/customer-schema";
import type {
  Customer,
  CustomerListResult,
  CustomerWithSalesCount,
} from "@/types/customer";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

// ============================================
// HELPER FUNCTIONS
// ============================================

function serializeCustomer(
  customer: Prisma.CustomerGetPayload<Record<string, never>>,
): Customer {
  return {
    ...customer,
    createdAt: customer.createdAt.toISOString(),
    updatedAt: customer.updatedAt.toISOString(),
    deletedAt: customer.deletedAt ? customer.deletedAt.toISOString() : null,
  };
}

function serializeCustomerWithCount(
  customer: Prisma.CustomerGetPayload<{
    include: { _count: { select: { sales: true } } };
  }>,
): CustomerWithSalesCount {
  return {
    ...customer,
    createdAt: customer.createdAt.toISOString(),
    updatedAt: customer.updatedAt.toISOString(),
    deletedAt: customer.deletedAt ? customer.deletedAt.toISOString() : null,
  };
}

// ============================================
// CUSTOMER ACTIONS
// ============================================

/**
 * Get paginated list of customers
 */
export async function getCustomers(
  filters?: { search?: string },
  page = 1,
  pageSize = 50,
): Promise<CustomerListResult> {
  const session = await auth();
  if (!session?.user) {
    throw new Error("No autenticado");
  }

  const validatedFilters = customerFiltersSchema.parse(filters ?? {});
  const validatedPagination = customerPaginationSchema.parse({ page, pageSize });

  const where: Prisma.CustomerWhereInput = {
    deletedAt: null,
  };

  if (validatedFilters.search) {
    where.OR = [
      {
        firstName: {
          contains: validatedFilters.search,
          mode: "insensitive",
        },
      },
      {
        lastName: {
          contains: validatedFilters.search,
          mode: "insensitive",
        },
      },
      {
        email: {
          contains: validatedFilters.search,
          mode: "insensitive",
        },
      },
      {
        dni: {
          contains: validatedFilters.search,
          mode: "insensitive",
        },
      },
      {
        membershipNumber: {
          contains: validatedFilters.search,
          mode: "insensitive",
        },
      },
    ];
  }

  const skip =
    (validatedPagination.page - 1) * validatedPagination.pageSize;

  const [customers, totalCount] = await Promise.all([
    prisma.customer.findMany({
      where,
      include: {
        _count: {
          select: { sales: true },
        },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: validatedPagination.pageSize,
    }),
    prisma.customer.count({ where }),
  ]);

  const totalPages = Math.ceil(totalCount / validatedPagination.pageSize);

  return {
    customers: customers.map(serializeCustomerWithCount),
    pagination: {
      page: validatedPagination.page,
      pageSize: validatedPagination.pageSize,
      totalCount,
      totalPages,
      hasMore: validatedPagination.page < totalPages,
    },
  };
}

/**
 * Get a single customer by ID
 */
export async function getCustomerById(id: string): Promise<Customer | null> {
  const session = await auth();
  if (!session?.user) {
    throw new Error("No autenticado");
  }

  const customer = await prisma.customer.findFirst({
    where: { id, deletedAt: null },
  });

  if (!customer) return null;
  return serializeCustomer(customer);
}

/**
 * Create a new customer
 */
export async function createCustomer(
  data: CreateCustomerInput,
): Promise<Customer> {
  const session = await auth();
  if (!session?.user) {
    throw new Error("No autenticado");
  }

  const validated = createCustomerSchema.parse(data);

  // Normalize empty strings to null/undefined for unique fields
  const email = validated.email || null;
  const dni = validated.dni || null;
  const membershipNumber = validated.membershipNumber || null;

  const customer = await prisma.customer.create({
    data: {
      firstName: validated.firstName,
      lastName: validated.lastName,
      email: email ?? undefined,
      phone: validated.phone || undefined,
      address: validated.address || undefined,
      dni: dni ?? undefined,
      membershipNumber: membershipNumber ?? undefined,
    },
  });

  revalidatePath("/panel/customers");
  return serializeCustomer(customer);
}

/**
 * Update an existing customer
 */
export async function updateCustomer(
  data: UpdateCustomerInput,
): Promise<Customer> {
  const session = await auth();
  if (!session?.user) {
    throw new Error("No autenticado");
  }

  const validated = updateCustomerSchema.parse(data);

  const existing = await prisma.customer.findFirst({
    where: { id: validated.id, deletedAt: null },
  });

  if (!existing) {
    throw new Error("Cliente no encontrado");
  }

  // Normalize empty strings to null for unique optional fields
  const email = validated.email || null;
  const dni = validated.dni || null;
  const membershipNumber = validated.membershipNumber || null;

  const customer = await prisma.customer.update({
    where: { id: validated.id },
    data: {
      firstName: validated.firstName,
      lastName: validated.lastName,
      email,
      phone: validated.phone || null,
      address: validated.address || null,
      dni,
      membershipNumber,
    },
  });

  revalidatePath("/panel/customers");
  return serializeCustomer(customer);
}

/**
 * Soft-delete a customer
 */
export async function deleteCustomer(id: string): Promise<void> {
  const session = await auth();
  if (!session?.user) {
    throw new Error("No autenticado");
  }

  const existing = await prisma.customer.findFirst({
    where: { id, deletedAt: null },
  });

  if (!existing) {
    throw new Error("Cliente no encontrado");
  }

  await prisma.customer.update({
    where: { id },
    data: { deletedAt: new Date() },
  });

  revalidatePath("/panel/customers");
}

/**
 * Search customers for autocomplete / marketing lists
 */
export async function searchCustomers(query: string): Promise<Customer[]> {
  const session = await auth();
  if (!session?.user) {
    throw new Error("No autenticado");
  }

  if (!query || query.length < 2) return [];

  const customers = await prisma.customer.findMany({
    where: {
      deletedAt: null,
      OR: [
        { firstName: { contains: query, mode: "insensitive" } },
        { lastName: { contains: query, mode: "insensitive" } },
        { email: { contains: query, mode: "insensitive" } },
        { dni: { contains: query, mode: "insensitive" } },
        { membershipNumber: { contains: query, mode: "insensitive" } },
      ],
    },
    take: 20,
    orderBy: { firstName: "asc" },
  });

  return customers.map(serializeCustomer);
}
