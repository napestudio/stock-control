import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/utils/auth-helpers";
import { getPrinters } from "@/app/actions/printer-actions";
import { getCashRegisters } from "@/app/actions/cash-register-actions";
import DashboardHeader from "@/components/dashboard-header";
import PrintersManagementClient from "@/components/printers/printers-management-client";

export default async function PrintersPage() {
  const session = await auth();

  if (!isAdmin(session)) {
    redirect("/panel");
  }

  const [printers, cashRegisters] = await Promise.all([
    getPrinters(),
    getCashRegisters(),
  ]);

  return (
    <div>
      <DashboardHeader
        title="Gestión de Impresoras"
        subtitle="Administra las impresoras para puntos de venta"
        userName={session?.user?.name || session?.user?.email || "Admin"}
      />
      <PrintersManagementClient
        initialPrinters={printers}
        cashRegisters={cashRegisters}
      />
    </div>
  );
}
