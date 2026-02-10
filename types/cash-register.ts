import { Prisma } from "@prisma/client";

// Cash register with active session info
const cashRegisterWithActiveSession = Prisma.validator<Prisma.CashRegisterDefaultArgs>()({
  include: {
    sessions: {
      where: {
        closedAt: null,
      },
      select: {
        id: true,
        userId: true,
        openedAt: true,
        openingAmount: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    },
  },
});

type RawCashRegisterWithStats = Prisma.CashRegisterGetPayload<typeof cashRegisterWithActiveSession>;

// Serialized type with Decimal converted to number
export type CashRegisterWithStats = Omit<RawCashRegisterWithStats, "sessions"> & {
  sessions: Array<{
    id: string;
    userId: string;
    openedAt: Date;
    openingAmount: number;
    user: {
      id: string;
      name: string | null;
      email: string | null;
    };
  }>;
  hasActiveSession: boolean;
};

// Optimistic action types
export type CashRegisterOptimisticAction =
  | { type: "create"; register: CashRegisterWithStats }
  | { type: "update"; id: string; data: Partial<CashRegisterWithStats> }
  | { type: "delete"; id: string };
