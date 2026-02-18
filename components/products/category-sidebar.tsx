"use client";

import { createCategorySchema } from "@/lib/validations/product-schema";
import FormInput from "@/components/ui/form-input";
import Sidebar from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

type CreateCategoryFormData = z.infer<typeof createCategorySchema>;

interface CategorySidebarProps {
  onSubmit: (data: CreateCategoryFormData) => void;
  onClose: () => void;
  isPending?: boolean;
  error?: string;
}

export default function CategorySidebar({
  onSubmit,
  onClose,
  isPending,
  error,
}: CategorySidebarProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateCategoryFormData>({
    resolver: zodResolver(createCategorySchema),
  });

  return (
    <Sidebar isOpen onClose={onClose} title="Nueva Categoría" size="sm">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">
            {error}
          </div>
        )}

        <FormInput
          label="Nombre"
          required
          placeholder="Ej: Electrónica"
          error={errors.name?.message}
          {...register("name")}
        />

        <div className="w-full">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Descripción
          </label>
          <textarea
            rows={3}
            placeholder="Descripción opcional de la categoría..."
            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 resize-none"
            {...register("description")}
          />
          {errors.description && (
            <p className="mt-1 text-sm text-red-600">
              {errors.description.message}
            </p>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? "Guardando..." : "Guardar"}
          </Button>
        </div>
      </form>
    </Sidebar>
  );
}
