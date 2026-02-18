import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getMyPendingSales, getSalesHistory } from "@/app/actions/sale-actions";
import DashboardHeader from "@/components/dashboard-header";
import SalesManagementClient from "./sales-management-client";

export default async function SalesPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  // Fetch all pending sales and sales history in parallel
  const [pendingSales, salesHistory] = await Promise.all([
    getMyPendingSales(),
    getSalesHistory(undefined, 1, 50),
  ]);

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardHeader
        title="Ventas"
        subtitle="Gestión de ventas y clientes"
        userName={session.user.name || "Usuario"}
      />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <SalesManagementClient
          pendingSales={pendingSales}
          initialSales={salesHistory.sales}
          initialPagination={salesHistory.pagination}
        />
      </div>
    </div>
  );
}
