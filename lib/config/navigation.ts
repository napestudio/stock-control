export interface NavItem {
  path: string;
  label: string;
  icon: string;
  requiresAdmin?: boolean;
}

export interface NavGroup {
  label: string;
  icon: string;
  requiresAdmin?: boolean;
  children: NavItem[];
}

export type NavEntry = NavItem | NavGroup;

export const navigationItems: NavEntry[] = [
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
    label: "Configuración",
    icon: "settings",
    requiresAdmin: true,
    children: [
      {
        path: "/panel/configuration/users",
        label: "Usuarios",
        icon: "users",
      },
      {
        path: "/panel/configuration/printers",
        label: "Impresoras",
        icon: "printer",
      },
    ],
  },
];
