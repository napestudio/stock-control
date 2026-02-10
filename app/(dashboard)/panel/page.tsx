import { auth } from "@/auth";
import { isAdmin } from "@/lib/utils/auth-helpers";
import { getLowStockCount } from "@/app/actions/stock-actions";
import DashboardHeader from "@/components/dashboard-header";
import Link from "next/link";

export default async function DashboardPage() {
  const session = await auth();

  // Get low stock count for admin users
  let lowStockCount = 0;
  if (isAdmin(session)) {
    try {
      lowStockCount = await getLowStockCount();
    } catch (error) {
      console.error("Error fetching low stock count:", error);
    }
  }

  return (
    <div>
      <DashboardHeader
        title="Panel de administración"
        subtitle="Este es el panel de administración"
        userName={session?.user?.name || session?.user?.email || "Usuario"}
      />

      {/* Low Stock Alert */}
      {isAdmin(session) && lowStockCount > 0 && (
        <div className="mt-6 bg-red-50 border-l-4 border-red-500 p-4 rounded-md shadow-sm">
          <div className="flex items-start">
            <div className="shrink-0">
              <svg
                className="h-6 w-6 text-red-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <div className="ml-3 flex-1">
              <h3 className="text-sm font-medium text-red-800">
                Alerta de Stock Bajo
              </h3>
              <div className="mt-2 text-sm text-red-700">
                <p>
                  {lowStockCount}{" "}
                  {lowStockCount === 1 ? "producto tiene" : "productos tienen"}{" "}
                  stock por debajo del nivel mínimo.
                </p>
              </div>
              <div className="mt-3">
                <Link
                  href="/panel/stock?lowStockOnly=true"
                  className="inline-flex items-center px-3 py-2 text-sm font-medium text-red-700 bg-red-100 hover:bg-red-200 rounded-md transition-colors"
                >
                  Ver productos con stock bajo
                  <svg
                    className="ml-2 h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="mt-8 p-6 bg-white rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">Información de sesión</h3>
        <div className="space-y-2">
          <p>
            <span className="font-medium">Nombre:</span> {session?.user?.name}
          </p>
          <p>
            <span className="font-medium">Email:</span> {session?.user?.email}
          </p>
          <p>
            <span className="font-medium">Rol:</span> {session?.user?.role}
          </p>
        </div>
      </div>
    </div>
  );
}
