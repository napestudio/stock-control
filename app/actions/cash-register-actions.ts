"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/utils/auth-helpers";
import {
  createCashRegisterSchema,
  updateCashRegisterSchema,
  type CreateCashRegisterInput,
  type UpdateCashRegisterInput,
} from "@/lib/validations/cash-register-schema";
import { revalidatePath } from "next/cache";
import type { CashRegisterWithStats } from "@/types/cash-register";

/**
 * Get all cash registers with active session info
 */
export async function getCashRegisters(): Promise<CashRegisterWithStats[]> {
  const session = await auth();

  if (!isAdmin(session)) {
    throw new Error("No autorizado: Se requiere acceso de administrador");
  }

  const registers = await prisma.cashRegister.findMany({
    include: {
      sessions: {
        where: {
          closedAt: null, // Only active sessions
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
    orderBy: { name: "asc" },
  });

  // Add hasActiveSession computed field and serialize decimals
  const registersWithStats: CashRegisterWithStats[] = registers.map((register) => ({
    ...register,
    sessions: register.sessions.map((s) => ({
      ...s,
      openingAmount: Number(s.openingAmount),
    })),
    hasActiveSession: register.sessions.length > 0,
  }));

  return registersWithStats;
}

/**
 * Create a new cash register
 */
export async function createCashRegister(data: CreateCashRegisterInput) {
  const session = await auth();

  if (!isAdmin(session)) {
    throw new Error("No autorizado: Se requiere acceso de administrador");
  }

  const validated = createCashRegisterSchema.parse(data);

  const register = await prisma.cashRegister.create({
    data: validated,
  });

  revalidatePath("/panel/cash-registers");

  return {
    success: true,
    data: register,
  };
}

/**
 * Update cash register
 */
export async function updateCashRegister(
  id: string,
  data: Partial<Omit<UpdateCashRegisterInput, "id">>
) {
  const session = await auth();

  if (!isAdmin(session)) {
    throw new Error("No autorizado: Se requiere acceso de administrador");
  }

  const validated = updateCashRegisterSchema.partial().parse({ ...data, id });

  const register = await prisma.cashRegister.update({
    where: { id },
    data: {
      name: validated.name,
      active: validated.active,
    },
  });

  revalidatePath("/panel/cash-registers");

  return {
    success: true,
    data: register,
  };
}

/**
 * Delete (deactivate) cash register
 * Can only delete if no active sessions
 */
export async function deleteCashRegister(id: string) {
  const session = await auth();

  if (!isAdmin(session)) {
    throw new Error("No autorizado: Se requiere acceso de administrador");
  }

  // Check for active sessions
  const activeSession = await prisma.cashSession.findFirst({
    where: {
      cashRegisterId: id,
      closedAt: null,
    },
  });

  if (activeSession) {
    throw new Error(
      "No se puede eliminar una caja con sesión activa. Cierre la sesión primero."
    );
  }

  // Soft delete by setting active to false
  await prisma.cashRegister.update({
    where: { id },
    data: { active: false },
  });

  revalidatePath("/panel/cash-registers");

  return { success: true };
}
