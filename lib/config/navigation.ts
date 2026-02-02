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
    path: "/panel/products",
    label: "Productos",
    icon: "package",
    requiresAdmin: true,
  },
  {
    path: "/panel/users",
    label: "Usuarios",
    icon: "users",
    requiresAdmin: true,
  },
  {
    path: "/panel/change-password",
    label: "Cambiar Contraseña",
    icon: "key",
  },
];
