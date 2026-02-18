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
    icon: "package",
    requiresAdmin: true,
  },
  {
    path: "/panel/products",
    label: "Productos",
    icon: "package",
    requiresAdmin: true,
  },
  {
    path: "/panel/stock",
    label: "Control de Stock",
    icon: "package",
    requiresAdmin: true,
  },
  {
    path: "/panel/cash-registers",
    label: "Arqueo de Caja",
    icon: "package",
    requiresAdmin: true,
  },
  {
    path: "/panel/customers",
    label: "Clientes",
    icon: "users",
    requiresAdmin: true,
  },
  {
    path: "/panel/users",
    label: "Usuarios",
    icon: "users",
    requiresAdmin: true,
  },
];
