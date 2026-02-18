"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/utils/auth-helpers";
import {
  openSessionSchema,
  closeSessionSchema,
  cashMovementSchema,
  type OpenSessionInput,
  type CloseSessionInput,
  type CashMovementInput,
} from "@/lib/validations/cash-session-schema";
import { revalidatePath } from "next/cache";
import { CashMovementType, PaymentMethod } from "@prisma/client";
import type { SessionClosingSummary } from "@/types/cash-session";

/**
 * Converts Prisma Decimal fields in CashSession to plain numbers for client serialization
 */
function serializeCashSession<T extends Record<string, unknown>>(session: T) {
  return {
    ...session,
    openingAmount: Number(session.openingAmount),

    // Per-method closing amounts
    closingAmountCash: session.closingAmountCash ? Number(session.closingAmountCash) : null,
    closingAmountCreditCard: session.closingAmountCreditCard ? Number(session.closingAmountCreditCard) : null,
    closingAmountDebitCard: session.closingAmountDebitCard ? Number(session.closingAmountDebitCard) : null,
    closingAmountTransfer: session.closingAmountTransfer ? Number(session.closingAmountTransfer) : null,
    closingAmountCheck: session.closingAmountCheck ? Number(session.closingAmountCheck) : null,

    // Per-method expected amounts
    expectedAmountCash: session.expectedAmountCash ? Number(session.expectedAmountCash) : null,
    expectedAmountCreditCard: session.expectedAmountCreditCard ? Number(session.expectedAmountCreditCard) : null,
    expectedAmountDebitCard: session.expectedAmountDebitCard ? Number(session.expectedAmountDebitCard) : null,
    expectedAmountTransfer: session.expectedAmountTransfer ? Number(session.expectedAmountTransfer) : null,
    expectedAmountCheck: session.expectedAmountCheck ? Number(session.expectedAmountCheck) : null,

    // Per-method differences
    differenceCash: session.differenceCash ? Number(session.differenceCash) : null,
    differenceCreditCard: session.differenceCreditCard ? Number(session.differenceCreditCard) : null,
    differenceDebitCard: session.differenceDebitCard ? Number(session.differenceDebitCard) : null,
    differenceTransfer: session.differenceTransfer ? Number(session.differenceTransfer) : null,
    differenceCheck: session.differenceCheck ? Number(session.differenceCheck) : null,

    // Legacy fields
    closingAmount: session.closingAmount ? Number(session.closingAmount) : null,
    expectedAmount: session.expectedAmount ? Number(session.expectedAmount) : null,
    difference: session.difference ? Number(session.difference) : null,
  };
}

/**
 * Open a new cash register session
 * Validates: User has OPEN_CASH permission, no active session on register, no active session for user
 */
