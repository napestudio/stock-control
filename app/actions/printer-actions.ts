"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/utils/auth-helpers";
import {
  createPrinterSchema,
  updatePrinterSchema,
  deletePrinterSchema,
  type CreatePrinterInput,
  type UpdatePrinterInput,
  type DeletePrinterInput,
} from "@/lib/validations/printer-schema";
import { revalidatePath } from "next/cache";
import type { PrinterSerialized } from "@/types/printer";

const cashRegisterSelect = {
  id: true,
  name: true,
  active: true,
} as const;

export async function getPrinters(): Promise<PrinterSerialized[]> {
  const session = await auth();

  if (!isAdmin(session)) {
    throw new Error("No autorizado: Se requiere acceso de administrador");
  }

  const printers = await prisma.printer.findMany({
    where: { deletedAt: null },
    include: { cashRegister: { select: cashRegisterSelect } },
    orderBy: { name: "asc" },
  });

  return printers.map((p) => ({
    ...p,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
    deletedAt: p.deletedAt?.toISOString() ?? null,
  }));
}

export async function createPrinter(
  data: CreatePrinterInput
): Promise<{ success: true; data: PrinterSerialized }> {
  const session = await auth();

  if (!isAdmin(session)) {
    throw new Error("No autorizado: Se requiere acceso de administrador");
  }

  const validated = createPrinterSchema.parse(data);

  const printer = await prisma.printer.create({
    data: {
      name: validated.name,
      description: validated.description || null,
      model: validated.model || null,
      connectionType: validated.connectionType,
      ipAddress: validated.ipAddress || null,
      systemPrinterName: validated.systemPrinterName || null,
      paperWidth: validated.paperWidth,
      autoPrint: validated.autoPrint,
      active: validated.active,
      cashRegisterId: validated.cashRegisterId || null,
    },
    include: { cashRegister: { select: cashRegisterSelect } },
  });

  revalidatePath("/panel/configuration/printers");

  return {
    success: true,
    data: {
      ...printer,
      createdAt: printer.createdAt.toISOString(),
      updatedAt: printer.updatedAt.toISOString(),
      deletedAt: null,
    },
  };
}

export async function updatePrinter(
  id: string,
  data: Omit<UpdatePrinterInput, "id">
): Promise<{ success: true; data: PrinterSerialized }> {
  const session = await auth();

  if (!isAdmin(session)) {
    throw new Error("No autorizado: Se requiere acceso de administrador");
  }

  const validated = updatePrinterSchema.parse({ ...data, id });

  const printer = await prisma.printer.update({
    where: { id },
    data: {
      name: validated.name,
      description: validated.description || null,
      model: validated.model || null,
      connectionType: validated.connectionType,
      ipAddress: validated.ipAddress || null,
      systemPrinterName: validated.systemPrinterName || null,
      paperWidth: validated.paperWidth,
      autoPrint: validated.autoPrint,
      active: validated.active ?? true,
      cashRegisterId: validated.cashRegisterId || null,
    },
    include: { cashRegister: { select: cashRegisterSelect } },
  });

  revalidatePath("/panel/configuration/printers");

  return {
    success: true,
    data: {
      ...printer,
      createdAt: printer.createdAt.toISOString(),
      updatedAt: printer.updatedAt.toISOString(),
      deletedAt: printer.deletedAt?.toISOString() ?? null,
    },
  };
}

export async function deletePrinter(
  data: DeletePrinterInput
): Promise<{ success: true }> {
  const session = await auth();

  if (!isAdmin(session)) {
    throw new Error("No autorizado: Se requiere acceso de administrador");
  }

  const validated = deletePrinterSchema.parse(data);

  await prisma.printer.update({
    where: { id: validated.id },
    data: { deletedAt: new Date() },
  });

  revalidatePath("/panel/configuration/printers");

  return { success: true };
}
