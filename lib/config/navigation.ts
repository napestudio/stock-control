export interface NavItem {
  path: string;
  label: string;
  icon: string;
  requiresAdmin?: boolean;
}

export const navigationItems: NavItem[] = [
  {
    path: "/panel",
    label: "Panel de Control",
    icon: "home",
  },
  {
    path: "/panel/sales",
    label: "Ventas",
    icon: "shopping-bag",
    requiresAdmin: true,
  },
  {
    path: "/panel/products",
    label: "Productos",
    icon: "shirt",
    requiresAdmin: true,
  },
  {
    path: "/panel/stock",
    label: "Control de Stock",
    icon: "clipboard-list",
    requiresAdmin: true,
  },
  {
    path: "/panel/cash-registers",
    label: "Arqueo de Caja",
    icon: "banknotes",
    requiresAdmin: true,
  },
  {
    path: "/panel/customers",
    label: "Clientes",
    icon: "users",
    requiresAdmin: true,
  },
  {
    path: "/panel/reports",
    label: "Reportes",
    icon: "chart-bar",
    requiresAdmin: true,
  },
  {
    path: "/panel/statistics",
    label: "Estadísticas",
    icon: "arrow-trending-up",
    requiresAdmin: true,
  },
  {
    path: "/panel/users",
    label: "Usuarios",
    icon: "users",
    requiresAdmin: true,
  },
];
