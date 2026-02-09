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

  cashSession.movements.forEach((movement) => {
    const amount = Number(movement.amount);
    const isCash = movement.paymentMethod === PaymentMethod.CASH;

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
  });

  // Expected cash only counts CASH payment method movements
  const expectedCash =
    openingAmount +
    cashSalesTotal +
    cashDepositsTotal -
    cashWithdrawalsTotal -
    cashExpensesTotal;

  // Expected total counts all payment methods
  const expectedTotal =
    salesTotal + depositsTotal - withdrawalsTotal - expensesTotal;

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
    expectedCash,
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

    // Calculate expected amount
    const summary = await getSessionClosingSummary(validated.sessionId);
    const expectedAmount = summary.expectedCash;
    const difference = validated.closingAmount - expectedAmount;

    // Update session
    const updated = await tx.cashSession.update({
      where: { id: validated.sessionId },
      data: {
        closingAmount: validated.closingAmount,
        expectedAmount,
        difference,
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

    // Create closing movement
    await tx.cashMovement.create({
      data: {
        sessionId: validated.sessionId,
        type: CashMovementType.CLOSING,
        amount: validated.closingAmount,
        description: `Cierre de caja - Diferencia: ${difference >= 0 ? "+" : ""}${difference.toFixed(2)}`,
      },
    });

    return updated;
  });

  revalidatePath("/panel/cash-registers");

  return {
    success: true,
    data: {
      ...closedSession,
      openingAmount: Number(closedSession.openingAmount),
      closingAmount: closedSession.closingAmount ? Number(closedSession.closingAmount) : null,
      expectedAmount: closedSession.expectedAmount
        ? Number(closedSession.expectedAmount)
        : null,
      difference: closedSession.difference ? Number(closedSession.difference) : null,
    },
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
  const serialized = sessions.map((s) => ({
    ...s,
    openingAmount: Number(s.openingAmount),
    closingAmount: s.closingAmount ? Number(s.closingAmount) : null,
    expectedAmount: s.expectedAmount ? Number(s.expectedAmount) : null,
    difference: s.difference ? Number(s.difference) : null,
  }));

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
