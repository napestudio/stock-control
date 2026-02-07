import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/utils/auth-helpers";
import { prisma } from "@/lib/prisma";
import DashboardHeader from "@/components/dashboard-header";
import UserManagementClient from "./user-management-client";

export default async function UsersPage() {
  const session = await auth();

  // Check admin permission
  if (!isAdmin(session)) {
    redirect("/panel");
  }

  // Fetch all roles for the role dropdown
  const roles = await prisma.role.findMany({
    orderBy: { name: "asc" },
  });

  // Fetch all users (not soft-deleted)
  const users = await prisma.user.findMany({
    where: { deletedAt: null },
    include: { role: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <DashboardHeader
        title="Gestión de Usuarios"
        subtitle="Gestiona usuarios del sistema y roles"
        userName={session?.user?.name || session?.user?.email || "Admin"}
      />
      <UserManagementClient initialUsers={users} roles={roles} />
    </div>
  );
}
