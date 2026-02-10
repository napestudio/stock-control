import { auth } from "@/auth";
import { isAdmin } from "@/lib/utils/auth-helpers";
import { redirect } from "next/navigation";
import DashboardHeader from "@/components/dashboard-header";
import CashMovementsClient from "./cash-movements-client";
import { getCashRegisters } from "@/app/actions/cash-register-actions";
import { getCashMovementsHistory } from "@/app/actions/cash-session-actions";

export default async function CashMovementsPage() {
  const session = await auth();

  // Admin only
  if (!isAdmin(session)) {
    redirect("/panel");
  }

  // Fetch initial data in parallel
  const [movementsResult, cashRegisters] = await Promise.all([
    getCashMovementsHistory({}, 1, 50),
    getCashRegisters(),
  ]);

  return (
    <div className="flex-1 space-y-4 p-4 pt-6 md:p-8">
      <DashboardHeader
        title="Historial de Movimientos"
        subtitle="Visualiza y analiza todos los movimientos de caja"
        userName={session?.user?.name || session?.user?.email || "Admin"}
      />

      <CashMovementsClient
        initialMovements={movementsResult.movements}
        initialPagination={movementsResult.pagination}
        initialSummary={movementsResult.summary}
        cashRegisters={cashRegisters}
      />
    </div>
  );
}
