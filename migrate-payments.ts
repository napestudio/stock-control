// Temporary migration script to convert CARD to CREDIT_CARD
import { prisma } from "./lib/prisma";

async function main() {
  console.log("Starting migration of CARD payments to CREDIT_CARD...");

  // Update all Payment records with method = 'CARD' to 'CREDIT_CARD'
  const result = await prisma.$executeRaw`
    UPDATE "Payment"
    SET method = 'CREDIT_CARD'::"PaymentMethod"
    WHERE method = 'CARD'::"PaymentMethod"
  `;

  console.log(`✓ Migrated ${result} payment records from CARD to CREDIT_CARD`);

  // Verify the migration
  const allPayments = await prisma.payment.findMany({
    select: { method: true },
  });

  const methodCounts = allPayments.reduce((acc, p) => {
    acc[p.method] = (acc[p.method] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  console.log(`\nPayment method counts:`);
  Object.entries(methodCounts).forEach(([method, count]) => {
    console.log(`- ${method}: ${count}`);
  });

  const cardCount = methodCounts["CARD"] || 0;
  if (cardCount === 0) {
    console.log(`\n✓ Migration successful! No CARD payments remain.`);
  } else {
    console.warn(`\n⚠ Warning: ${cardCount} CARD payments still exist!`);
  }
}

main()
  .catch((e) => {
    console.error("Error during migration:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
