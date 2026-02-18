/**
 * Script to archive all existing cash sessions
 * Run with: npx tsx scripts/archive-old-cash-sessions.ts
 */

import "dotenv/config";
import { prisma } from "../lib/prisma";

async function main() {
  console.log("🔍 Checking for existing cash sessions...");

  // Count total sessions
  const totalSessions = await prisma.cashSession.count();
  console.log(`📊 Total sessions found: ${totalSessions}`);

  if (totalSessions === 0) {
    console.log("✅ No sessions to archive.");
    return;
  }

  // Archive all existing sessions
  console.log("📦 Archiving all existing cash sessions...");

  const result = await prisma.cashSession.updateMany({
    data: {
      status: "ARCHIVED",
    },
  });

  console.log(`✅ Successfully archived ${result.count} cash sessions.`);

  // Show summary
  const archivedCount = await prisma.cashSession.count({
    where: { status: "ARCHIVED" },
  });
  const openCount = await prisma.cashSession.count({
    where: { status: "OPEN" },
  });
  const closedCount = await prisma.cashSession.count({
    where: { status: "CLOSED" },
  });

  console.log("\n📈 Summary:");
  console.log(`   - Archived: ${archivedCount}`);
  console.log(`   - Open: ${openCount}`);
  console.log(`   - Closed: ${closedCount}`);
}

main()
  .catch((e) => {
    console.error("❌ Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