export async function openCashSession(data: OpenSessionInput) {
  const session = await auth();

  if (!session?.user) {
    throw new Error("No autenticado");
  }

  // Check OPEN_CASH permission
  const userWithPermissions = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      role: {
        include: {
          permissions: {
            include: {
              permission: true,
            },
          },
        },
      },
    },
  });

  const hasOpenCashPermission = userWithPermissions?.role?.permissions.some(
    (rp) => rp.permission.key === "OPEN_CASH"
  );

  if (!hasOpenCashPermission) {
    throw new Error("No autorizado: No tiene permiso para abrir caja");
  }

  const validated = openSessionSchema.parse(data);

  // Transaction to ensure atomicity
  const newSession = await prisma.$transaction(async (tx) => {
    // 1. Check if register has active OPEN session
    const activeRegisterSession = await tx.cashSession.findFirst({
      where: {
        cashRegisterId: validated.cashRegisterId,
        status: "OPEN",
      },
    });

    if (activeRegisterSession) {
      throw new Error("Esta caja ya tiene una sesión abierta");
    }

    // 2. Check if user has active OPEN session
    const activeUserSession = await tx.cashSession.findFirst({
      where: {
        userId: session.user.id,
        status: "OPEN",
      },
    });

    if (activeUserSession) {
      throw new Error("Ya tenés una sesión abierta en otra caja");
    }

    // 3. Create session with OPEN status
    const cashSession = await tx.cashSession.create({
      data: {
        cashRegisterId: validated.cashRegisterId,
        userId: session.user.id,
        openingAmount: validated.openingAmount,
        status: "OPEN",
      },
      include: {
        cashRegister: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // NOTE: No longer create OPENING movement (deprecated type)
    // Opening amount is tracked in cashSession.openingAmount field

    return cashSession;
  });

  revalidatePath("/panel/cash-registers");

  return {
    success: true,
    data: {
      ...newSession,
      openingAmount: Number(newSession.openingAmount),
    },
  };
}

/**
 * Get session closing summary
 * Calculates expected amounts by payment method
 */
export async function getSessionClosingSummary(
  sessionId: string
): Promise<SessionClosingSummary> {
  const session = await auth();

  if (!session?.user) {
    throw new Error("No autenticado");
  }

  const cashSession = await prisma.cashSession.findUnique({
    where: { id: sessionId },
    include: {
      movements: true,
    },
  });

  if (!cashSession) {
    throw new Error("Sesión no encontrada");
  }

  if (cashSession.status !== "OPEN") {
    throw new Error(`No se puede obtener resumen: sesión ${cashSession.status === "CLOSED" ? "cerrada" : "archivada"}`);
  }

  // Fetch sales separately to avoid Prisma IN (NULL) bug
  // Trade-off: 2 queries vs 1, but adds ~10ms and ensures reliability
  // Revisit when Prisma 7.4.0+ stable release addresses this issue
  const sales = await prisma.sale.findMany({
    where: {
      sessionId: sessionId,
    },
    include: {
      payments: true,
    },
  });

  // Calculate totals
  const openingAmount = Number(cashSession.openingAmount);

  // Sales totals by payment method
  let salesTotal = 0;
  let cashSalesTotal = 0;
  let creditCardSalesTotal = 0;
  let debitCardSalesTotal = 0;
  let transferSalesTotal = 0;
  let checkSalesTotal = 0;

  sales.forEach((sale) => {
    sale.payments.forEach((payment) => {
      const amount = Number(payment.amount);
      salesTotal += amount;

      switch (payment.method) {
        case PaymentMethod.CASH:
          cashSalesTotal += amount;
          break;
        case PaymentMethod.CREDIT_CARD:
          creditCardSalesTotal += amount;
          break;
        case PaymentMethod.DEBIT_CARD:
          debitCardSalesTotal += amount;
          break;
        case PaymentMethod.TRANSFER:
          transferSalesTotal += amount;
          break;
        case PaymentMethod.CHECK:
          checkSalesTotal += amount;
          break;
      }
    });
  });

  // Cash movements (all payment methods)
  let depositsTotal = 0;
  let withdrawalsTotal = 0;
  let expensesTotal = 0;

  // Cash movements (CASH payment method only)
  let cashDepositsTotal = 0;
  let cashWithdrawalsTotal = 0;
  let cashExpensesTotal = 0;

  // Track movements by payment method (for expected calculations)
  let creditCardMovementsNet = 0;
  let debitCardMovementsNet = 0;
  let transferMovementsNet = 0;
  let checkMovementsNet = 0;

  cashSession.movements.forEach((movement) => {
    const amount = Number(movement.amount);
    const isCash = movement.paymentMethod === PaymentMethod.CASH;

    // Handle both new and deprecated movement types
    switch (movement.type) {
      // NEW TYPES (post-refactor)
      case CashMovementType.INCOME:
        depositsTotal += amount;
        if (isCash) cashDepositsTotal += amount;
        break;
      case CashMovementType.EXPENSE:
        expensesTotal += amount;
        if (isCash) cashExpensesTotal += amount;
        break;
      case CashMovementType.SALE:
        // Sales are already counted in sales totals, skip to avoid double-counting
        break;
      case CashMovementType.REFUND:
        // Refunds subtract from sales
        expensesTotal += amount;
        if (isCash) cashExpensesTotal += amount;
        break;

      // DEPRECATED TYPES (for archived sessions)
      case CashMovementType.DEPOSIT:
        depositsTotal += amount;
        if (isCash) cashDepositsTotal += amount;
        break;
      case CashMovementType.WITHDRAWAL:
        withdrawalsTotal += amount;
        if (isCash) cashWithdrawalsTotal += amount;
        break;
      case CashMovementType.OPENING:
      case CashMovementType.CLOSING:
      case CashMovementType.ADJUSTMENT:
        // Ignore deprecated types in calculations
        break;
    }

    // Track by payment method (net: income/sale +, expense/refund -)
    let sign = 0;
    if (movement.type === CashMovementType.INCOME || movement.type === CashMovementType.SALE || movement.type === CashMovementType.DEPOSIT) {
      sign = 1;
    } else if (movement.type === CashMovementType.EXPENSE || movement.type === CashMovementType.REFUND || movement.type === CashMovementType.WITHDRAWAL) {
      sign = -1;
    }

    switch (movement.paymentMethod) {
      case PaymentMethod.CREDIT_CARD:
        creditCardMovementsNet += sign * amount;
        break;
      case PaymentMethod.DEBIT_CARD:
        debitCardMovementsNet += sign * amount;
        break;
      case PaymentMethod.TRANSFER:
        transferMovementsNet += sign * amount;
        break;
      case PaymentMethod.CHECK:
        checkMovementsNet += sign * amount;
        break;
    }
  });

  // Calculate expected per payment method (sales + movements)
  const expectedCash =
    openingAmount +
    cashSalesTotal +
    cashDepositsTotal -
    cashWithdrawalsTotal -
    cashExpensesTotal;

  const expectedCreditCard = creditCardSalesTotal + creditCardMovementsNet;
  const expectedDebitCard = debitCardSalesTotal + debitCardMovementsNet;
  const expectedTransfer = transferSalesTotal + transferMovementsNet;
  const expectedCheck = checkSalesTotal + checkMovementsNet;

  // Expected total counts all payment methods
  const expectedTotal =
    expectedCash +
    expectedCreditCard +
    expectedDebitCard +
    expectedTransfer +
    expectedCheck;

  return {
    openingAmount,
    salesTotal,
    cashSalesTotal,
    creditCardSalesTotal,
    debitCardSalesTotal,
    transferSalesTotal,
    checkSalesTotal,
    depositsTotal,
    withdrawalsTotal,
    expensesTotal,
    cashDepositsTotal,
    cashWithdrawalsTotal,
    cashExpensesTotal,
    // Expected amounts per payment method
    expectedCash,
    expectedCreditCard,
    expectedDebitCard,
    expectedTransfer,
    expectedCheck,
    expectedTotal,
  };
}

/**
 * Close cash session
 * Validates: User has CLOSE_CASH permission, can close own session or any if admin
 */
export async function closeCashSession(data: CloseSessionInput) {
  const session = await auth();

  if (!session?.user) {
    throw new Error("No autenticado");
  }

  // Check CLOSE_CASH permission
  const userWithPermissions = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      role: {
        include: {
          permissions: {
            include: {
              permission: true,
            },
          },
        },
      },
    },
  });

  const hasCloseCashPermission = userWithPermissions?.role?.permissions.some(
    (rp) => rp.permission.key === "CLOSE_CASH"
  );

  if (!hasCloseCashPermission) {
    throw new Error("No autorizado: No tiene permiso para cerrar caja");
  }

  const validated = closeSessionSchema.parse(data);

  const closedSession = await prisma.$transaction(async (tx) => {
    // Get session first
    const cashSession = await tx.cashSession.findUnique({
      where: { id: validated.sessionId },
    });

    if (!cashSession) {
      throw new Error("Sesión no encontrada");
    }

    if (cashSession.status === "CLOSED") {
      throw new Error("Esta sesión ya está cerrada");
    }

    if (cashSession.status === "ARCHIVED") {
      throw new Error("No se puede cerrar una sesión archivada");
    }

    // CRITICAL VALIDATION: Check for open/pending sales (from reference implementation)
    const openSales = await tx.sale.findMany({
      where: {
        sessionId: validated.sessionId,
        status: "PENDING", // Only PENDING sales are considered "open"
      },
      select: { id: true },
    });

    if (openSales.length > 0) {
      throw new Error(
        `No se puede cerrar la caja con ventas pendientes (${openSales.length} pendiente${openSales.length > 1 ? "s" : ""}). ` +
        `Completá o cancelá las ventas primero.`
      );
    }

    // Check authorization (can close own session or any if admin)
    const userIsAdmin = isAdmin(session);
    const isOwnSession = cashSession.userId === session.user.id;

    if (!userIsAdmin && !isOwnSession) {
      throw new Error("No autorizado: Solo puede cerrar su propia sesión");
    }

    // Calculate expected amounts per payment method
    const summary = await getSessionClosingSummary(validated.sessionId);

    // Extract closing amounts from validated data
    const closingAmounts = {
      cash: validated.closingAmountCash ?? 0,
      creditCard: validated.closingAmountCreditCard ?? 0,
      debitCard: validated.closingAmountDebitCard ?? 0,
      transfer: validated.closingAmountTransfer ?? 0,
      check: validated.closingAmountCheck ?? 0,
    };

    // Calculate differences per payment method
    const differences = {
      cash: closingAmounts.cash - summary.expectedCash,
      creditCard: closingAmounts.creditCard - summary.expectedCreditCard,
      debitCard: closingAmounts.debitCard - summary.expectedDebitCard,
      transfer: closingAmounts.transfer - summary.expectedTransfer,
      check: closingAmounts.check - summary.expectedCheck,
    };

    // Calculate totals for backwards compatibility
    const totalClosing =
      closingAmounts.cash +
      closingAmounts.creditCard +
      closingAmounts.debitCard +
      closingAmounts.transfer +
      closingAmounts.check;

    const totalExpected = summary.expectedTotal;
    const totalDifference = totalClosing - totalExpected;

    // Update session with all amounts and CLOSED status
    const updated = await tx.cashSession.update({
      where: { id: validated.sessionId },
      data: {
        // Closing amounts per method
        closingAmountCash: closingAmounts.cash,
        closingAmountCreditCard: closingAmounts.creditCard,
        closingAmountDebitCard: closingAmounts.debitCard,
        closingAmountTransfer: closingAmounts.transfer,
        closingAmountCheck: closingAmounts.check,

        // Expected amounts per method
        expectedAmountCash: summary.expectedCash,
        expectedAmountCreditCard: summary.expectedCreditCard,
        expectedAmountDebitCard: summary.expectedDebitCard,
        expectedAmountTransfer: summary.expectedTransfer,
        expectedAmountCheck: summary.expectedCheck,

        // Differences per method
        differenceCash: differences.cash,
        differenceCreditCard: differences.creditCard,
        differenceDebitCard: differences.debitCard,
        differenceTransfer: differences.transfer,
        differenceCheck: differences.check,

        // Totals (backwards compatibility)
        closingAmount: totalClosing,
        expectedAmount: totalExpected,
        difference: totalDifference,

        // Close the session with CLOSED status
        status: "CLOSED",
        closedAt: new Date(),
      },
      include: {
        cashRegister: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // NOTE: No longer create CLOSING movement (deprecated type)
    // All movement data is tracked in the session closing fields

    return updated;
  });

  revalidatePath("/panel/cash-registers");

  return {
    success: true,
    data: serializeCashSession(closedSession),
  };
}

/**
 * Add cash movement (deposit, withdrawal, expense)
 */
export async function addCashMovement(data: CashMovementInput) {
  const session = await auth();

  if (!session?.user) {
    throw new Error("No autenticado");
  }

  const validated = cashMovementSchema.parse(data);

  // Verify session exists and is OPEN
  const cashSession = await prisma.cashSession.findUnique({
    where: { id: validated.sessionId },
  });

  if (!cashSession) {
    throw new Error("Sesión no encontrada");
  }

  if (cashSession.status !== "OPEN") {
    throw new Error(`No se pueden agregar movimientos a una sesión ${cashSession.status === "CLOSED" ? "cerrada" : "archivada"}`);
  }

  // NOTE: Only INCOME and EXPENSE types are allowed for manual movements
  // SALE and REFUND are created automatically from sales (see Phase 4)
  // Schema validation enforces this restriction

  // Verify user owns this session or is admin
  const userIsAdmin = isAdmin(session);
  const isOwnSession = cashSession.userId === session.user.id;

  if (!userIsAdmin && !isOwnSession) {
    throw new Error("No autorizado: Solo puede modificar su propia sesión");
  }

  const movement = await prisma.cashMovement.create({
    data: {
      ...validated,
      createdBy: session.user.id,
    },
  });

  revalidatePath("/panel/cash-registers");

  return {
    success: true,
    data: {
      ...movement,
      amount: Number(movement.amount),
    },
  };
}

/**
 * Get session history with pagination
 */
export async function getSessionHistory(
  filters?: {
    cashRegisterId?: string;
    userId?: string;
    dateFrom?: Date;
    dateTo?: Date;
  },
  page: number = 1,
  pageSize: number = 20
) {
  const session = await auth();

  if (!session?.user) {
    throw new Error("No autenticado");
  }

  const skip = (page - 1) * pageSize;
  const take = pageSize;

  const where: {
    cashRegisterId?: string;
    userId?: string;
    openedAt?: {
      gte?: Date;
      lte?: Date;
    };
  } = {};

  if (filters?.cashRegisterId) {
    where.cashRegisterId = filters.cashRegisterId;
  }

  if (filters?.userId) {
    where.userId = filters.userId;
  }

  if (filters?.dateFrom || filters?.dateTo) {
    where.openedAt = {};
    if (filters.dateFrom) where.openedAt.gte = filters.dateFrom;
    if (filters.dateTo) where.openedAt.lte = filters.dateTo;
  }

  const [sessions, totalCount] = await Promise.all([
    prisma.cashSession.findMany({
      where,
      include: {
        cashRegister: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { openedAt: "desc" },
      skip,
      take,
    }),
    prisma.cashSession.count({ where }),
  ]);

  // Serialize decimals
  const serialized = sessions.map((s) => serializeCashSession(s));

  return {
    sessions: serialized,
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
 * Get active session for current user
 */
export async function getMyActiveSession() {
  const session = await auth();

  if (!session?.user) {
    throw new Error("No autenticado");
  }

  const activeSession = await prisma.cashSession.findFirst({
    where: {
      userId: session.user.id,
      status: "OPEN",
    },
    include: {
      cashRegister: true,
      movements: true,
    },
  });

  if (!activeSession) {
    return null;
  }

  // Fetch sales separately to avoid Prisma IN (NULL) bug
  // Trade-off: 2 queries vs 1, but adds ~10ms and ensures reliability
  // Revisit when Prisma 7.4.0+ stable release addresses this issue
  const sales = await prisma.sale.findMany({
    where: {
      sessionId: activeSession.id,
    },
    include: {
      payments: true,
    },
  });

  // Serialize
  return {
    ...activeSession,
    openingAmount: Number(activeSession.openingAmount),
    sales: sales.map((sale) => ({
      ...sale,
      subtotal: Number(sale.subtotal),
      tax: Number(sale.tax),
      discount: Number(sale.discount),
      total: Number(sale.total),
      totalCost: sale.totalCost ? Number(sale.totalCost) : null,
      createdAt: sale.createdAt.toISOString(),
      payments: sale.payments.map((p) => ({
        ...p,
        amount: Number(p.amount),
        createdAt: p.createdAt.toISOString(),
      })),
    })),
    movements: activeSession.movements.map((m) => ({
      ...m,
      amount: Number(m.amount),
      createdAt: m.createdAt.toISOString(),
    })),
  };
}

/**
 * Get session details by ID (for viewing any session)
 */
export async function getSessionDetails(sessionId: string) {
  const session = await auth();

  if (!session?.user) {
    throw new Error("No autenticado");
  }

  const cashSession = await prisma.cashSession.findUnique({
    where: { id: sessionId },
    include: {
      cashRegister: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      movements: {
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!cashSession) {
    throw new Error("Sesión no encontrada");
  }

  // Fetch sales separately to avoid Prisma IN (NULL) bug
  const sales = await prisma.sale.findMany({
    where: {
      sessionId: sessionId,
    },
    include: {
      payments: true,
    },
  });

  // Calculate totals by payment method (same logic as getSessionClosingSummary)
  let cashSalesTotal = 0;
  let creditCardSalesTotal = 0;
  let debitCardSalesTotal = 0;
  let transferSalesTotal = 0;
  let checkSalesTotal = 0;

  sales.forEach((sale) => {
    sale.payments.forEach((payment) => {
      const amount = Number(payment.amount);

      switch (payment.method) {
        case PaymentMethod.CASH:
          cashSalesTotal += amount;
          break;
        case PaymentMethod.CREDIT_CARD:
          creditCardSalesTotal += amount;
          break;
        case PaymentMethod.DEBIT_CARD:
          debitCardSalesTotal += amount;
          break;
        case PaymentMethod.TRANSFER:
          transferSalesTotal += amount;
          break;
        case PaymentMethod.CHECK:
          checkSalesTotal += amount;
          break;
      }
    });
  });

  // Serialize
  return {
    ...serializeCashSession(cashSession),
    movements: cashSession.movements.map((m) => ({
      ...m,
      amount: Number(m.amount),
      createdAt: m.createdAt.toISOString(),
    })),
    salesByPaymentMethod: {
      cash: cashSalesTotal,
      creditCard: creditCardSalesTotal,
      debitCard: debitCardSalesTotal,
      transfer: transferSalesTotal,
      check: checkSalesTotal,
      total:
        cashSalesTotal +
        creditCardSalesTotal +
        debitCardSalesTotal +
        transferSalesTotal +
        checkSalesTotal,
    },
  };
}

/**
 * Get cash movements history with filters and pagination
 * FUTURE: Will also include sales transactions
 */
export async function getCashMovementsHistory(
  filters: {
    dateFrom?: Date;
    dateTo?: Date;
    cashRegisterId?: string;
    userId?: string;
    paymentMethod?: PaymentMethod;
    movementType?: CashMovementType;
    searchQuery?: string;
  } = {},
  page: number = 1,
  pageSize: number = 50
) {
  const session = await auth();

  if (!session?.user) {
    throw new Error("No autenticado");
  }

  // Admin check
  if (!isAdmin(session)) {
    throw new Error("No autorizado");
  }

  const skip = (page - 1) * pageSize;

  // Build where clause
  const where: {
    createdAt?: {
      gte?: Date;
      lte?: Date;
    };
    paymentMethod?: PaymentMethod;
    type?: CashMovementType;
    description?: {
      contains: string;
      mode: "insensitive";
    };
    session?: {
      cashRegisterId?: string;
      userId?: string;
    };
  } = {};

  // Date range filter
  if (filters.dateFrom || filters.dateTo) {
    where.createdAt = {};
    if (filters.dateFrom) {
      where.createdAt.gte = filters.dateFrom;
    }
    if (filters.dateTo) {
      where.createdAt.lte = filters.dateTo;
    }
  }

  // Payment method filter
  if (filters.paymentMethod) {
    where.paymentMethod = filters.paymentMethod;
  }

  // Movement type filter
  if (filters.movementType) {
    where.type = filters.movementType;
  }

  // Description search
  if (filters.searchQuery) {
    where.description = {
      contains: filters.searchQuery,
      mode: "insensitive",
    };
  }

  // Session filters (cash register and user)
  if (filters.cashRegisterId || filters.userId) {
    where.session = {};
    if (filters.cashRegisterId) {
      where.session.cashRegisterId = filters.cashRegisterId;
    }
    if (filters.userId) {
      where.session.userId = filters.userId;
    }
  }

  // Fetch movements and count in parallel
  const [movements, totalCount] = await Promise.all([
    prisma.cashMovement.findMany({
      where,
      include: {
        session: {
          include: {
            cashRegister: {
              select: { id: true, name: true },
            },
            user: {
              select: { id: true, name: true, email: true },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
    }),
    prisma.cashMovement.count({ where }),
  ]);

  // Calculate summary statistics
  const summaryData = await prisma.cashMovement.aggregate({
    where,
    _sum: {
      amount: true,
    },
    _count: {
      id: true,
    },
  });

  // Group by type for breakdown
  const byType = await prisma.cashMovement.groupBy({
    by: ["type"],
    where,
    _sum: {
      amount: true,
    },
    _count: {
      id: true,
    },
  });

  // Serialize
  const serialized = movements.map((m) => ({
    ...m,
    amount: Number(m.amount),
    createdAt: m.createdAt.toISOString(),
    session: serializeCashSession(m.session),
  }));

  return {
    movements: serialized,
    pagination: {
      page,
      pageSize,
      totalCount,
      totalPages: Math.ceil(totalCount / pageSize),
      hasMore: page * pageSize < totalCount,
    },
    summary: {
      totalAmount: summaryData._sum.amount ? Number(summaryData._sum.amount) : 0,
      totalCount: summaryData._count.id,
      byType: byType.map((item) => ({
        type: item.type,
        count: item._count.id,
        total: item._sum.amount ? Number(item._sum.amount) : 0,
      })),
    },
  };
}

/**
 * Record a SALE movement from a completed sale (automatic, not manual)
 * This should be called from sale-actions.ts when a sale is completed
 */
export async function recordSalePayment(
  sessionId: string,
  saleId: string,
  amount: number,
  paymentMethod: PaymentMethod
) {
  // Validate session is OPEN
  const session = await prisma.cashSession.findUnique({
    where: { id: sessionId },
  });

  if (!session || session.status !== "OPEN") {
    throw new Error("La sesión no está abierta");
  }

  // Create SALE movement (amount always positive)
  const movement = await prisma.cashMovement.create({
    data: {
      sessionId,
      saleId,
      type: CashMovementType.SALE,
      paymentMethod,
      amount: Math.abs(amount),
      description: `Venta #${saleId.slice(0, 8)}`,
    },
  });

  return {
    success: true,
    data: {
      ...movement,
      amount: Number(movement.amount),
    },
  };
}

/**
 * Record a REFUND movement from a refunded/canceled sale (automatic, not manual)
 * This should be called from sale-actions.ts when a sale is refunded
 */
export async function recordRefundPayment(
  sessionId: string,
  saleId: string,
  amount: number,
  paymentMethod: PaymentMethod
) {
  // Validate session exists
  const session = await prisma.cashSession.findUnique({
    where: { id: sessionId },
  });

  if (!session) {
    throw new Error("Sesión no encontrada");
  }

  if (session.status === "ARCHIVED") {
    throw new Error("No se pueden registrar devoluciones en sesiones archivadas");
  }

  // Allow refunds on CLOSED sessions (for historical corrections)
  // but log a warning if session is closed
  if (session.status === "CLOSED") {
    console.warn(`Recording refund on CLOSED session ${sessionId}. This affects historical data.`);
  }

  // Create REFUND movement (amount always positive)
  const movement = await prisma.cashMovement.create({
    data: {
      sessionId,
      saleId,
      type: CashMovementType.REFUND,
      paymentMethod,
      amount: Math.abs(amount),
      description: `Devolución de venta #${saleId.slice(0, 8)}`,
    },
  });

  return {
    success: true,
    data: {
      ...movement,
      amount: Number(movement.amount),
    },
  };
}
