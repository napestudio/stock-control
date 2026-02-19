import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/utils/auth-helpers";
import { getStatistics } from "@/app/actions/report-actions";
import { getSalesReport } from "@/app/actions/report-actions";
import DashboardHeader from "@/components/dashboard-header";
import StatisticsClient from "./statistics-client";

function defaultDateRange() {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 30);
  return {
    from: from.toISOString().split("T")[0],
    to: to.toISOString().split("T")[0],
  };
}

export default async function StatisticsPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (!isAdmin(session)) {
    redirect("/panel");
  }

  const { from, to } = defaultDateRange();

  const [statistics, salesReport] = await Promise.all([
    getStatistics(from, to),
    getSalesReport(from, to, 1, 1), // page size 1 — we only need the summary
  ]);

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardHeader
        title="Estadísticas"
        subtitle="Rendimiento de ventas e inventario"
        userName={session.user.name || "Admin"}
      />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <StatisticsClient
          initialFrom={from}
          initialTo={to}
          initialStatistics={statistics}
          initialSummary={salesReport.summary}
        />
      </div>
    </div>
  );
}
