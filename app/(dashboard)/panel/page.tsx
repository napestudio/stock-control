import { auth } from "@/auth";
import { isAdmin } from "@/lib/utils/auth-helpers";
import { getDashboardData } from "@/app/actions/dashboard-actions";
import type {
  RecentSaleItem,
  ActiveSessionSummary,
} from "@/app/actions/dashboard-actions";
import DashboardHeader from "@/components/dashboard-header";
import Link from "next/link";
import { SaleStatus } from "@prisma/client";

// ── helpers ────────────────────────────────────────────────────────────────

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
  }).format(amount);
}

function formatDateTime(iso: string) {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(iso));
}

const STATUS_BADGE_CLASSES: Record<SaleStatus, string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  COMPLETED: "bg-green-100 text-green-800",
  CANCELED: "bg-gray-100 text-gray-700",
  REFUNDED: "bg-red-100 text-red-800",
};

// ── sub-components (server, no "use client") ───────────────────────────────

function QuickActions({ isAdminUser }: { isAdminUser: boolean }) {
  const actions = [
    {
      href: "/panel/sales",
      label: "Ventas",
      description: "Historial de ventas",
      primary: false,
      icon: (
        <svg
          className="h-6 w-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
          />
        </svg>
      ),
    },
    {
      href: "/panel/products",
      label: "Productos",
      description: "Gestión de productos",
      primary: false,
      icon: (
        <svg
          className="h-6 w-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
          />
        </svg>
      ),
    },
    {
      href: "/panel/reports",
      label: "Reportes",
      description: "Ventas e inventario",
      primary: false,
      adminOnly: true,
      icon: (
        <svg
          className="h-6 w-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
          />
        </svg>
      ),
    },
  ] satisfies {
    href: string;
    label: string;
    description: string;
    primary: boolean;
    adminOnly?: boolean;
    icon: React.ReactNode;
  }[];

  const visibleActions = actions.filter((a) => !a.adminOnly || isAdminUser);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-6">
      {visibleActions.map((action) => (
        <Link
          key={action.href}
          href={action.href}
          className={`flex flex-col items-center justify-center gap-2 p-4 rounded-xl border transition-colors text-center ${
            action.primary
              ? "bg-indigo-600 border-indigo-600 text-white hover:bg-indigo-700"
              : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300"
          }`}
        >
          <span className={action.primary ? "text-white" : "text-gray-500"}>
            {action.icon}
          </span>
          <span className="text-sm font-semibold leading-tight">
            {action.label}
          </span>
          <span
            className={`text-xs leading-tight ${action.primary ? "text-indigo-100" : "text-gray-400"}`}
          >
            {action.description}
          </span>
        </Link>
      ))}
    </div>
  );
}

function CashSessionCard({ session }: { session: ActiveSessionSummary }) {
  if (!session) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-5 flex flex-col gap-2">
        <div className="flex items-center gap-2 text-gray-500">
          <svg
            className="h-5 w-5 shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
            />
          </svg>
          <span className="text-sm font-medium">Caja</span>
        </div>
        <p className="text-sm text-gray-400">Sin sesión activa</p>
        <Link
          href="/panel/cash-registers"
          className="mt-1 text-xs text-indigo-600 hover:text-indigo-700 font-medium"
        >
          Abrir sesión →
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-green-200 p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-green-700">
          <svg
            className="h-5 w-5 shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
            />
          </svg>
          <span className="text-sm font-medium">{session.registerName}</span>
        </div>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
          <span className="h-1.5 w-1.5 rounded-full bg-green-500 inline-block" />
          Abierta
        </span>
      </div>
      <div>
        <p className="text-xs text-gray-400">Balance actual</p>
        <p className="text-2xl font-bold text-gray-800 mt-0.5">
          {formatCurrency(session.balance)}
        </p>
      </div>
      <p className="text-xs text-gray-400">
        Desde {formatDateTime(session.openedAt)}
      </p>
    </div>
  );
}

function LowStockCard({
  count,
  isAdminUser,
}: {
  count: number;
  isAdminUser: boolean;
}) {
  if (!isAdminUser) return null;

  if (count === 0) {
    return (
      <div className="bg-white rounded-xl border border-green-200 p-5 flex flex-col gap-2">
        <div className="flex items-center gap-2 text-green-700">
          <svg
            className="h-5 w-5 shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span className="text-sm font-medium">Stock</span>
        </div>
        <p className="text-sm text-gray-500">
          Todos los productos en niveles normales
        </p>
      </div>
    );
  }

  return (
    <div className="bg-red-50 rounded-xl border border-red-200 p-5 flex flex-col gap-3">
      <div className="flex items-center gap-2 text-red-700">
        <svg
          className="h-5 w-5 shrink-0"
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
        <span className="text-sm font-medium text-red-800">
          Alerta de Stock Bajo
        </span>
      </div>
      <p className="text-sm text-red-700">
        {count} {count === 1 ? "producto tiene" : "productos tienen"} stock por
        debajo del mínimo.
      </p>
      <Link
        href="/panel/stock?lowStockOnly=true"
        className="inline-flex items-center gap-1 text-xs font-medium text-red-700 hover:text-red-800"
      >
        Ver productos
        <svg
          className="h-3.5 w-3.5"
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
  );
}

function RecentSalesSection({ sales }: { sales: RecentSaleItem[] }) {
  return (
    <div className="mt-6 bg-white rounded-xl border border-gray-200">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <h2 className="text-sm font-semibold text-gray-800">Últimas ventas</h2>
        <Link
          href="/panel/sales"
          className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
        >
          Ver todas →
        </Link>
      </div>

      {sales.length === 0 ? (
        <p className="px-5 py-6 text-sm text-gray-400 text-center">
          No hay ventas recientes
        </p>
      ) : (
        <div className="divide-y divide-gray-50">
          {sales.map((sale) => (
            <div key={sale.id} className="flex items-center gap-4 px-5 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-800 truncate">
                  {sale.customer}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {formatDate(sale.createdAt)} · {sale.paymentMethod}
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-sm font-semibold text-gray-800">
                  {formatCurrency(sale.total)}
                </span>
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE_CLASSES[sale.statusKey]}`}
                >
                  {sale.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── page ───────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const session = await auth();
  const adminUser = isAdmin(session);

  const { lowStockCount, recentSales, activeSession } =
    await getDashboardData();

  const userName = session?.user?.name || session?.user?.email || "Usuario";

  return (
    <div>
      <DashboardHeader
        title="Panel de Control"
        subtitle={`Bienvenido, ${userName}`}
      />

      <QuickActions isAdminUser={adminUser} />

      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <CashSessionCard session={activeSession} />
        <LowStockCard count={lowStockCount} isAdminUser={adminUser} />
      </div>

      <RecentSalesSection sales={recentSales} />
    </div>
  );
}
