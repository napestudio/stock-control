import { Prisma } from "@prisma/client";

const printerWithCashRegister = Prisma.validator<Prisma.PrinterDefaultArgs>()({
  include: {
    cashRegister: {
      select: {
        id: true,
        name: true,
        active: true,
      },
    },
  },
});

export type PrinterWithCashRegister = Prisma.PrinterGetPayload<
  typeof printerWithCashRegister
>;

export type PrinterSerialized = Omit<
  PrinterWithCashRegister,
  "createdAt" | "updatedAt" | "deletedAt"
> & {
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type SystemPrinter = {
  name: string;
  type: string;
};

export type GgEzPrintListResponse = {
  type: "printer_list";
  printers: SystemPrinter[];
};
