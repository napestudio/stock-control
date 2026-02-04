"use client";

import { useState, useEffect } from "react";
import { useForm, useFieldArray, useWatch, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  createProductSchema,
  editProductSchema,
  type CreateProductInput,
  type EditProductInput,
  type VariantInput,
} from "@/lib/validations/product-schema";
import FormInput from "@/components/ui/form-input";
import FormSelect from "@/components/ui/form-select";
import ImageUpload from "./image-upload";
import VariantGenerator from "./variant-generator";
import { getAttributeTemplates } from "@/app/actions/attribute-actions";
import type { ProductCategory } from "@prisma/client";
import type { ProductWithRelations } from "@/types/product";
import type { AttributeTemplateWithOptions, GeneratedVariant } from "@/types/attribute";

interface ProductFormProps {
  mode: "create" | "edit";
  product?: ProductWithRelations;
  categories: ProductCategory[];
  onSubmit: (data: CreateProductInput | EditProductInput) => void;
  onCancel: () => void;
  isPending?: boolean;
  error?: string;
}

// Form data type - superset of both create and edit
type ProductFormData = CreateProductInput & {
  active?: boolean; // Only used in edit mode
};

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
  const [variantStrategy, setVariantStrategy] = useState<"simple" | "attributes">("simple");
  const [attributeTemplates, setAttributeTemplates] = useState<AttributeTemplateWithOptions[]>([]);

  // Use external error (from parent) or internal error (from form submission)
  const error = externalError || internalError;

  // Load attribute templates for create mode
  useEffect(() => {
    async function loadTemplates() {
      try {
        const templates = await getAttributeTemplates();
        setAttributeTemplates(templates);
      } catch (err) {
        console.error("Failed to load attribute templates:", err);
      }
    }
    if (mode === "create") {
      loadTemplates();
    }
  }, [mode]);

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors },
  } = useForm<ProductFormData>({
    resolver: zodResolver(mode === "edit" ? editProductSchema : createProductSchema) as Resolver<ProductFormData>,
    defaultValues:
      mode === "edit" && product
        ? {
            name: product.name,
            description: product.description || "",
            categoryId: product.categoryId || "",
            active: product.active,
            imageUrl: product.imageUrl || undefined,
            imagePublicId: product.imagePublicId || undefined,
            variants: product.variants.map((v) => ({
              id: v.id,
              sku: v.sku,
              name: v.name || "",
              price: Number(v.price),
              costPrice: Number(v.costPrice),
            })),
          }
        : {
            name: "",
            description: "",
            categoryId: "",
            imageUrl: undefined,
            imagePublicId: undefined,
            variants: [{ sku: "", name: "", price: 0, costPrice: 0 }],
          },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "variants",
  });

  // Watch product name and image URL
  const currentImageUrl = useWatch({ control, name: "imageUrl" });
  const productName = useWatch({ control, name: "name" });

  // Handle image change callback
  const handleImageChange = (imageUrl: string | null, imagePublicId: string | null) => {
    setValue("imageUrl", imageUrl || undefined);
    setValue("imagePublicId", imagePublicId || undefined);
  };

  // Handle switching to simple variant mode
  const handleSwitchToSimple = () => {
    setVariantStrategy("simple");

    // Ensure at least one variant exists when switching to simple mode
    if (fields.length === 0) {
      append({ sku: "", name: "", price: 0, costPrice: 0 });
    }
  };

  // Handle switching to attribute-based variant mode
  const handleSwitchToAttributes = () => {
    setVariantStrategy("attributes");

    // Clear all variants when switching to attributes mode
    // User will generate new variants via VariantGenerator
    for (let i = fields.length - 1; i >= 0; i--) {
      remove(i);
    }
  };

  // Handle generated variants from attribute generator
  const handleVariantsGenerated = (generatedVariants: GeneratedVariant[]) => {
    // Clear existing variants by removing in reverse order
    // This prevents react-hook-form's RangeError: Invalid array length
    for (let i = fields.length - 1; i >= 0; i--) {
      remove(i);
    }

    // Add generated variants
    generatedVariants.forEach((variant) => {
      const variantInput: VariantInput = {
        sku: variant.sku,
        name: variant.displayName,
        price: variant.price,
        costPrice: variant.costPrice,
        imageUrl: variant.imageUrl,
        imagePublicId: variant.imagePublicId,
        displayName: variant.displayName,
        attributes: variant.attributes,
      };
      append(variantInput);
    });

    // Switch to simple view to show generated variants
    setVariantStrategy("simple");
  };

  async function onFormSubmit(data: ProductFormData) {
    setInternalError("");
    console.log("📤 Form data before submit:", {
      categoryId: data.categoryId,
      name: data.name,
      variantCount: data.variants.length,
      variants: data.variants,
    });

    try {
      // Clean up variant data - remove undefined/null imageUrls and imagePublicIds
      const cleanedVariants = data.variants.map((variant) => ({
        ...variant,
        imageUrl: variant.imageUrl || undefined,
        imagePublicId: variant.imagePublicId || undefined,
        displayName: variant.displayName || undefined,
        attributes: variant.attributes || undefined,
      }));

      // Prepare submit data based on mode
      if (mode === "create") {
        const submitData: CreateProductInput = {
          name: data.name,
          description: data.description,
          categoryId: data.categoryId,
          variants: cleanedVariants,
          imageUrl: data.imageUrl,
          imagePublicId: data.imagePublicId,
        };
        console.log("📤 Final submit data:", submitData);
        onSubmit(submitData);
      } else {
        const submitData: EditProductInput = {
          id: product!.id,
          name: data.name,
          description: data.description,
          categoryId: data.categoryId,
          active: data.active,
          variants: cleanedVariants,
          imageUrl: data.imageUrl,
          imagePublicId: data.imagePublicId,
        };
        console.log("📤 Final submit data:", submitData);
        onSubmit(submitData);
      }
    } catch (err) {
      console.error("❌ Form submission error:", err);
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

      <div className="space-y-4">
        <h3 className="text-lg font-medium text-gray-900">Product Information</h3>

        <FormInput
          label="Product Name"
          {...register("name")}
          error={errors.name?.message}
          required
          placeholder="e.g., T-Shirt"
        />

        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">Description</label>
          <textarea
            {...register("description")}
            rows={3}
            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            placeholder="Optional product description"
          />
          {errors.description && (
            <p className="text-sm text-red-600">{errors.description.message}</p>
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

        <ImageUpload
          currentImageUrl={currentImageUrl}
          onImageChange={handleImageChange}
          disabled={isPending}
        />

        {mode === "edit" && (
          <div className="flex items-center">
            <input
              type="checkbox"
              id="active"
              defaultChecked={product?.active}
              className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
              {...register("active")}
            />
            <label htmlFor="active" className="ml-2 block text-sm text-gray-900">
              Active
            </label>
          </div>
        )}
      </div>

      {/* Variants */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-medium text-gray-900">Variants</h3>
          {mode === "create" && attributeTemplates.length > 0 && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleSwitchToSimple}
                disabled={isPending}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  variantStrategy === "simple"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                Simple
              </button>
              <button
                type="button"
                onClick={handleSwitchToAttributes}
                disabled={isPending}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  variantStrategy === "attributes"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                Attribute-Based
              </button>
            </div>
          )}
        </div>

        {errors.variants?.root && (
          <p className="text-sm text-red-600">{errors.variants.root.message}</p>
        )}

        {/* Attribute-Based Variant Generator */}
        {mode === "create" && variantStrategy === "attributes" && (
          <VariantGenerator
            templates={attributeTemplates}
            productName={productName || ""}
            onVariantsGenerated={handleVariantsGenerated}
            disabled={isPending}
          />
        )}

        {/* Simple Variant Management */}
        {variantStrategy === "simple" && (
          <>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => append({ sku: "", name: "", price: 0, costPrice: 0 })}
                disabled={isPending}
                className="text-sm text-indigo-600 hover:text-indigo-900 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                + Add Variant
              </button>
            </div>

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
                        disabled={isPending}
                        className="text-red-600 hover:text-red-900 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
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
                      disabled={isPending}
                    />

                    <FormInput
                      label="Variant Name"
                      {...register(`variants.${index}.name`)}
                      error={errors.variants?.[index]?.name?.message}
                      placeholder="e.g., Black - Medium"
                      disabled={isPending}
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
                      disabled={isPending}
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
                      disabled={isPending}
                    />
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
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
