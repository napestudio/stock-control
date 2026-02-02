"use client";

import { useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  createProductSchema,
  type CreateProductInput,
} from "@/lib/validations/product-schema";
import FormInput from "@/components/ui/form-input";
import FormSelect from "@/components/ui/form-select";
import type { ProductCategory } from "@prisma/client";
import type { ProductWithRelations } from "@/types/product";

interface ProductFormProps {
  mode: "create" | "edit";
  product?: ProductWithRelations;
  categories: ProductCategory[];
  onSubmit: (data: CreateProductInput) => void;
  onCancel: () => void;
  isPending?: boolean;
  error?: string;
}

export default function ProductForm({
  mode,
  product,
  categories,
  onSubmit,
  onCancel,
  isPending,
  error: externalError,
}: ProductFormProps) {
  const [internalError, setInternalError] = useState("");

  // Use external error (from parent) or internal error (from form submission)
  const error = externalError || internalError;

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<CreateProductInput>({
    resolver: zodResolver(createProductSchema),
    defaultValues:
      mode === "edit" && product
        ? {
            name: product.name,
            description: product.description || "",
            categoryId: product.categoryId || undefined,
            variants: product.variants.map((v) => ({
              id: v.id,
              sku: v.sku,
              name: v.name || "",
              price: Number(v.price),
              costPrice: Number(v.costPrice),
            })),
          }
        : {
            variants: [{ sku: "", name: "", price: 0, costPrice: 0 }],
          },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "variants",
  });

  async function onFormSubmit(data: CreateProductInput) {
    setInternalError("");
    try {
      onSubmit(data);
    } catch (err) {
      setInternalError(err instanceof Error ? err.message : "An error occurred");
    }
  }

  return (
    <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* Product Info */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium text-gray-900">
          Product Information
        </h3>

        <FormInput
          label="Product Name"
          {...register("name")}
          error={errors.name?.message}
          required
          placeholder="e.g., T-Shirt"
        />

        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">
            Description
          </label>
          <textarea
            {...register("description")}
            rows={3}
            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            placeholder="Optional product description"
          />
          {errors.description && (
            <p className="text-sm text-red-600">
              {errors.description.message}
            </p>
          )}
        </div>

        <FormSelect
          label="Category"
          {...register("categoryId")}
          options={categories.map((cat) => ({
            value: cat.id,
            label: cat.name,
          }))}
          error={errors.categoryId?.message}
        />

        {mode === "edit" && (
          <div className="flex items-center">
            <input
              type="checkbox"
              id="active"
              defaultChecked={product?.active}
              className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
              {...register("active" as any)}
            />
            <label
              htmlFor="active"
              className="ml-2 block text-sm text-gray-900"
            >
              Active
            </label>
          </div>
        )}
      </div>

      {/* Variants */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-medium text-gray-900">Variants</h3>
          <button
            type="button"
            onClick={() =>
              append({ sku: "", name: "", price: 0, costPrice: 0 })
            }
            className="text-sm text-indigo-600 hover:text-indigo-900 font-medium"
          >
            + Add Variant
          </button>
        </div>

        {errors.variants?.root && (
          <p className="text-sm text-red-600">{errors.variants.root.message}</p>
        )}

        <div className="space-y-4">
          {fields.map((field, index) => (
            <div
              key={field.id}
              className="border border-gray-200 rounded-lg p-4 space-y-3"
            >
              <div className="flex justify-between items-start">
                <h4 className="text-sm font-medium text-gray-700">
                  Variant {index + 1}
                </h4>
                {fields.length > 1 && (
                  <button
                    type="button"
                    onClick={() => remove(index)}
                    className="text-red-600 hover:text-red-900 text-sm"
                  >
                    Remove
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <FormInput
                  label="SKU"
                  {...register(`variants.${index}.sku`)}
                  error={errors.variants?.[index]?.sku?.message}
                  required
                  placeholder="e.g., TS-BLK-M"
                />

                <FormInput
                  label="Variant Name"
                  {...register(`variants.${index}.name`)}
                  error={errors.variants?.[index]?.name?.message}
                  placeholder="e.g., Black - Medium"
                />

                <FormInput
                  label="Price"
                  type="number"
                  step="0.01"
                  {...register(`variants.${index}.price`, {
                    valueAsNumber: true,
                  })}
                  error={errors.variants?.[index]?.price?.message}
                  required
                  placeholder="0.00"
                />

                <FormInput
                  label="Cost Price"
                  type="number"
                  step="0.01"
                  {...register(`variants.${index}.costPrice`, {
                    valueAsNumber: true,
                  })}
                  error={errors.variants?.[index]?.costPrice?.message}
                  required
                  placeholder="0.00"
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
          disabled={isPending}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPending
            ? mode === "create"
              ? "Creating..."
              : "Saving..."
            : mode === "create"
              ? "Create Product"
              : "Save Changes"}
        </button>
      </div>
    </form>
  );
}
