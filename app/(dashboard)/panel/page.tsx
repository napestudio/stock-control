import { auth } from "@/auth";
import DashboardHeader from "@/components/dashboard-header";

export default async function DashboardPage() {
  const session = await auth();

  return (
    <div>
      <DashboardHeader
        title="Panel de administración"
        subtitle="Este es el panel de administración"
        userName={session?.user?.name || session?.user?.email || "Usuario"}
      />
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
