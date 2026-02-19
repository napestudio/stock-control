"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Sidebar from "@/components/ui/sidebar";
import FormInput from "@/components/ui/form-input";
import { Button } from "@/components/ui/button";
import {
  createCustomerSchema,
  updateCustomerSchema,
  type CreateCustomerInput,
  type UpdateCustomerInput,
} from "@/lib/validations/customer-schema";
import type { Customer } from "@/types/customer";

interface CustomerFormSidebarProps {
  customer?: Customer;
  onSubmit: (data: CreateCustomerInput | UpdateCustomerInput) => void;
  onClose: () => void;
  isPending?: boolean;
}

export default function CustomerFormSidebar({
  customer,
  onSubmit,
  onClose,
  isPending = false,
}: CustomerFormSidebarProps) {
  const isEdit = Boolean(customer);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateCustomerInput>({
    resolver: zodResolver(isEdit ? updateCustomerSchema : createCustomerSchema),
    defaultValues: customer
      ? {
          firstName: customer.firstName,
          lastName: customer.lastName,
          email: customer.email ?? "",
          phone: customer.phone ?? "",
          address: customer.address ?? "",
          dni: customer.dni ?? "",
          membershipNumber: customer.membershipNumber ?? "",
        }
      : {
          firstName: "",
          lastName: "",
          email: "",
          phone: "",
          address: "",
          dni: "",
          membershipNumber: "",
        },
  });

  function handleFormSubmit(data: CreateCustomerInput) {
    if (isEdit && customer) {
      onSubmit({ ...data, id: customer.id } as UpdateCustomerInput);
    } else {
      onSubmit(data);
    }
  }

  return (
    <Sidebar
      isOpen
      onClose={onClose}
      title={isEdit ? "Editar Cliente" : "Nuevo Cliente"}
      size="md"
    >
      <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <FormInput
            label="Nombre"
            {...register("firstName")}
            error={errors.firstName?.message}
            required
            placeholder="Juan"
          />
          <FormInput
            label="Apellido"
            {...register("lastName")}
            error={errors.lastName?.message}
            required
            placeholder="Pérez"
          />
        </div>

        <FormInput
          label="DNI"
          {...register("dni")}
          error={errors.dni?.message}
          placeholder="12345678"
        />

        <FormInput
          label="Nro. de Socio"
          {...register("membershipNumber")}
          error={errors.membershipNumber?.message}
          placeholder="SOC-001"
        />

        <FormInput
          label="Email"
          type="email"
          {...register("email")}
          error={errors.email?.message}
          placeholder="cliente@ejemplo.com"
        />

        <FormInput
          label="Teléfono"
          type="tel"
          {...register("phone")}
          error={errors.phone?.message}
          placeholder="+54 11 1234-5678"
        />

        <FormInput
          label="Dirección"
          {...register("address")}
          error={errors.address?.message}
          placeholder="Av. Corrientes 1234, CABA"
        />

        <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isPending}
          >
            Cancelar
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? "Guardando..." : isEdit ? "Guardar cambios" : "Crear cliente"}
          </Button>
        </div>
      </form>
    </Sidebar>
  );
}
