"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, type SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  attributeTemplateSchema,
  type AttributeTemplateInput,
} from "@/lib/validations/attribute-schema";
import {
  createAttributeTemplate,
  updateAttributeTemplate,
  createAttributeOption,
  deleteAttributeOption,
} from "@/app/actions/attribute-actions";
import FormInput from "@/components/ui/form-input";
import { Button } from "@/components/ui/button";
import type { AttributeTemplateWithOptions } from "@/types/attribute";

interface Props {
  mode: "create" | "edit";
  template?: AttributeTemplateWithOptions;
}

export default function AttributeTemplateForm({ mode, template }: Props) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Option management
  const [options, setOptions] = useState(template?.options || []);
  const [newOptionValue, setNewOptionValue] = useState("");
  const [isAddingOption, setIsAddingOption] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<AttributeTemplateInput>({
    resolver: zodResolver(attributeTemplateSchema),
    defaultValues:
      mode === "edit" && template
        ? {
            name: template.name,
            description: template.description || "",
            displayOrder: template.displayOrder,
          }
        : {
            name: "",
            description: "",
            displayOrder: 0,
          },
  });

  const onSubmit: SubmitHandler<AttributeTemplateInput> = async (data) => {
    setIsSubmitting(true);
    setError("");

    try {
      if (mode === "create") {
        await createAttributeTemplate(data);
        router.push("/panel/settings/attributes");
      } else if (template) {
        await updateAttributeTemplate(template.id, data);
        router.push("/panel/settings/attributes");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Algo salió mal");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddOption = async () => {
    if (!newOptionValue.trim()) return;
    if (!template?.id && mode === "edit") {
      alert("Por favor, guarda la plantilla antes de agregar opciones");
      return;
    }

    setIsAddingOption(true);
    setError("");

    try {
      if (mode === "edit" && template) {
        const option = await createAttributeOption({
          templateId: template.id,
          value: newOptionValue.trim(),
          displayOrder: options.length,
        });
        setOptions([...options, option]);
        setNewOptionValue("");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al agregar opción");
    } finally {
      setIsAddingOption(false);
    }
  };

  const handleDeleteOption = async (optionId: string, optionValue: string) => {
    if (!confirm(`¿Eliminar la opción "${optionValue}"?`)) return;

    setIsSubmitting(true);
    setError("");

    try {
      await deleteAttributeOption(optionId);
      setOptions(options.filter((o) => o.id !== optionId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al eliminar opción");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {error && (
          <div className="bg-destructive/15 text-destructive px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        <FormInput
          label="Nombre de Plantilla"
          error={errors.name?.message}
          {...register("name")}
          placeholder="ej: Talla, Color, Material"
          required
        />

        <FormInput
          label="Descripción (opcional)"
          error={errors.description?.message}
          {...register("description")}
          placeholder="ej: Opciones de talla del producto"
        />

        <input type="hidden" {...register("displayOrder")} />

        <div className="flex gap-2">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting
              ? "Guardando..."
              : mode === "create"
              ? "Crear Plantilla"
              : "Guardar Cambios"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/panel/settings/attributes")}
            disabled={isSubmitting}
          >
            Cancelar
          </Button>
        </div>
      </form>

      {/* Options Management - Only show in edit mode */}
      {mode === "edit" && template && (
        <div className="border-t pt-6">
          <h3 className="font-semibold text-lg mb-4">Opciones</h3>

          <div className="flex gap-2 mb-4">
            <input
              type="text"
              value={newOptionValue}
              onChange={(e) => setNewOptionValue(e.target.value)}
              placeholder="Agregar nueva opción (ej: Pequeño, Rojo)"
              className="flex-1 px-3 py-2 border rounded-lg"
              onKeyPress={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddOption();
                }
              }}
              disabled={isAddingOption}
            />
            <Button
              type="button"
              onClick={handleAddOption}
              disabled={!newOptionValue.trim() || isAddingOption}
            >
              {isAddingOption ? "Agregando..." : "Agregar Opción"}
            </Button>
          </div>

          {options.length > 0 ? (
            <div className="space-y-2">
              {options.map((option) => (
                <div
                  key={option.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <span className="font-medium">{option.value}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteOption(option.id, option.value)}
                    disabled={isSubmitting}
                  >
                    Eliminar
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic">
              No hay opciones aún. Agrega tu primera opción arriba.
            </p>
          )}
        </div>
      )}

      {mode === "create" && (
        <div className="border rounded-lg p-4 bg-muted/50">
          <p className="text-sm text-muted-foreground">
            💡 <strong>Consejo:</strong> Después de crear la plantilla, podrás agregar
            opciones como &quot;Pequeño&quot;, &quot;Mediano&quot;, &quot;Grande&quot; para Talla, o &quot;Rojo&quot;, &quot;Azul&quot;, &quot;Verde&quot;
            para Color.
          </p>
        </div>
      )}
    </div>
  );
}
