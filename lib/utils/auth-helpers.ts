import { Session } from "next-auth";

export function isAdmin(session: Session | null): boolean {
  return session?.user?.role === "Admin";
}

export function hasPermission(
  session: Session | null,
  requiredRole: string,
): boolean {
  return session?.user?.role === requiredRole;
}
