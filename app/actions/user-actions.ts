"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/utils/auth-helpers";
import { generateUniqueEmail } from "@/lib/utils/email-generator";
import { generateRandomPassword } from "@/lib/utils/password-generator";
import {
  createUserSchema,
  editUserSchema,
  type CreateUserInput,
  type EditUserInput,
} from "@/lib/validations/user-schema";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";

/**
 * Create a new user with auto-generated email and temporary password
 */
export async function createUser(data: CreateUserInput) {
  const session = await auth();

  if (!isAdmin(session)) {
    throw new Error("Unauthorized: Admin access required");
  }

  // Validate input
  const validated = createUserSchema.parse(data);

  // Generate unique email from name
  const email = await generateUniqueEmail(validated.name, prisma);

  // Generate temporary password
  const temporaryPassword = generateRandomPassword();
  const hashedPassword = await bcrypt.hash(temporaryPassword, 10);

  // Create user
  const user = await prisma.user.create({
    data: {
      name: validated.name,
      email,
      password: hashedPassword,
      roleId: validated.roleId,
      requirePasswordChange: true,
      active: true,
    },
    include: {
      role: true,
    },
  });

  revalidatePath("/panel/users");

  return {
    success: true,
    data: {
      user,
      temporaryPassword,
    },
  };
}

/**
 * Update an existing user's information
 */
export async function updateUser(id: string, data: Partial<EditUserInput>) {
  const session = await auth();

  if (!isAdmin(session)) {
    throw new Error("Unauthorized: Admin access required");
  }

  // Validate input
  const validated = editUserSchema.partial().parse({ ...data, id });

  // Prepare update data
  const updateData: Prisma.UserUncheckedUpdateInput = {};
  if (validated.name !== undefined) updateData.name = validated.name;
  if (validated.roleId !== undefined) updateData.roleId = validated.roleId;
  if (validated.active !== undefined) updateData.active = validated.active;

  // Update user
  const user = await prisma.user.update({
    where: { id },
    data: updateData,
    include: {
      role: true,
    },
  });

  revalidatePath("/panel/users");

  return {
    success: true,
    data: user,
  };
}

/**
 * Reset a user's password and generate a new temporary password
 */
export async function resetUserPassword(userId: string) {
  const session = await auth();

  if (!isAdmin(session)) {
    throw new Error("Unauthorized: Admin access required");
  }

  // Generate new temporary password
  const temporaryPassword = generateRandomPassword();
  const hashedPassword = await bcrypt.hash(temporaryPassword, 10);

  // Update user with new password and set requirePasswordChange flag
  await prisma.user.update({
    where: { id: userId },
    data: {
      password: hashedPassword,
      requirePasswordChange: true,
    },
  });

  revalidatePath("/panel/users");

  return {
    success: true,
    data: {
      temporaryPassword,
    },
  };
}

/**
 * Soft delete a user by setting deletedAt and deactivating
 */
export async function softDeleteUser(userId: string) {
  const session = await auth();

  if (!isAdmin(session) || !session) {
    throw new Error("Unauthorized: Admin access required");
  }

  // Prevent deleting self
  if (session.user.id === userId) {
    throw new Error("Cannot delete your own account");
  }

  // Soft delete user
  await prisma.user.update({
    where: { id: userId },
    data: {
      deletedAt: new Date(),
      active: false,
    },
  });

  revalidatePath("/panel/users");

  return {
    success: true,
  };
}

/**
 * Change the current user's password
 */
export async function changePassword(
  currentPassword: string | undefined,
  newPassword: string,
) {
  const session = await auth();

  if (!session) {
    throw new Error("Unauthorized: No active session");
  }

  // Get current user
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      password: true,
      requirePasswordChange: true,
    },
  });

  if (!user) {
    throw new Error("User not found");
  }

  // If not requiring password change, verify current password
  if (!user.requirePasswordChange) {
    if (!currentPassword) {
      throw new Error("Current password is required");
    }

    const passwordMatch = await bcrypt.compare(currentPassword, user.password);

    if (!passwordMatch) {
      throw new Error("Current password is incorrect");
    }
  }

  // Hash new password
  const hashedPassword = await bcrypt.hash(newPassword, 10);

  // Update user password and clear requirePasswordChange flag
  await prisma.user.update({
    where: { id: user.id },
    data: {
      password: hashedPassword,
      requirePasswordChange: false,
    },
  });

  revalidatePath("/panel");

  return {
    success: true,
  };
}

/**
 * Get list of users with optional filter
 */
export async function getUsers(
  filter?: "all" | "active" | "inactive",
): Promise<Prisma.UserGetPayload<{ include: { role: true } }>[]> {
  const session = await auth();

  if (!isAdmin(session)) {
    throw new Error("Unauthorized: Admin access required");
  }

  // Build where clause
  const where: Prisma.UserWhereInput = {
    deletedAt: null,
  };

  if (filter === "active") {
    where.active = true;
    where.requirePasswordChange = false;
  } else if (filter === "inactive") {
    where.OR = [{ active: false }, { requirePasswordChange: true }];
  }

  // Query users
  const users = await prisma.user.findMany({
    where,
    include: {
      role: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return users;
}
