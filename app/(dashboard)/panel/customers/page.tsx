import { getCustomers } from "@/app/actions/customer-actions";
import CustomersClient from "./customers-client";

export default async function CustomersPage() {
  const result = await getCustomers();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Clientes</h1>
        <p className="text-muted-foreground mt-1">
          Administrá el padrón de clientes y sus datos de contacto
        </p>
      </div>

      <CustomersClient initialData={result} />
    </div>
  );
}
