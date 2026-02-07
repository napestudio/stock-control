import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/utils/auth-helpers";
import DashboardHeader from "@/components/dashboard-header";
import ProductManagementClient from "./product-management-client";
import { getProducts, getCategories } from "@/app/actions/product-actions";

export default async function ProductsPage() {
  const session = await auth();

  // Check admin permission
  if (!isAdmin(session)) {
    redirect("/panel");
  }

  // Fetch categories and products with pagination
  const [categoriesResult, productsResult] = await Promise.all([
    getCategories(),
    getProducts("all", undefined, undefined, 1, 50),
  ]);

  return (
    <div>
      <DashboardHeader
        title="Gestión de Productos"
        subtitle="Gestiona productos, variantes e inventario"
        userName={session?.user?.name || session?.user?.email || "Admin"}
      />
      <ProductManagementClient
        initialProducts={productsResult.products}
        initialPagination={productsResult.pagination}
        categories={categoriesResult}
      />
    </div>
  );
}
