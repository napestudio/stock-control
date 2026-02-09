import { Prisma, PaymentMethod, CashMovementType } from "@prisma/client";

// Full session with all relations
const cashSessionWithDetails = Prisma.validator<Prisma.CashSessionDefaultArgs>()({
  include: {
    cashRegister: true,
    user: {
      select: {
        id: true,
        name: true,
        email: true,
      },
    },
    sales: {
      include: {
        payments: true,
      },
    },
    movements: true,
  },
});

type RawCashSessionWithDetails = Prisma.CashSessionGetPayload<typeof cashSessionWithDetails>;

// Serialized for client (Decimal → number, Date → string)
export type CashSessionSerialized = Omit<
  RawCashSessionWithDetails,
  "openingAmount" | "closingAmount" | "expectedAmount" | "difference" | "sales" | "movements" | "openedAt" | "closedAt"
> & {
  openingAmount: number;
  closingAmount: number | null;
  expectedAmount: number | null;
  difference: number | null;
  openedAt: string;
  closedAt: string | null;
  sales: Array<{
    id: string;
    total: number;
    payments: Array<{
      id: string;
      method: PaymentMethod;
      amount: number;
    }>;
  }>;
  movements: Array<{
    id: string;
    type: CashMovementType;
    amount: number;
    description: string | null;
    createdAt: string;
  }>;
};

// Payment summary by method
export interface PaymentMethodSummary {
  method: PaymentMethod;
  count: number;
  total: number;
}

// Session summary for closing
export interface SessionClosingSummary {
  openingAmount: number;
  salesTotal: number;

  // Payment method breakdowns (sales)
  cashSalesTotal: number;
  creditCardSalesTotal: number;
  debitCardSalesTotal: number;
  transferSalesTotal: number;
  checkSalesTotal: number;
  otherSalesTotal: number;

  // Cash movements (all payment methods)
  depositsTotal: number;
  withdrawalsTotal: number;
  expensesTotal: number;

  // Cash movements (CASH payment method only)
  cashDepositsTotal: number;
  cashWithdrawalsTotal: number;
  cashExpensesTotal: number;

  // Calculated totals
  expectedCash: number; // Only counts CASH payment method movements
  expectedTotal: number; // Counts all payment methods
}

// Helper function to get Spanish labels for payment methods
export function getPaymentMethodLabel(method: PaymentMethod): string {
  switch (method) {
    case PaymentMethod.CASH:
      return "Efectivo";
    case PaymentMethod.CREDIT_CARD:
      return "Tarjeta de Crédito";
    case PaymentMethod.DEBIT_CARD:
      return "Tarjeta de Débito";
    case PaymentMethod.TRANSFER:
      return "Transferencia";
    case PaymentMethod.CHECK:
      return "Cheque";
    case PaymentMethod.OTHER:
      return "Otro";
    default:
      return "Desconocido";
  }
}
