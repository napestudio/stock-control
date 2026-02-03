import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/utils/auth-helpers";
import { prisma } from "@/lib/prisma";
import DashboardHeader from "@/components/dashboard-header";
import ProductManagementClient from "./product-management-client";

export default async function ProductsPage() {
  const session = await auth();

  // Check admin permission
  if (!isAdmin(session)) {
    redirect("/panel");
  }

  // Fetch all categories for the dropdown
  const categories = await prisma.productCategory.findMany({
    orderBy: { name: "asc" },
  });

  // Fetch all products (not soft-deleted) with variants and stock
  const productsRaw = await prisma.product.findMany({
    where: { deletedAt: null },
    include: {
      category: true,
      variants: {
        include: {
          stock: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // Serialize Decimal fields to numbers for client components
  const products = productsRaw.map((product) => ({
    ...product,
    variants: product.variants.map((variant) => ({
      ...variant,
      price: Number(variant.price),
      costPrice: Number(variant.costPrice),
    })),
  }));

  return (
    <div>
      <DashboardHeader
        title="Product Management"
        subtitle="Manage products, variants, and inventory"
        userName={session?.user?.name || session?.user?.email || "Admin"}
      />
      <ProductManagementClient
        initialProducts={products as any}
        categories={categories}
      />
    </div>
  );
}
