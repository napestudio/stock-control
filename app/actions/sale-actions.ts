"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  addSaleItemSchema,
  completeSaleSchema,
  createSaleSchema,
  customerSchema,
  paginationSchema,
  quickSaleSchema,
  saleFiltersSchema,
  updateSaleItemQuantitySchema,
  type AddSaleItemInput,
  type CompleteSaleInput,
  type CreateSaleInput,
  type CustomerInput,
  type QuickSaleInput,
  type SaleFiltersInput,
  type UpdateSaleItemQuantityInput,
} from "@/lib/validations/sale-schema";
import type { Customer } from "@/types/customer";
import type {
  ProductVariantSearchResult,
  SaleListResult,
  SaleSummary,
  SaleWithRelations,
} from "@/types/sale";
import type { VariantScanDetail } from "@/types/toolbar";
import { CashMovementType, Prisma, SaleStatus, StockMovementType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { getMyActiveSession } from "./cash-session-actions";

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Serialize sale for client (Decimal → number, Date → ISO string)
 */
function serializeSale(
  sale: Prisma.SaleGetPayload<{
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
  }>,
): SaleWithRelations {
  return {
    ...sale,
    subtotal: Number(sale.subtotal),
    tax: Number(sale.tax),
    discount: Number(sale.discount),
    total: Number(sale.total),
    totalCost: sale.totalCost ? Number(sale.totalCost) : null,
    createdAt: sale.createdAt.toISOString(),
    items: sale.items.map((item) => ({
      ...item,
      priceAtSale: Number(item.priceAtSale),
      costAtSale: Number(item.costAtSale),
      variant: {
        ...item.variant,
        price: Number(item.variant.price),
        costPrice: Number(item.variant.costPrice),
      },
    })),
    payments: sale.payments.map((payment) => ({
      ...payment,
      amount: Number(payment.amount),
      createdAt: payment.createdAt.toISOString(),
    })),
  };
}

/**
 * Serialize customer for client (Date → ISO string)
 */
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

// ============================================
// CUSTOMER ACTIONS
// ============================================

/**
 * Search customer by email
 * Returns customer if found, null otherwise
 */
export async function searchCustomerByEmail(
  email: string,
): Promise<Customer | null> {
  const session = await auth();

  if (!session?.user) {
    throw new Error("No autenticado");
  }

  if (!email || email.length < 3) {
    return null;
  }

  const customer = await prisma.customer.findUnique({
    where: { email },
  });

  if (!customer) {
    return null;
  }

  return serializeCustomer(customer);
}

/**
 * Get or create customer by email (upsert)
 * Updates existing customer info if email matches
 */
export async function getOrCreateCustomer(
  data: CustomerInput,
): Promise<Customer> {
  const session = await auth();

  if (!session?.user) {
    throw new Error("No autenticado");
  }

  // Validate input
  const validated = customerSchema.parse(data);

  // Upsert customer
  const customer = await prisma.customer.upsert({
    where: { email: validated.email },
    create: validated,
    update: {
      firstName: validated.firstName,
      lastName: validated.lastName,
      phone: validated.phone,
      address: validated.address,
    },
  });

  return serializeCustomer(customer);
}

// ============================================
// SALE ACTIONS
// ============================================

/**
 * Get current user's pending sale (if any)
 * Returns null if no pending sale exists
 */
export async function getMyCurrentSale(): Promise<SaleWithRelations | null> {
  const session = await auth();

  if (!session?.user) {
    throw new Error("No autenticado");
  }

  const sale = await prisma.sale.findFirst({
    where: {
      userId: session.user.id,
      status: SaleStatus.PENDING,
    },
    include: {
      items: {
        include: {
          variant: {
            include: {
              product: true,
              stock: true,
            },
          },
        },
      },
      payments: true,
      customer: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  if (!sale) {
    return null;
  }

  return serializeSale(sale);
}

/**
 * Get all pending sales for current user
 * Supports multiple pending sales workflow
 */
export async function getMyPendingSales(): Promise<SaleWithRelations[]> {
  const session = await auth();

  if (!session?.user) {
    throw new Error("No autenticado");
  }

  const sales = await prisma.sale.findMany({
    where: {
      userId: session.user.id,
      status: SaleStatus.PENDING,
    },
    include: {
      items: {
        include: {
          variant: {
            include: {
              product: true,
              stock: true,
            },
          },
        },
      },
      payments: true,
      customer: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc", // Most recent first
    },
  });

  return sales.map(serializeSale);
}

/**
 * Create a new pending sale for the current user
 * Supports multiple pending sales per user
 */
export async function createSale(
  data: CreateSaleInput = {},
): Promise<SaleWithRelations> {
  const session = await auth();

  if (!session?.user) {
    throw new Error("No autenticado");
  }

  // Validate input
  const validated = createSaleSchema.parse(data);

  // Try to get active cash session to link sale automatically
  let sessionId = validated.sessionId;
  if (!sessionId) {
    try {
      const activeSession = await getMyActiveSession();
      sessionId = activeSession?.id || null;
    } catch {
      // No active session - continue without linking
      sessionId = null;
    }
  }

  // Create pending sale (supports multiple pending sales per user)
  const sale = await prisma.sale.create({
    data: {
      userId: session.user.id,
      status: SaleStatus.PENDING,
      sessionId,
      subtotal: 0,
      tax: 0,
      discount: 0,
      total: 0,
    },
    include: {
      items: {
        include: {
          variant: {
            include: {
              product: true,
              stock: true,
            },
          },
        },
      },
      payments: true,
      customer: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  revalidatePath("/panel/sales");

  return serializeSale(sale);
}

/**
 * Add item to pending sale
 * Validates stock availability (optimistic check)
 */
export async function addSaleItem(data: AddSaleItemInput) {
  const session = await auth();

  if (!session?.user) {
    throw new Error("No autenticado");
  }

  // Validate input
  const validated = addSaleItemSchema.parse(data);

  // Verify sale exists and is PENDING
  const sale = await prisma.sale.findUnique({
    where: { id: validated.saleId },
    include: {
      items: true,
    },
  });

  if (!sale) {
    throw new Error("Venta no encontrada");
  }

  if (sale.status !== SaleStatus.PENDING) {
    throw new Error("Solo se pueden agregar items a ventas pendientes");
  }

  if (sale.userId !== session.user.id) {
    throw new Error("No autorizado");
  }

  // Check if item already exists in sale
  const existingItem = sale.items.find(
    (item) => item.productVariantId === validated.productVariantId,
  );

  if (existingItem) {
    // Update quantity
    const updatedItem = await prisma.saleItem.update({
      where: { id: existingItem.id },
      data: {
        quantity: existingItem.quantity + validated.quantity,
      },
      include: {
        variant: {
          include: {
            product: true,
            stock: true,
          },
        },
      },
    });

    revalidatePath("/panel/sales");

    return {
      ...updatedItem,
      priceAtSale: Number(updatedItem.priceAtSale),
      costAtSale: Number(updatedItem.costAtSale),
      variant: {
        ...updatedItem.variant,
        price: Number(updatedItem.variant.price),
        costPrice: Number(updatedItem.variant.costPrice),
      },
    };
  }

  // Get variant with stock info
  const variant = await prisma.productVariant.findUnique({
    where: { id: validated.productVariantId },
    include: {
      stock: true,
      product: true,
    },
  });

  if (!variant) {
    throw new Error("Variante de producto no encontrada");
  }

  // Optimistic stock check (warning only)
  if (variant.stock && variant.stock.quantity < validated.quantity) {
    // We don't throw here - just create the item
    // Final validation happens on sale completion
    console.warn(
      `Low stock warning: ${variant.sku} - Available: ${variant.stock.quantity}, Requested: ${validated.quantity}`,
    );
  }

  // Create sale item
  const saleItem = await prisma.saleItem.create({
    data: {
      saleId: validated.saleId,
      productVariantId: validated.productVariantId,
      quantity: validated.quantity,
      priceAtSale: 0, // Will be set on sale completion
      costAtSale: 0, // Will be set on sale completion
    },
    include: {
      variant: {
        include: {
          product: true,
          stock: true,
        },
      },
    },
  });

  revalidatePath("/panel/sales");

  return {
    ...saleItem,
    priceAtSale: Number(saleItem.priceAtSale),
    costAtSale: Number(saleItem.costAtSale),
    variant: {
      ...saleItem.variant,
      price: Number(saleItem.variant.price),
      costPrice: Number(saleItem.variant.costPrice),
    },
  };
}

/**
 * Remove item from pending sale
 */
export async function removeSaleItem(saleItemId: string) {
  const session = await auth();

  if (!session?.user) {
    throw new Error("No autenticado");
  }

  // Get sale item with sale info
  const saleItem = await prisma.saleItem.findUnique({
    where: { id: saleItemId },
    include: {
      sale: true,
    },
  });

  if (!saleItem) {
    throw new Error("Item de venta no encontrado");
  }

  if (saleItem.sale.status !== SaleStatus.PENDING) {
    throw new Error("Solo se pueden eliminar items de ventas pendientes");
  }

  if (saleItem.sale.userId !== session.user.id) {
    throw new Error("No autorizado");
  }

  // Delete sale item
  await prisma.saleItem.delete({
    where: { id: saleItemId },
  });

  revalidatePath("/panel/sales");

  return { success: true };
}

/**
 * Update quantity of item in pending sale
 */
export async function updateSaleItemQuantity(
  data: UpdateSaleItemQuantityInput,
) {
  const session = await auth();

  if (!session?.user) {
    throw new Error("No autenticado");
  }

  // Validate input
  const validated = updateSaleItemQuantitySchema.parse(data);

  // Get sale item with sale info
  const saleItem = await prisma.saleItem.findUnique({
    where: { id: validated.saleItemId },
    include: {
      sale: true,
    },
  });

  if (!saleItem) {
    throw new Error("Item de venta no encontrado");
  }

  if (saleItem.sale.status !== SaleStatus.PENDING) {
    throw new Error("Solo se pueden modificar items de ventas pendientes");
  }

  if (saleItem.sale.userId !== session.user.id) {
    throw new Error("No autorizado");
  }

  // Update quantity
  const updatedItem = await prisma.saleItem.update({
    where: { id: validated.saleItemId },
    data: {
      quantity: validated.quantity,
    },
    include: {
      variant: {
        include: {
          product: true,
          stock: true,
        },
      },
    },
  });

  revalidatePath("/panel/sales");

  return {
    ...updatedItem,
    priceAtSale: Number(updatedItem.priceAtSale),
    costAtSale: Number(updatedItem.costAtSale),
    variant: {
      ...updatedItem.variant,
      price: Number(updatedItem.variant.price),
      costPrice: Number(updatedItem.variant.costPrice),
    },
  };
}

/**
 * Cancel pending sale
 */
export async function cancelSale(saleId: string) {
  const session = await auth();

  if (!session?.user) {
    throw new Error("No autenticado");
  }

  // Get sale
  const sale = await prisma.sale.findUnique({
    where: { id: saleId },
  });

  if (!sale) {
    throw new Error("Venta no encontrada");
  }

  if (sale.status !== SaleStatus.PENDING) {
    throw new Error("Solo se pueden cancelar ventas pendientes");
  }

  if (sale.userId !== session.user.id) {
    throw new Error("No autorizado");
  }

  // Delete sale and items (cascade)
  await prisma.sale.delete({
    where: { id: saleId },
  });

  revalidatePath("/panel/sales");

  return { success: true };
}

/**
 * Complete sale - CRITICAL TRANSACTION
 * Creates payments, deducts stock, updates sale status
 * All operations are atomic - succeed together or fail together
 */
export async function completeSale(
  data: CompleteSaleInput,
): Promise<SaleWithRelations> {
  const session = await auth();

  if (!session?.user) {
    throw new Error("No autenticado");
  }

  // Validate input
  const validated = completeSaleSchema.parse(data);

  // Use transaction for atomicity
  const completedSale = await prisma.$transaction(async (tx) => {
    // 1. Get sale with items
    const sale = await tx.sale.findUnique({
      where: { id: validated.saleId },
      include: {
        items: {
          include: {
            variant: {
              include: {
                stock: true,
                product: true,
              },
            },
          },
        },
      },
    });

    if (!sale) {
      throw new Error("Venta no encontrada");
    }

    if (sale.status !== SaleStatus.PENDING) {
      throw new Error("Solo se pueden completar ventas pendientes");
    }

    if (sale.userId !== session.user.id) {
      throw new Error("No autorizado");
    }

    if (sale.items.length === 0) {
      throw new Error("La venta debe tener al menos un item");
    }

    // 2. Handle customer (get or create)
    let customerId = validated.customerId;

    if (validated.customerData) {
      const customer = await tx.customer.upsert({
        where: { email: validated.customerData.email },
        create: validated.customerData,
        update: {
          firstName: validated.customerData.firstName,
          lastName: validated.customerData.lastName,
          phone: validated.customerData.phone,
          address: validated.customerData.address,
        },
      });
      customerId = customer.id;
    }

    if (!customerId) {
      throw new Error("Cliente requerido");
    }

    // 3. Calculate totals from current prices
    let subtotal = 0;
    let totalCost = 0;

    for (const item of sale.items) {
      const itemSubtotal = Number(item.variant.price) * item.quantity;
      const itemCost = Number(item.variant.costPrice) * item.quantity;

      subtotal += itemSubtotal;
      totalCost += itemCost;
    }

    const total = subtotal; // Can add tax/discount later

    // 4. Validate payment amounts sum equals total
    const paymentsTotal = validated.payments.reduce(
      (sum, payment) => sum + payment.amount,
      0,
    );

    if (Math.abs(paymentsTotal - total) > 0.01) {
      // Allow 1 cent difference for rounding
      throw new Error(
        `Los pagos deben sumar exactamente ${total.toFixed(2)}. Total de pagos: ${paymentsTotal.toFixed(2)}`,
      );
    }

    // 5. For each item: Check stock, create movement, update stock
    for (const item of sale.items) {
      const variant = item.variant;

      // Check stock availability (authoritative check)
      if (!variant.stock) {
        throw new Error(`Stock no encontrado para ${variant.sku}`);
      }

      if (variant.stock.quantity < item.quantity) {
        throw new Error(
          `Stock insuficiente para ${variant.sku}. Disponible: ${variant.stock.quantity}, Requerido: ${item.quantity}`,
        );
      }

      // Create stock movement
      await tx.stockMovement.create({
        data: {
          productVariantId: item.productVariantId,
          type: StockMovementType.OUT,
          quantity: item.quantity,
          reason: `Venta #${sale.id.slice(0, 8)}`,
          saleItemId: item.id,
        },
      });

      // Update stock
      await tx.stock.update({
        where: { productVariantId: item.productVariantId },
        data: {
          quantity: {
            decrement: item.quantity,
          },
        },
      });

      // Update sale item with prices at sale
      await tx.saleItem.update({
        where: { id: item.id },
        data: {
          priceAtSale: item.variant.price,
          costAtSale: item.variant.costPrice,
        },
      });

      // Verify no negative stock
      const updatedStock = await tx.stock.findUnique({
        where: { productVariantId: item.productVariantId },
      });

      if (updatedStock && updatedStock.quantity < 0) {
        throw new Error(
          `Error de concurrencia: Stock negativo detectado para ${variant.sku}`,
        );
      }
    }

    // 6. Create payment records
    for (const payment of validated.payments) {
      await tx.payment.create({
        data: {
          saleId: sale.id,
          method: payment.method,
          amount: payment.amount,
        },
      });
    }

    // 6b. Create SALE cash movements for each payment (if session exists)
    if (validated.sessionId) {
      // Verify session is OPEN
      const cashSession = await tx.cashSession.findUnique({
        where: { id: validated.sessionId },
      });

      if (cashSession && cashSession.status === "OPEN") {
        for (const payment of validated.payments) {
          await tx.cashMovement.create({
            data: {
              sessionId: validated.sessionId,
              saleId: sale.id,
              type: CashMovementType.SALE,
              paymentMethod: payment.method,
              amount: payment.amount,
              description: `Venta #${sale.id.slice(0, 8)}`,
              createdBy: session.user.id,
            },
          });
        }
      }
    }

    // 7. Update sale to COMPLETED
    const updated = await tx.sale.update({
      where: { id: sale.id },
      data: {
        status: SaleStatus.COMPLETED,
        customerId,
        sessionId: validated.sessionId,
        subtotal,
        total,
        totalCost,
        tax: 0,
        discount: 0,
      },
      include: {
        items: {
          include: {
            variant: {
              include: {
                product: true,
                stock: true,
              },
            },
          },
        },
        payments: true,
        customer: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return updated;
  });

  // Revalidate paths
  revalidatePath("/panel/sales");
  revalidatePath("/panel/stock");

  return serializeSale(completedSale);
}

/**
 * Get a single product variant by SKU for use in the quick sale flow
 */
export async function getVariantBySkuForSale(
  sku: string,
): Promise<ProductVariantSearchResult | null> {
  const session = await auth();

  if (!session?.user) {
    throw new Error("No autenticado");
  }

  const variant = await prisma.productVariant.findUnique({
    where: { sku },
    include: {
      product: {
        select: { name: true, active: true, deletedAt: true },
      },
      stock: {
        select: { quantity: true },
      },
    },
  });

  if (!variant || !variant.product.active || variant.product.deletedAt) {
    return null;
  }

  return {
    id: variant.id,
    sku: variant.sku,
    displayName: variant.displayName || variant.name || "",
    productName: variant.product.name,
    price: Number(variant.price),
    costPrice: Number(variant.costPrice),
    stockQuantity: variant.stock?.quantity ?? 0,
  };
}

/**
 * Quick sale - atomic sale from a QR scan, no customer required
 * Creates a sale with one item and immediately completes it
 */
export async function quickSale(
  data: QuickSaleInput,
): Promise<SaleWithRelations> {
  const session = await auth();

  if (!session?.user) {
    throw new Error("No autenticado");
  }

  const validated = quickSaleSchema.parse(data);

  // Auto-detect active cash session if not provided
  let sessionId = validated.sessionId ?? null;
  if (sessionId === null) {
    try {
      const activeSession = await getMyActiveSession();
      sessionId = activeSession?.id ?? null;
    } catch {
      sessionId = null;
    }
  }

  const completedSale = await prisma.$transaction(async (tx) => {
    // 1. Look up variant with stock
    const variant = await tx.productVariant.findUnique({
      where: { id: validated.productVariantId },
      include: {
        stock: true,
        product: {
          select: { name: true, active: true, deletedAt: true },
        },
      },
    });

    if (!variant) {
      throw new Error("Variante de producto no encontrada");
    }

    if (!variant.product.active || variant.product.deletedAt) {
      throw new Error("Producto no disponible para la venta");
    }

    if (!variant.stock) {
      throw new Error(`Stock no encontrado para ${variant.sku}`);
    }

    if (variant.stock.quantity < validated.quantity) {
      throw new Error(
        `Stock insuficiente para ${variant.sku}. Disponible: ${variant.stock.quantity}, Requerido: ${validated.quantity}`,
      );
    }

    const unitPrice = Number(variant.price);
    const unitCost = Number(variant.costPrice);
    const total = unitPrice * validated.quantity;
    const totalCost = unitCost * validated.quantity;

    // 2. Create the sale
    const sale = await tx.sale.create({
      data: {
        userId: session.user.id,
        status: SaleStatus.PENDING,
        sessionId,
        subtotal: total,
        tax: 0,
        discount: 0,
        total,
        totalCost,
      },
    });

    // 3. Create sale item with price snapshot
    const saleItem = await tx.saleItem.create({
      data: {
        saleId: sale.id,
        productVariantId: validated.productVariantId,
        quantity: validated.quantity,
        priceAtSale: unitPrice,
        costAtSale: unitCost,
      },
    });

    // 4. Create stock OUT movement
    await tx.stockMovement.create({
      data: {
        productVariantId: validated.productVariantId,
        type: StockMovementType.OUT,
        quantity: validated.quantity,
        reason: `Venta rápida #${sale.id.slice(0, 8)}`,
        saleItemId: saleItem.id,
      },
    });

    // 5. Decrement stock
    await tx.stock.update({
      where: { productVariantId: validated.productVariantId },
      data: { quantity: { decrement: validated.quantity } },
    });

    // Guard against race conditions
    const updatedStock = await tx.stock.findUnique({
      where: { productVariantId: validated.productVariantId },
    });
    if (updatedStock && updatedStock.quantity < 0) {
      throw new Error(
        `Error de concurrencia: Stock negativo detectado para ${variant.sku}`,
      );
    }

    // 6. Create payment record
    await tx.payment.create({
      data: {
        saleId: sale.id,
        method: validated.paymentMethod,
        amount: total,
      },
    });

    // 7. Create SALE cash movement if session is OPEN
    if (sessionId) {
      const cashSession = await tx.cashSession.findUnique({
        where: { id: sessionId },
      });
      if (cashSession && cashSession.status === "OPEN") {
        await tx.cashMovement.create({
          data: {
            sessionId,
            saleId: sale.id,
            type: CashMovementType.SALE,
            paymentMethod: validated.paymentMethod,
            amount: total,
            description: `Venta rápida #${sale.id.slice(0, 8)}`,
            createdBy: session.user.id,
          },
        });
      }
    }

    // 8. Mark sale as COMPLETED
    const completed = await tx.sale.update({
      where: { id: sale.id },
      data: { status: SaleStatus.COMPLETED },
      include: {
        items: {
          include: {
            variant: {
              include: {
                product: true,
                stock: true,
              },
            },
          },
        },
        payments: true,
        customer: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return completed;
  });

  revalidatePath("/panel/sales");
  revalidatePath("/panel/stock");

  return serializeSale(completedSale);
}

/**
 * Refund completed sale - CRITICAL TRANSACTION
 * Creates REFUND cash movements, restores stock, updates sale status
 * All operations are atomic - succeed together or fail together
 */
export async function refundSale(
  saleId: string,
  reason: string,
): Promise<SaleWithRelations> {
  const session = await auth();

  if (!session?.user) {
    throw new Error("No autenticado");
  }

  if (!reason || reason.trim().length === 0) {
    throw new Error("Debe proporcionar una razón para el reembolso");
  }

  // Use transaction for atomicity
  const refundedSale = await prisma.$transaction(async (tx) => {
    // 1. Get sale with all relations
    const sale = await tx.sale.findUnique({
      where: { id: saleId },
      include: {
        items: {
          include: {
            variant: {
              include: {
                stock: true,
                product: true,
              },
            },
          },
        },
        payments: true,
        customer: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!sale) {
      throw new Error("Venta no encontrada");
    }

    if (sale.status !== SaleStatus.COMPLETED) {
      throw new Error("Solo se pueden reembolsar ventas completadas");
    }

    // Check authorization (only sale owner or admin can refund)
    if (sale.userId !== session.user.id) {
      // TODO: Add admin role check here if needed
      throw new Error("No autorizado para reembolsar esta venta");
    }

    // 2. Check if sale has linked cash session
    if (sale.sessionId) {
      const cashSession = await tx.cashSession.findUnique({
        where: { id: sale.sessionId },
      });

      if (cashSession && cashSession.status === "CLOSED") {
        throw new Error(
          "No se puede reembolsar. La sesión de caja ya está cerrada.",
        );
      }

      if (cashSession && cashSession.status === "ARCHIVED") {
        throw new Error(
          "No se puede reembolsar. La sesión de caja está archivada.",
        );
      }
    }

    // 3. Restore stock for each item
    for (const item of sale.items) {
      // Create IN stock movement (reverse the OUT movement)
      await tx.stockMovement.create({
        data: {
          productVariantId: item.productVariantId,
          type: StockMovementType.IN,
          quantity: item.quantity,
          reason: `Reembolso venta #${sale.id.slice(0, 8)}: ${reason}`,
          saleItemId: item.id,
        },
      });

      // Increment stock
      await tx.stock.update({
        where: { productVariantId: item.productVariantId },
        data: {
          quantity: {
            increment: item.quantity,
          },
        },
      });
    }

    // 4. Create REFUND cash movements (if session exists and is OPEN)
    if (sale.sessionId) {
      const cashSession = await tx.cashSession.findUnique({
        where: { id: sale.sessionId },
      });

      if (cashSession && cashSession.status === "OPEN") {
        for (const payment of sale.payments) {
          await tx.cashMovement.create({
            data: {
              sessionId: sale.sessionId,
              saleId: sale.id,
              type: CashMovementType.REFUND,
              paymentMethod: payment.method,
              amount: Number(payment.amount),
              description: `Reembolso venta #${sale.id.slice(0, 8)}: ${reason}`,
              createdBy: session.user.id,
            },
          });
        }
      }
    }

    // 5. Update sale status to REFUNDED
    const updated = await tx.sale.update({
      where: { id: sale.id },
      data: {
        status: SaleStatus.REFUNDED,
      },
      include: {
        items: {
          include: {
            variant: {
              include: {
                product: true,
                stock: true,
              },
            },
          },
        },
        payments: true,
        customer: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return updated;
  });

  // Revalidate paths
  revalidatePath("/panel/sales");
  revalidatePath("/panel/stock");
  revalidatePath("/panel/cash-movements");

  return serializeSale(refundedSale);
}

/**
 * Search products for sale (debounced in UI)
 * Returns variants with stock info
 */
export async function searchProductsForSale(
  query: string,
  limit: number = 10,
): Promise<ProductVariantSearchResult[]> {
  const session = await auth();

  if (!session?.user) {
    throw new Error("No autenticado");
  }

  if (query.length < 2) {
    return [];
  }

  const variants = await prisma.productVariant.findMany({
    where: {
      OR: [
        { sku: { contains: query, mode: "insensitive" } },
        { displayName: { contains: query, mode: "insensitive" } },
        { product: { name: { contains: query, mode: "insensitive" } } },
      ],
      product: {
        active: true,
        deletedAt: null,
      },
    },
    include: {
      product: {
        select: {
          name: true,
        },
      },
      stock: {
        select: {
          quantity: true,
        },
      },
    },
    take: limit,
    orderBy: {
      product: {
        name: "asc",
      },
    },
  });

  return variants.map((v) => ({
    id: v.id,
    sku: v.sku,
    displayName: v.displayName || v.name || "",
    productName: v.product.name,
    price: Number(v.price),
    costPrice: Number(v.costPrice),
    stockQuantity: v.stock?.quantity || 0,
  }));
}

/**
 * Get sales history with filters and pagination
 */
export async function getSalesHistory(
  filters?: SaleFiltersInput,
  page: number = 1,
  pageSize: number = 50,
): Promise<SaleListResult> {
  const session = await auth();

  if (!session?.user) {
    throw new Error("No autenticado");
  }

  // Validate pagination
  const validatedPagination = paginationSchema.parse({ page, pageSize });

  const skip = (validatedPagination.page - 1) * validatedPagination.pageSize;
  const take = validatedPagination.pageSize;

  // Build where clause
  const where: Prisma.SaleWhereInput = {};

  if (filters) {
    const validatedFilters = saleFiltersSchema.parse(filters);

    if (validatedFilters.status) {
      where.status = validatedFilters.status;
    }

    if (validatedFilters.userId) {
      where.userId = validatedFilters.userId;
    }

    if (validatedFilters.customerId) {
      where.customerId = validatedFilters.customerId;
    }

    if (validatedFilters.sessionId) {
      where.sessionId = validatedFilters.sessionId;
    }

    if (validatedFilters.paymentMethod) {
      where.payments = {
        some: {
          method: validatedFilters.paymentMethod,
        },
      };
    }

    if (validatedFilters.createdAfter || validatedFilters.createdBefore) {
      where.createdAt = {};
      if (validatedFilters.createdAfter) {
        where.createdAt.gte = validatedFilters.createdAfter;
      }
      if (validatedFilters.createdBefore) {
        where.createdAt.lte = validatedFilters.createdBefore;
      }
    }

    if (
      validatedFilters.minTotal !== undefined ||
      validatedFilters.maxTotal !== undefined
    ) {
      where.total = {};
      if (validatedFilters.minTotal !== undefined) {
        where.total.gte = validatedFilters.minTotal;
      }
      if (validatedFilters.maxTotal !== undefined) {
        where.total.lte = validatedFilters.maxTotal;
      }
    }

    if (validatedFilters.search) {
      where.customer = {
        OR: [
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
          { email: { contains: validatedFilters.search, mode: "insensitive" } },
        ],
      };
    }
  }

  // Get total count
  const totalCount = await prisma.sale.count({ where });

  // Get sales
  const sales = await prisma.sale.findMany({
    where,
    include: {
      items: {
        include: {
          variant: {
            include: {
              product: true,
              stock: true,
            },
          },
        },
      },
      payments: true,
      customer: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    skip,
    take,
  });

  // Serialize sales
  const serializedSales: SaleSummary[] = sales.map((sale) => {
    const serialized = serializeSale(sale);
    return {
      ...serialized,
      itemCount: sale.items.length,
    };
  });

  // Calculate pagination
  const totalPages = Math.ceil(totalCount / validatedPagination.pageSize);
  const hasMore = validatedPagination.page < totalPages;

  return {
    sales: serializedSales,
    pagination: {
      page: validatedPagination.page,
      pageSize: validatedPagination.pageSize,
      totalCount,
      totalPages,
      hasMore,
    },
  };
}

/**
 * Get full variant details by SKU for QR scan dialog
 * Returns richer data than getVariantBySkuForSale (includes images and description)
 */
export async function getVariantDetailsBySku(
  sku: string,
): Promise<VariantScanDetail | null> {
  const session = await auth();

  if (!session?.user) {
    throw new Error("No autenticado");
  }

  const variant = await prisma.productVariant.findUnique({
    where: { sku },
    include: {
      product: {
        select: {
          name: true,
          description: true,
          imageUrl: true,
          active: true,
          deletedAt: true,
        },
      },
      stock: {
        select: { quantity: true },
      },
    },
  });

  if (!variant || !variant.product.active || variant.product.deletedAt) {
    return null;
  }

  return {
    id: variant.id,
    sku: variant.sku,
    displayName: variant.displayName || variant.name || null,
    productName: variant.product.name,
    productDescription: variant.product.description || null,
    productImageUrl: variant.product.imageUrl || null,
    variantImageUrl: variant.imageUrl || null,
    price: Number(variant.price),
    costPrice: Number(variant.costPrice),
    stockQuantity: variant.stock?.quantity ?? 0,
  };
}

/**
 * Get sale details by ID
 */
export async function getSaleDetails(
  saleId: string,
): Promise<SaleWithRelations> {
  const session = await auth();

  if (!session?.user) {
    throw new Error("No autenticado");
  }

  const sale = await prisma.sale.findUnique({
    where: { id: saleId },
    include: {
      items: {
        include: {
          variant: {
            include: {
              product: true,
              stock: true,
            },
          },
        },
      },
      payments: true,
      customer: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  if (!sale) {
    throw new Error("Venta no encontrada");
  }

  return serializeSale(sale);
}
