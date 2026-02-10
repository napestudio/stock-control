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
  | "openingAmount"
  | "closingAmount"
  | "expectedAmount"
  | "difference"
  | "closingAmountCash"
  | "closingAmountCreditCard"
  | "closingAmountDebitCard"
  | "closingAmountTransfer"
  | "closingAmountCheck"
  | "closingAmountOther"
  | "expectedAmountCash"
  | "expectedAmountCreditCard"
  | "expectedAmountDebitCard"
  | "expectedAmountTransfer"
  | "expectedAmountCheck"
  | "expectedAmountOther"
  | "differenceCash"
  | "differenceCreditCard"
  | "differenceDebitCard"
  | "differenceTransfer"
  | "differenceCheck"
  | "differenceOther"
  | "sales"
  | "movements"
  | "openedAt"
  | "closedAt"
> & {
  openingAmount: number;

  // Per-method closing amounts
  closingAmountCash: number | null;
  closingAmountCreditCard: number | null;
  closingAmountDebitCard: number | null;
  closingAmountTransfer: number | null;
  closingAmountCheck: number | null;
  closingAmountOther: number | null;

  // Per-method expected amounts
  expectedAmountCash: number | null;
  expectedAmountCreditCard: number | null;
  expectedAmountDebitCard: number | null;
  expectedAmountTransfer: number | null;
  expectedAmountCheck: number | null;
  expectedAmountOther: number | null;

  // Per-method differences
  differenceCash: number | null;
  differenceCreditCard: number | null;
  differenceDebitCard: number | null;
  differenceTransfer: number | null;
  differenceCheck: number | null;
  differenceOther: number | null;

  // Backwards compatibility fields
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
    paymentMethod: PaymentMethod;
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

  // Expected totals per payment method (sales + movements)
  expectedCash: number;
  expectedCreditCard: number;
  expectedDebitCard: number;
  expectedTransfer: number;
  expectedCheck: number;
  expectedOther: number;

  // Total expected across all payment methods
  expectedTotal: number;
}

// Form data for closing session with multiple payment methods
export interface CloseSessionFormData {
  sessionId: string;

  // Closing amounts (actual counted by user)
  closingAmountCash?: number;
  closingAmountCreditCard?: number;
  closingAmountDebitCard?: number;
  closingAmountTransfer?: number;
  closingAmountCheck?: number;
  closingAmountOther?: number;
}

// Per-method verification result
export interface PaymentMethodVerification {
  method: PaymentMethod;
  label: string;
  expected: number;
  actual: number;
  difference: number;
  hasDiscrepancy: boolean; // true if |difference| > 0.01
  discrepancyLevel: "none" | "minor" | "major"; // none: 0, minor: <$10, major: >=$10
}

// Complete closing verification summary
export interface SessionClosingVerification {
  sessionId: string;
  verifications: PaymentMethodVerification[];
  totalExpected: number;
  totalActual: number;
  totalDifference: number;
  hasAnyDiscrepancy: boolean;
  canClose: boolean; // Always true, but UI can warn if major discrepancies
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
