import { PrismaClient } from "@prisma/client";
import { config } from "@/lib/config";

export async function generateUniqueEmail(
  name: string,
  prisma: PrismaClient,
): Promise<string> {
  // Normalize name: lowercase, replace spaces with underscores, remove special chars
  const normalized = name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");

  if (!normalized) {
    throw new Error("Invalid name for email generation");
  }

  const baseName = normalized;
  const domain = config.EMAIL_DOMAIN;
  const baseEmail = `${baseName}@${domain}`;

  // Check if base email exists
  const existingUser = await prisma.user.findUnique({
    where: { email: baseEmail },
  });

  if (!existingUser) {
    return baseEmail;
  }

  // Find all emails matching pattern
  const existingEmails = await prisma.user.findMany({
    where: {
      email: {
        startsWith: `${baseName}`,
        endsWith: `@${domain}`,
      },
    },
    select: { email: true },
  });

  // Extract suffixes and find the highest number
  const suffixes = existingEmails
    .map((user) => {
      const match = user.email.match(
        new RegExp(`${baseName}_(\\d+)@${domain.replace(".", "\\.")}`),
      );
      return match ? parseInt(match[1], 10) : 0;
    })
    .filter((n) => !isNaN(n));

  // Find next available suffix
  const maxSuffix = Math.max(0, ...suffixes);
  const nextSuffix = maxSuffix + 1;

  return `${baseName}_${nextSuffix}@${domain}`;
}
