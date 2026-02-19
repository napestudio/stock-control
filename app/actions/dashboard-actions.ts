"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/utils/auth-helpers";
import { getLowStockCount } from "@/app/actions/stock-actions";
import { CashMovementType, PaymentMethod, SaleStatus } from "@prisma/client";

const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: "Efectivo",
  CREDIT_CARD: "Tarjeta de crédito",
  DEBIT_CARD: "Tarjeta de débito",
  TRANSFER: "Transferencia",
  CHECK: "Cheque",
};

const SALE_STATUS_LABELS: Record<SaleStatus, string> = {
  PENDING: "Pendiente",
  COMPLETED: "Completada",
  CANCELED: "Cancelada",
  REFUNDED: "Reembolsada",
};

export type RecentSaleItem = {
  id: string;
  createdAt: string;
  total: number;
  customer: string;
  paymentMethod: string;
  status: string;
  statusKey: SaleStatus;
};

export type ActiveSessionSummary = {
  id: string;
  registerName: string;
  openedAt: string;
  balance: number;
} | null;

export type DashboardData = {
  lowStockCount: number;
  recentSales: RecentSaleItem[];
  activeSession: ActiveSessionSummary;
};

async function getRecentSales(): Promise<RecentSaleItem[]> {
  const sales = await prisma.sale.findMany({
    where: { status: "COMPLETED" },
    orderBy: { createdAt: "desc" },
    take: 4,
    select: {
      id: true,
      createdAt: true,
      total: true,
      status: true,
      customer: {
        select: { firstName: true, lastName: true },
      },
      payments: {
        select: { method: true },
        take: 1,
      },
    },
  });

  return sales.map((sale) => {
    const customerName =
      sale.customer
        ? `${sale.customer.firstName} ${sale.customer.lastName}`.trim()
        : "Sin cliente";

    const paymentMethod =
      sale.payments[0]?.method
        ? PAYMENT_METHOD_LABELS[sale.payments[0].method]
        : "—";

    return {
      id: sale.id,
      createdAt: sale.createdAt.toISOString(),
      total: Number(sale.total),
      customer: customerName,
      paymentMethod,
      status: SALE_STATUS_LABELS[sale.status],
      statusKey: sale.status,
    };
  });
}

async function getActiveCashSession(
  userId: string,
): Promise<ActiveSessionSummary> {
  const cashSession = await prisma.cashSession.findFirst({
    where: { userId, status: "OPEN" },
    select: {
      id: true,
      openingAmount: true,
      openedAt: true,
      cashRegister: { select: { name: true } },
    },
  });

  if (!cashSession) return null;

  // Aggregate positive and negative movements separately
  const [positiveSum, negativeSum] = await Promise.all([
    prisma.cashMovement.aggregate({
      where: {
        sessionId: cashSession.id,
        type: {
          in: [
            CashMovementType.INCOME,
            CashMovementType.SALE,
          ],
        },
      },
      _sum: { amount: true },
    }),
    prisma.cashMovement.aggregate({
      where: {
        sessionId: cashSession.id,
        type: {
          in: [
            CashMovementType.EXPENSE,
            CashMovementType.REFUND,
          ],
        },
      },
      _sum: { amount: true },
    }),
  ]);

  const openingAmount = Number(cashSession.openingAmount);
  const totalPositive = Number(positiveSum._sum.amount ?? 0);
  const totalNegative = Number(negativeSum._sum.amount ?? 0);
  const balance = openingAmount + totalPositive - totalNegative;

  return {
    id: cashSession.id,
    registerName: cashSession.cashRegister.name,
    openedAt: cashSession.openedAt.toISOString(),
    balance,
  };
}

export async function getDashboardData(): Promise<DashboardData> {
  const session = await auth();

  if (!session?.user?.id) {
    throw new Error("No autenticado");
  }

  const adminUser = isAdmin(session);

  const [lowStockCount, recentSales, activeSession] = await Promise.all([
    adminUser ? getLowStockCount() : Promise.resolve(0),
    getRecentSales(),
    getActiveCashSession(session.user.id),
  ]);

  return { lowStockCount, recentSales, activeSession };
}
