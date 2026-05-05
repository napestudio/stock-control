"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import CustomerFormSidebar from "@/components/customers/customer-form-sidebar";
import TrashIcon from "@/components/icons/TrashIcon";
import PencilIcon from "@/components/icons/PencilIcon";
import {
  createCustomer,
  updateCustomer,
  deleteCustomer,
} from "@/app/actions/customer-actions";
import type {
  CustomerListResult,
  CustomerWithSalesCount,
} from "@/types/customer";
import type {
  CreateCustomerInput,
  UpdateCustomerInput,
} from "@/lib/validations/customer-schema";

interface CustomersClientProps {
  initialData: CustomerListResult;
}

export default function CustomersClient({
  initialData,
}: CustomersClientProps) {
  const [customers, setCustomers] = useState(initialData.customers);
  const [showSidebar, setShowSidebar] = useState(false);
  const [editingCustomer, setEditingCustomer] =
    useState<CustomerWithSalesCount | null>(null);
  const [isPending, startTransition] = useTransition();

  function openCreate() {
    setEditingCustomer(null);
    setShowSidebar(true);
  }

  function openEdit(customer: CustomerWithSalesCount) {
    setEditingCustomer(customer);
    setShowSidebar(true);
  }

  function closeSidebar() {
    setShowSidebar(false);
    setEditingCustomer(null);
  }

  function handleSubmit(data: CreateCustomerInput | UpdateCustomerInput) {
    startTransition(async () => {
      try {
        if ("id" in data) {
          const updated = await updateCustomer(data as UpdateCustomerInput);
          setCustomers((prev) =>
            prev.map((c) =>
              c.id === updated.id ? { ...updated, _count: c._count } : c,
            ),
          );
        } else {
          const created = await createCustomer(data as CreateCustomerInput);
          setCustomers((prev) => [{ ...created, _count: { sales: 0 } }, ...prev]);
        }
        closeSidebar();
      } catch (error) {
        alert(
          error instanceof Error ? error.message : "Error al guardar el cliente",
        );
      }
    });
  }

  function handleDelete(customer: CustomerWithSalesCount) {
    if (
      !confirm(
        `¿Eliminar a ${customer.firstName} ${customer.lastName}? Esta acción no se puede deshacer.`,
      )
    )
      return;

    startTransition(async () => {
      try {
        await deleteCustomer(customer.id);
        setCustomers((prev) => prev.filter((c) => c.id !== customer.id));
      } catch (error) {
        alert(
          error instanceof Error
            ? error.message
            : "Error al eliminar el cliente",
        );
      }
    });
  }

  return (
    <>
      <div className="flex justify-end">
        <Button onClick={openCreate}>Nuevo Cliente</Button>
      </div>

      {customers.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">
            No hay clientes registrados
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            Comenzá agregando el primer cliente.
          </p>
          <div className="mt-4">
            <Button onClick={openCreate}>Agregar Cliente</Button>
          </div>
        </div>
      ) : (
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Nombre
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  DNI
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Nro. Socio
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Teléfono
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ventas
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {customers.map((customer) => (
                <tr
                  key={customer.id}
                  onClick={() => openEdit(customer)}
                  className="hover:bg-gray-50 cursor-pointer"
                >
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {customer.firstName} {customer.lastName}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {customer.dni ?? "—"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {customer.membershipNumber ?? "—"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {customer.email ?? "—"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {customer.phone ?? "—"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {customer._count?.sales ?? 0}
                  </td>
                  <td
                    className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => openEdit(customer)}
                        className="text-indigo-600 hover:text-indigo-900 disabled:opacity-40"
                        title="Editar cliente"
                        disabled={isPending}
                      >
                        <PencilIcon className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => handleDelete(customer)}
                        className="text-red-600 hover:text-red-900 disabled:opacity-40"
                        title="Eliminar cliente"
                        disabled={isPending}
                      >
                        <TrashIcon className="h-5 w-5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showSidebar && (
        <CustomerFormSidebar
          customer={editingCustomer ?? undefined}
          onSubmit={handleSubmit}
          onClose={closeSidebar}
          isPending={isPending}
        />
      )}
    </>
  );
}
