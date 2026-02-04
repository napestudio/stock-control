"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
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

  const onSubmit = async (data: AttributeTemplateInput) => {
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
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddOption = async () => {
    if (!newOptionValue.trim()) return;
    if (!template?.id && mode === "edit") {
      alert("Please save the template first before adding options");
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
      setError(err instanceof Error ? err.message : "Failed to add option");
    } finally {
      setIsAddingOption(false);
    }
  };

  const handleDeleteOption = async (optionId: string, optionValue: string) => {
    if (!confirm(`Delete option "${optionValue}"?`)) return;

    setIsSubmitting(true);
    setError("");

    try {
      await deleteAttributeOption(optionId);
      setOptions(options.filter((o) => o.id !== optionId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete option");
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
          label="Template Name"
          error={errors.name?.message}
          {...register("name")}
          placeholder="e.g., Size, Color, Material"
          required
        />

        <FormInput
          label="Description (optional)"
          error={errors.description?.message}
          {...register("description")}
          placeholder="e.g., Product size options"
        />

        <input type="hidden" {...register("displayOrder")} />

        <div className="flex gap-2">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting
              ? "Saving..."
              : mode === "create"
              ? "Create Template"
              : "Save Changes"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/panel/settings/attributes")}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
        </div>
      </form>

      {/* Options Management - Only show in edit mode */}
      {mode === "edit" && template && (
        <div className="border-t pt-6">
          <h3 className="font-semibold text-lg mb-4">Options</h3>

          <div className="flex gap-2 mb-4">
            <input
              type="text"
              value={newOptionValue}
              onChange={(e) => setNewOptionValue(e.target.value)}
              placeholder="Add new option (e.g., Small, Red)"
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
              {isAddingOption ? "Adding..." : "Add Option"}
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
                    Delete
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic">
              No options yet. Add your first option above.
            </p>
          )}
        </div>
      )}

      {mode === "create" && (
        <div className="border rounded-lg p-4 bg-muted/50">
          <p className="text-sm text-muted-foreground">
            💡 <strong>Tip:</strong> After creating the template, you'll be able to add
            options like "Small", "Medium", "Large" for Size, or "Red", "Blue", "Green"
            for Color.
          </p>
        </div>
      )}
    </div>
  );
}
