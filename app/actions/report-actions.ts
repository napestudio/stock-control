"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/utils/auth-helpers";
import { SaleStatus, StockMovementType, PaymentMethod } from "@prisma/client";
import type {
  SalesReportResult,
  StockReportResult,
  SalesReportRow,
  StockReportRow,
  StatisticsData,
  RevenueDataPoint,
  PaymentMethodBreakdown,
  TopProduct,
} from "@/types/report";

const SALE_STATUS_LABELS: Record<SaleStatus, string> = {
  PENDING: "Pendiente",
  COMPLETED: "Completada",
  CANCELED: "Cancelada",
  REFUNDED: "Reembolsada",
};

const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: "Efectivo",
  CREDIT_CARD: "Tarjeta de crédito",
  DEBIT_CARD: "Tarjeta de débito",
  TRANSFER: "Transferencia",
  CHECK: "Cheque",
};

const STOCK_MOVEMENT_LABELS: Record<StockMovementType, string> = {
  IN: "Entrada",
  OUT: "Salida",
  ADJUSTMENT: "Ajuste",
  RETURN: "Devolución",
};

function buildSaleWhere(from: string, to: string) {
  const fromDate = new Date(from);
  fromDate.setHours(0, 0, 0, 0);
  const toDate = new Date(to);
  toDate.setHours(23, 59, 59, 999);

  return {
    status: { in: [SaleStatus.COMPLETED, SaleStatus.REFUNDED] as SaleStatus[] },
    createdAt: { gte: fromDate, lte: toDate },
  };
}

function buildStockWhere(from: string, to: string) {
  const fromDate = new Date(from);
  fromDate.setHours(0, 0, 0, 0);
  const toDate = new Date(to);
  toDate.setHours(23, 59, 59, 999);

  return { createdAt: { gte: fromDate, lte: toDate } };
}

function serializeSaleRows(
  sales: Awaited<ReturnType<typeof prisma.sale.findMany<{
    include: {
      customer: true;
      items: true;
      payments: true;
    };
  }>>>
): SalesReportRow[] {
  return sales.map((sale) => {
    const firstName = sale.customer?.firstName ?? "";
    const lastName = sale.customer?.lastName ?? "";
    const customer =
      firstName || lastName ? `${firstName} ${lastName}`.trim() : "—";

    const methods = [
      ...new Set(sale.payments.map((p) => PAYMENT_METHOD_LABELS[p.method])),
    ].join(", ");

    return {
      id: sale.id.slice(0, 8).toUpperCase(),
      date: sale.createdAt.toISOString(),
      customer,
      itemCount: sale.items.reduce((sum, i) => sum + i.quantity, 0),
      paymentMethod: methods || "—",
      total: Number(sale.total),
      status: SALE_STATUS_LABELS[sale.status],
    };
  });
}

function serializeStockRows(
  movements: Awaited<ReturnType<typeof prisma.stockMovement.findMany<{
    include: {
      variant: {
        include: { product: true };
      };
    };
  }>>>
): StockReportRow[] {
  return movements.map((m) => ({
    id: m.id,
    date: m.createdAt.toISOString(),
    product: m.variant.product.name,
    sku: m.variant.sku,
    type: STOCK_MOVEMENT_LABELS[m.type],
    quantity: m.quantity,
    reason: m.reason ?? "—",
  }));
}

// ─── Sales report (paginated) ──────────────────────────────────────────────

