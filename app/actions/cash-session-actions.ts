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
    closingAmountOther: session.closingAmountOther ? Number(session.closingAmountOther) : null,

    // Per-method expected amounts
    expectedAmountCash: session.expectedAmountCash ? Number(session.expectedAmountCash) : null,
    expectedAmountCreditCard: session.expectedAmountCreditCard ? Number(session.expectedAmountCreditCard) : null,
    expectedAmountDebitCard: session.expectedAmountDebitCard ? Number(session.expectedAmountDebitCard) : null,
    expectedAmountTransfer: session.expectedAmountTransfer ? Number(session.expectedAmountTransfer) : null,
    expectedAmountCheck: session.expectedAmountCheck ? Number(session.expectedAmountCheck) : null,
    expectedAmountOther: session.expectedAmountOther ? Number(session.expectedAmountOther) : null,

    // Per-method differences
    differenceCash: session.differenceCash ? Number(session.differenceCash) : null,
    differenceCreditCard: session.differenceCreditCard ? Number(session.differenceCreditCard) : null,
    differenceDebitCard: session.differenceDebitCard ? Number(session.differenceDebitCard) : null,
    differenceTransfer: session.differenceTransfer ? Number(session.differenceTransfer) : null,
    differenceCheck: session.differenceCheck ? Number(session.differenceCheck) : null,
    differenceOther: session.differenceOther ? Number(session.differenceOther) : null,

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
    // 1. Check if register has active session
    const activeRegisterSession = await tx.cashSession.findFirst({
      where: {
        cashRegisterId: validated.cashRegisterId,
        closedAt: null,
      },
    });

    if (activeRegisterSession) {
      throw new Error("Esta caja ya tiene una sesión activa");
    }

    // 2. Check if user has active session
    const activeUserSession = await tx.cashSession.findFirst({
      where: {
        userId: session.user.id,
        closedAt: null,
      },
    });

    if (activeUserSession) {
      throw new Error("Ya tiene una sesión activa en otra caja");
    }

    // 3. Create session
    const cashSession = await tx.cashSession.create({
      data: {
        cashRegisterId: validated.cashRegisterId,
        userId: session.user.id,
        openingAmount: validated.openingAmount,
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

    // 4. Create opening movement
    await tx.cashMovement.create({
      data: {
        sessionId: cashSession.id,
        type: CashMovementType.OPENING,
        amount: validated.openingAmount,
        description: "Apertura de caja",
      },
    });

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

  if (cashSession.closedAt) {
    throw new Error("Esta sesión ya está cerrada");
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
  let otherSalesTotal = 0;

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
        case PaymentMethod.OTHER:
          otherSalesTotal += amount;
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
  let otherMovementsNet = 0;

  cashSession.movements.forEach((movement) => {
    const amount = Number(movement.amount);
    const isCash = movement.paymentMethod === PaymentMethod.CASH;

    // Track by type
    switch (movement.type) {
      case CashMovementType.DEPOSIT:
        depositsTotal += amount;
        if (isCash) cashDepositsTotal += amount;
        break;
      case CashMovementType.WITHDRAWAL:
        withdrawalsTotal += amount;
        if (isCash) cashWithdrawalsTotal += amount;
        break;
      case CashMovementType.EXPENSE:
        expensesTotal += amount;
        if (isCash) cashExpensesTotal += amount;
        break;
    }

    // Track by payment method (net: deposits +, withdrawals/expenses -)
    const sign = movement.type === CashMovementType.DEPOSIT ? 1 : -1;
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
      case PaymentMethod.OTHER:
        otherMovementsNet += sign * amount;
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
  const expectedOther = otherSalesTotal + otherMovementsNet;

  // Expected total counts all payment methods
  const expectedTotal =
    expectedCash +
    expectedCreditCard +
    expectedDebitCard +
    expectedTransfer +
    expectedCheck +
    expectedOther;

  return {
    openingAmount,
    salesTotal,
    cashSalesTotal,
    creditCardSalesTotal,
    debitCardSalesTotal,
    transferSalesTotal,
    checkSalesTotal,
    otherSalesTotal,
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
    expectedOther,
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
    // Get session
    const cashSession = await tx.cashSession.findUnique({
      where: { id: validated.sessionId },
    });

    if (!cashSession) {
      throw new Error("Sesión no encontrada");
    }

    if (cashSession.closedAt) {
      throw new Error("Esta sesión ya está cerrada");
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
      other: validated.closingAmountOther ?? 0,
    };

    // Calculate differences per payment method
    const differences = {
      cash: closingAmounts.cash - summary.expectedCash,
      creditCard: closingAmounts.creditCard - summary.expectedCreditCard,
      debitCard: closingAmounts.debitCard - summary.expectedDebitCard,
      transfer: closingAmounts.transfer - summary.expectedTransfer,
      check: closingAmounts.check - summary.expectedCheck,
      other: closingAmounts.other - summary.expectedOther,
    };

    // Calculate totals for backwards compatibility
    const totalClosing =
      closingAmounts.cash +
      closingAmounts.creditCard +
      closingAmounts.debitCard +
      closingAmounts.transfer +
      closingAmounts.check +
      closingAmounts.other;

    const totalExpected = summary.expectedTotal;
    const totalDifference = totalClosing - totalExpected;

    // Update session with all amounts
    const updated = await tx.cashSession.update({
      where: { id: validated.sessionId },
      data: {
        // Closing amounts per method
        closingAmountCash: closingAmounts.cash,
        closingAmountCreditCard: closingAmounts.creditCard,
        closingAmountDebitCard: closingAmounts.debitCard,
        closingAmountTransfer: closingAmounts.transfer,
        closingAmountCheck: closingAmounts.check,
        closingAmountOther: closingAmounts.other,

        // Expected amounts per method
        expectedAmountCash: summary.expectedCash,
        expectedAmountCreditCard: summary.expectedCreditCard,
        expectedAmountDebitCard: summary.expectedDebitCard,
        expectedAmountTransfer: summary.expectedTransfer,
        expectedAmountCheck: summary.expectedCheck,
        expectedAmountOther: summary.expectedOther,

        // Differences per method
        differenceCash: differences.cash,
        differenceCreditCard: differences.creditCard,
        differenceDebitCard: differences.debitCard,
        differenceTransfer: differences.transfer,
        differenceCheck: differences.check,
        differenceOther: differences.other,

        // Totals (backwards compatibility)
        closingAmount: totalClosing,
        expectedAmount: totalExpected,
        difference: totalDifference,

        // Close the session
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

    // Create closing movement with total
    await tx.cashMovement.create({
      data: {
        sessionId: validated.sessionId,
        type: CashMovementType.CLOSING,
        paymentMethod: PaymentMethod.CASH, // Default to CASH for closing movement
        amount: totalClosing,
        description: `Cierre de caja - Diferencia total: ${totalDifference >= 0 ? "+" : ""}${totalDifference.toFixed(2)}`,
      },
    });

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

  // Verify session exists and is open
  const cashSession = await prisma.cashSession.findUnique({
    where: { id: validated.sessionId },
  });

  if (!cashSession) {
    throw new Error("Sesión no encontrada");
  }

  if (cashSession.closedAt) {
    throw new Error("No se pueden agregar movimientos a una sesión cerrada");
  }

  // Verify user owns this session or is admin
  const userIsAdmin = isAdmin(session);
  const isOwnSession = cashSession.userId === session.user.id;

  if (!userIsAdmin && !isOwnSession) {
    throw new Error("No autorizado: Solo puede modificar su propia sesión");
  }

  const movement = await prisma.cashMovement.create({
    data: validated,
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
      closedAt: null,
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
      total: Number(sale.total),
      payments: sale.payments.map((p) => ({
        ...p,
        amount: Number(p.amount),
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
  let otherSalesTotal = 0;

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
        case PaymentMethod.OTHER:
          otherSalesTotal += amount;
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
      other: otherSalesTotal,
      total:
        cashSalesTotal +
        creditCardSalesTotal +
        debitCardSalesTotal +
        transferSalesTotal +
        checkSalesTotal +
        otherSalesTotal,
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
