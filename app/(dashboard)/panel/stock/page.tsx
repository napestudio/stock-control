import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/utils/auth-helpers";
import DashboardHeader from "@/components/dashboard-header";
import StockManagementClient from "./stock-management-client";
import { getStockList } from "@/app/actions/stock-actions";
import { getCategories } from "@/app/actions/product-actions";

export default async function StockPage() {
  const session = await auth();

  // Check admin permission
  if (!isAdmin(session)) {
    redirect("/panel");
  }

  // Fetch initial data in parallel for performance
  const [stockResult, categoriesResult] = await Promise.all([
    getStockList(undefined, 1, 50),
    getCategories(),
  ]);

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <DashboardHeader
        title="Control de Stock"
        subtitle="Gestiona inventario, niveles mínimos y movimientos"
        userName={session?.user?.name || session?.user?.email || "Admin"}
      />
      <StockManagementClient
        initialStockList={stockResult.stockList}
        initialPagination={stockResult.pagination}
        categories={categoriesResult}
      />
    </div>
  );
}