export async function getSalesReport(
  from: string,
  to: string,
  page: number = 1,
  pageSize: number = 50,
): Promise<SalesReportResult> {
  const session = await auth();
  if (!isAdmin(session)) {
    throw new Error("No autorizado");
  }

  const where = buildSaleWhere(from, to);
  const skip = (page - 1) * pageSize;

  const [aggregate, total, sales] = await Promise.all([
    prisma.sale.aggregate({
      where,
      _sum: { total: true, totalCost: true },
      _count: { id: true },
    }),
    prisma.sale.count({ where }),
    prisma.sale.findMany({
      where,
      include: { customer: true, items: true, payments: true },
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
    }),
  ]);

  const totalRevenue = Number(aggregate._sum.total ?? 0);
  const totalCost = Number(aggregate._sum.totalCost ?? 0);
  const saleCount = aggregate._count.id;

  return {
    summary: {
      totalRevenue,
      totalCost,
      grossProfit: totalRevenue - totalCost,
      saleCount,
      averageTicket: saleCount > 0 ? totalRevenue / saleCount : 0,
    },
    rows: serializeSaleRows(sales),
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
}

// ─── Sales export (all rows, no pagination) ────────────────────────────────

export async function exportSalesReport(
  from: string,
  to: string,
): Promise<SalesReportRow[]> {
  const session = await auth();
  if (!isAdmin(session)) {
    throw new Error("No autorizado");
  }

  const where = buildSaleWhere(from, to);

  const sales = await prisma.sale.findMany({
    where,
    include: { customer: true, items: true, payments: true },
    orderBy: { createdAt: "desc" },
  });

  return serializeSaleRows(sales);
}

// ─── Stock movements report (paginated) ───────────────────────────────────

export async function getStockMovementsReport(
  from: string,
  to: string,
  page: number = 1,
  pageSize: number = 50,
): Promise<StockReportResult> {
  const session = await auth();
  if (!isAdmin(session)) {
    throw new Error("No autorizado");
  }

  const where = buildStockWhere(from, to);
  const skip = (page - 1) * pageSize;

  const [grouped, total, movements] = await Promise.all([
    prisma.stockMovement.groupBy({
      by: ["type"],
      where,
      _sum: { quantity: true },
    }),
    prisma.stockMovement.count({ where }),
    prisma.stockMovement.findMany({
      where,
      include: { variant: { include: { product: true } } },
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
    }),
  ]);

  const sumByType = (type: StockMovementType) =>
    Number(grouped.find((g) => g.type === type)?._sum.quantity ?? 0);

  const totalIn = sumByType(StockMovementType.IN);
  const totalOut = sumByType(StockMovementType.OUT);
  const totalAdjustments =
    sumByType(StockMovementType.ADJUSTMENT) +
    sumByType(StockMovementType.RETURN);

  return {
    summary: {
      totalIn,
      totalOut,
      totalAdjustments,
      netBalance: totalIn - totalOut,
    },
    rows: serializeStockRows(movements),
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
}

// ─── Stock export (all rows, no pagination) ───────────────────────────────

export async function exportStockMovementsReport(
  from: string,
  to: string,
): Promise<StockReportRow[]> {
  const session = await auth();
  if (!isAdmin(session)) {
    throw new Error("No autorizado");
  }

  const where = buildStockWhere(from, to);

  const movements = await prisma.stockMovement.findMany({
    where,
    include: { variant: { include: { product: true } } },
    orderBy: { createdAt: "desc" },
  });

  return serializeStockRows(movements);
}

// ─── Statistics (charts data) ──────────────────────────────────────────────

export async function getStatistics(
  from: string,
  to: string,
): Promise<StatisticsData> {
  const session = await auth();
  if (!isAdmin(session)) {
    throw new Error("No autorizado");
  }

  const fromDate = new Date(from);
  fromDate.setHours(0, 0, 0, 0);
  const toDate = new Date(to);
  toDate.setHours(23, 59, 59, 999);

  // Run all 3 queries in parallel
  const [revenueRows, paymentRows, topRows] = await Promise.all([
    // A. Daily revenue time series (raw SQL — Prisma groupBy can't truncate dates)
    prisma.$queryRaw<
      Array<{ date: Date; revenue: string; sale_count: bigint }>
    >`
      SELECT
        DATE("createdAt") AS date,
        SUM(total)::text AS revenue,
        COUNT(*) AS sale_count
      FROM "Sale"
      WHERE status IN ('COMPLETED', 'REFUNDED')
        AND "createdAt" >= ${fromDate}
        AND "createdAt" <= ${toDate}
      GROUP BY DATE("createdAt")
      ORDER BY date ASC
    `,

    // B. Revenue by payment method (Prisma groupBy)
    prisma.payment.groupBy({
      by: ["method"],
      where: {
        sale: {
          status: { in: [SaleStatus.COMPLETED, SaleStatus.REFUNDED] },
          createdAt: { gte: fromDate, lte: toDate },
        },
      },
      _sum: { amount: true },
      orderBy: { _sum: { amount: "desc" } },
    }),

    // C. Top 5 products by revenue (raw SQL — needs calculated field price*qty)
    prisma.$queryRaw<
      Array<{
        sku: string;
        name: string;
        display_name: string | null;
        revenue: string;
        units_sold: bigint;
      }>
    >`
      SELECT
        v.sku,
        p.name,
        v."displayName" AS display_name,
        SUM(si."priceAtSale" * si.quantity)::text AS revenue,
        SUM(si.quantity) AS units_sold
      FROM "SaleItem" si
      JOIN "Sale" s ON s.id = si."saleId"
      JOIN "ProductVariant" v ON v.id = si."productVariantId"
      JOIN "Product" p ON p.id = v."productId"
      WHERE s.status IN ('COMPLETED', 'REFUNDED')
        AND s."createdAt" >= ${fromDate}
        AND s."createdAt" <= ${toDate}
      GROUP BY v.id, v.sku, p.name, v."displayName"
      ORDER BY revenue DESC
      LIMIT 5
    `,
  ]);

  const revenueTimeSeries: RevenueDataPoint[] = revenueRows.map((r) => ({
    date: r.date.toISOString().split("T")[0],
    revenue: parseFloat(r.revenue),
    saleCount: Number(r.sale_count),
  }));

  const paymentBreakdown: PaymentMethodBreakdown[] = paymentRows.map((r) => ({
    method: r.method,
    label: PAYMENT_METHOD_LABELS[r.method],
    total: Number(r._sum.amount ?? 0),
  }));

  const topProducts: TopProduct[] = topRows.map((r) => ({
    sku: r.sku,
    name: r.display_name ?? r.name,
    revenue: parseFloat(r.revenue),
    unitsSold: Number(r.units_sold),
  }));

  return { revenueTimeSeries, paymentBreakdown, topProducts };
}
