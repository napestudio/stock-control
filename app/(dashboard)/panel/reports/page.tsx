import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/utils/auth-helpers";
import { getSalesReport, getStockMovementsReport } from "@/app/actions/report-actions";
import DashboardHeader from "@/components/dashboard-header";
import ReportsClient from "./reports-client";

function defaultDateRange() {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 30);
  return {
    from: from.toISOString().split("T")[0],
    to: to.toISOString().split("T")[0],
  };
}

export default async function ReportsPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (!isAdmin(session)) {
    redirect("/panel");
  }

  const { from, to } = defaultDateRange();

  const [salesReport, stockReport] = await Promise.all([
    getSalesReport(from, to, 1, 50),
    getStockMovementsReport(from, to, 1, 50),
  ]);

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardHeader
        title="Reportes"
        subtitle="Análisis de ventas e inventario"
        userName={session.user.name || "Admin"}
      />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <ReportsClient
          initialFrom={from}
          initialTo={to}
          initialSalesReport={salesReport}
          initialStockReport={stockReport}
        />
      </div>
    </div>
  );
}
