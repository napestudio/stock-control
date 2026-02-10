"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  createCashRegisterSchema,
  type CreateCashRegisterInput,
} from "@/lib/validations/cash-register-schema";
import { createCashRegister, updateCashRegister } from "@/app/actions/cash-register-actions";
import FormInput from "@/components/ui/form-input";
import Sidebar from "@/components/ui/sidebar";
import type { CashRegisterWithStats } from "@/types/cash-register";

interface CashRegisterFormSidebarProps {
  mode: "create" | "edit";
  register?: CashRegisterWithStats;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function CashRegisterFormSidebar({
  mode,
  register: cashRegister,
  isOpen,
  onClose,
  onSuccess,
}: CashRegisterFormSidebarProps) {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const form = useForm({
    resolver: zodResolver(createCashRegisterSchema),
    defaultValues:
      mode === "edit" && cashRegister
        ? {
            name: cashRegister.name,
            active: cashRegister.active,
          }
        : {
            name: "",
            active: true,
          },
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = form;

  async function onSubmit(data: CreateCashRegisterInput) {
    setError("");
    setLoading(true);

    try {
      if (mode === "create") {
        await createCashRegister(data);
      } else if (mode === "edit" && cashRegister) {
        await updateCashRegister(cashRegister.id, data);
      }
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ocurrió un error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Sidebar
      isOpen={isOpen}
      onClose={onClose}
      title={mode === "create" ? "Nueva Caja Registradora" : "Editar Caja Registradora"}
      size="md"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        <FormInput
          label="Nombre"
          {...register("name")}
          error={errors.name?.message}
          required
          placeholder="Ej: Caja Principal, Caja 2"
        />

        {mode === "edit" && (
          <div className="flex items-center">
            <input
              type="checkbox"
              id="active"
              className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
              {...register("active")}
            />
            <label htmlFor="active" className="ml-2 block text-sm text-gray-900">
              Activa
            </label>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
            disabled={loading}
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading
              ? mode === "create"
                ? "Creando..."
                : "Guardando..."
              : mode === "create"
                ? "Crear"
                : "Guardar"}
          </button>
        </div>
      </form>
    </Sidebar>
  );
}
