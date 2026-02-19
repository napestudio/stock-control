import { Prisma, PaymentMethod, CashMovementType, CashSessionStatus } from "@prisma/client";

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
  | "expectedAmountCash"
  | "expectedAmountCreditCard"
  | "expectedAmountDebitCard"
  | "expectedAmountTransfer"
  | "expectedAmountCheck"
  | "differenceCash"
  | "differenceCreditCard"
  | "differenceDebitCard"
  | "differenceTransfer"
  | "differenceCheck"
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

  // Per-method expected amounts
  expectedAmountCash: number | null;
  expectedAmountCreditCard: number | null;
  expectedAmountDebitCard: number | null;
  expectedAmountTransfer: number | null;
  expectedAmountCheck: number | null;

  // Per-method differences
  differenceCash: number | null;
  differenceCreditCard: number | null;
  differenceDebitCard: number | null;
  differenceTransfer: number | null;
  differenceCheck: number | null;

  // Backwards compatibility fields
  closingAmount: number | null;
  expectedAmount: number | null;
  difference: number | null;

  openedAt: string;
  closedAt: string | null;
  sales: Array<{
    id: string;
    subtotal: number;
    tax: number;
    discount: number;
    total: number;
    totalCost: number | null;
    createdAt: string;
    payments: Array<{
      id: string;
      method: PaymentMethod;
      amount: number;
      createdAt: string;
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

// Cash movement with sale details (for SALE/REFUND types)
export interface CashMovementWithSale {
  id: string;
  type: CashMovementType;
  paymentMethod: PaymentMethod;
  amount: number;
  description: string | null;
  createdAt: string;
  saleId: string | null;
  sale?: {
    id: string;
    status: string;
    total: number;
    createdAt: string;
  } | null;
}

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

// Constants for labels
export const MOVEMENT_TYPE_LABELS: Record<CashMovementType, string> = {
  INCOME: "Ingreso Manual",
  EXPENSE: "Egreso Manual",
  SALE: "Venta",
  REFUND: "Devolución",

  // DEPRECATED - kept for backwards compatibility with archived data
  OPENING: "Apertura (Archivado)",
  CLOSING: "Cierre (Archivado)",
  DEPOSIT: "Depósito (Archivado)",
  WITHDRAWAL: "Retiro (Archivado)",
  ADJUSTMENT: "Ajuste (Archivado)",
} as const;

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: "Efectivo",
  CREDIT_CARD: "Tarjeta Crédito",
  DEBIT_CARD: "Tarjeta Débito",
  TRANSFER: "Transferencia",
  CHECK: "Cheque",
} as const;

export const SESSION_STATUS_LABELS: Record<CashSessionStatus, string> = {
  OPEN: "Abierta",
  CLOSED: "Cerrada",
  ARCHIVED: "Archivada",
} as const;

// Helper function to get Spanish labels for payment methods
export function getPaymentMethodLabel(method: PaymentMethod): string {
  return PAYMENT_METHOD_LABELS[method] || "Desconocido";
}

// Helper function to get Spanish labels for movement types
export function getMovementTypeLabel(type: CashMovementType): string {
  return MOVEMENT_TYPE_LABELS[type] || "Desconocido";
}

// Helper function to get Spanish labels for session status
export function getSessionStatusLabel(status: CashSessionStatus): string {
  return SESSION_STATUS_LABELS[status] || "Desconocido";
}
