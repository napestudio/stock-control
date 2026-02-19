"use client";

import { useState } from "react";
import { UseFormRegister, UseFormSetValue, FieldErrors } from "react-hook-form";
import FormInput from "@/components/ui/form-input";
import type { CustomerInput } from "@/lib/validations/sale-schema";
import { searchCustomerByEmail } from "@/app/actions/sale-actions";

interface CustomerFormSectionProps {
  register: UseFormRegister<CustomerInput>;
  setValue: UseFormSetValue<CustomerInput>;
  errors: FieldErrors<CustomerInput>;
}

export default function CustomerFormSection({
  register,
  setValue,
  errors,
}: CustomerFormSectionProps) {
  const [isSearching, setIsSearching] = useState(false);
  const [customerFound, setCustomerFound] = useState(false);

  async function handleEmailBlur(e: React.FocusEvent<HTMLInputElement>) {
    const email = e.target.value;
    if (!email || email.length < 3) {
      setCustomerFound(false);
      return;
    }

    setIsSearching(true);
    try {
      const customer = await searchCustomerByEmail(email);
      if (customer) {
        setValue("firstName", customer.firstName);
        setValue("lastName", customer.lastName);
        setValue("phone", customer.phone || "");
        setValue("address", customer.address || "");
        setCustomerFound(true);
      } else {
        setCustomerFound(false);
      }
    } catch (error) {
      console.error("Error searching customer:", error);
      setCustomerFound(false);
    } finally {
      setIsSearching(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium text-gray-900 mb-3">
          Información del Cliente
        </h3>
        <p className="text-xs text-gray-500 mb-4">
          Los campos marcados con * son obligatorios
        </p>
      </div>

      {/* Email first - acts as search */}
      <div>
        <FormInput
          label="Email"
          type="email"
          {...register("email")}
          onBlur={handleEmailBlur}
          error={errors.email?.message}
          required
          placeholder="cliente@ejemplo.com"
        />
        {isSearching && (
          <p className="mt-1 text-sm text-blue-600">Buscando cliente...</p>
        )}
        {customerFound && !isSearching && (
          <p className="mt-1 text-sm text-green-600">
            ✓ Cliente encontrado - datos cargados
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
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
        label="Teléfono"
        type="tel"
        {...register("phone")}
        error={errors.phone?.message}
        placeholder="+34 123 456 789"
      />

      {/* Address as input instead of textarea */}
      <FormInput
        label="Dirección"
        {...register("address")}
        error={errors.address?.message}
        placeholder="Calle Principal 123, Piso 2"
      />
    </div>
  );
}
