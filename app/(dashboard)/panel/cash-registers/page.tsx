import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/utils/auth-helpers";
import { getCashRegisters } from "@/app/actions/cash-register-actions";
import DashboardHeader from "@/components/dashboard-header";
import CashRegisterManagementClient from "./cash-register-management-client";

export default async function CashRegistersPage() {
  const session = await auth();

  // Check admin permission
  if (!isAdmin(session)) {
    redirect("/panel");
  }

  // Fetch all cash registers with active session info
  const registers = await getCashRegisters();

  return (
    <div>
      <DashboardHeader
        title="Gestión de Cajas Registradoras"
        subtitle="Administra cajas y sesiones de arqueo"
        userName={session?.user?.name || session?.user?.email || "Admin"}
      />
      <CashRegisterManagementClient initialRegisters={registers} />
    </div>
  );
}
