"use client";

import { useState, useEffect, useCallback } from "react";
import { AttributeTemplateWithOptions, GeneratedVariant } from "@/types/attribute";
import { Button } from "@/components/ui/button";
import ImageUpload from "./image-upload";

interface Props {
  templates: AttributeTemplateWithOptions[];
  productName: string;
  categoryName?: string | null;
  onVariantsGenerated: (variants: GeneratedVariant[]) => void;
  disabled?: boolean;
}

export default function VariantGenerator({
  templates,
  productName,
  categoryName,
  onVariantsGenerated,
  disabled,
}: Props) {
  const [selectedTemplates, setSelectedTemplates] = useState<string[]>([]);
  const [selectedOptions, setSelectedOptions] = useState<Map<string, string[]>>(new Map());
  const [basePrice, setBasePrice] = useState<number>(0);
  const [baseCostPrice, setBaseCostPrice] = useState<number>(0);
  const [generatedVariants, setGeneratedVariants] = useState<GeneratedVariant[]>([]);

  // Cleanup effect - reset state when component unmounts
  useEffect(() => {
    return () => {
      // Clear large state objects on unmount
      setGeneratedVariants([]);
      setSelectedOptions(new Map());
    };
  }, []);

  const handleTemplateToggle = (templateId: string) => {
    if (selectedTemplates.includes(templateId)) {
      setSelectedTemplates(selectedTemplates.filter((id) => id !== templateId));
      const newOptions = new Map(selectedOptions);
      newOptions.delete(templateId);
      setSelectedOptions(newOptions);
    } else {
      if (selectedTemplates.length >= 3) {
        alert("Máximo 3 atributos permitidos");
        return;
      }
      setSelectedTemplates([...selectedTemplates, templateId]);
    }
  };

  const handleOptionToggle = (templateId: string, optionId: string) => {
    const newOptions = new Map(selectedOptions);
    const current = newOptions.get(templateId) || [];

    if (current.includes(optionId)) {
      newOptions.set(
        templateId,
        current.filter((id) => id !== optionId)
      );
    } else {
      newOptions.set(templateId, [...current, optionId]);
    }

    setSelectedOptions(newOptions);
  };

  const generateVariants = () => {
    if (!productName.trim()) {
      alert("Por favor ingresa primero un nombre de producto");
      return;
    }

    // Get selected templates and their options
    const selectedData = selectedTemplates.map((templateId) => {
      const template = templates.find((t) => t.id === templateId)!;
      const optionIds = selectedOptions.get(templateId) || [];
      const options = template.options.filter((o) => optionIds.includes(o.id));

      return {
        templateId: template.id,
        templateName: template.name,
        options: options.map((o) => ({
          optionId: o.id,
          optionValue: o.value,
        })),
      };
    });

    // Validate all templates have options selected
    if (selectedData.some((d) => d.options.length === 0)) {
      alert("Por favor selecciona al menos una opción para cada atributo");
      return;
    }

    // Generate Cartesian product
    const variants: GeneratedVariant[] = [];

    function generateCombinations(
      index: number,
      current: { templateId: string; templateName: string; optionId: string; optionValue: string }[]
    ) {
      if (index === selectedData.length) {
        const sku = generateSku(categoryName, productName, current.map((c) => ({ optionValue: c.optionValue })));
        const displayName = current.map((c) => c.optionValue).join(" / ");

        variants.push({
          sku,
          displayName,
          attributes: current,
          price: basePrice,
          costPrice: baseCostPrice,
        });
        return;
      }

      const template = selectedData[index];
      for (const option of template.options) {
        generateCombinations(index + 1, [
          ...current,
          {
            templateId: template.templateId,
            templateName: template.templateName,
            optionId: option.optionId,
            optionValue: option.optionValue,
          },
        ]);
      }
    }

    if (selectedData.length > 0) {
      generateCombinations(0, []);
    }

    if (variants.length > 100) {
      alert("Demasiadas variantes (máx. 100). Por favor reduce las opciones.");
      return;
    }

    if (variants.length === 0) {
      alert("No se generaron variantes. Por favor selecciona atributos y opciones.");
      return;
    }

    setGeneratedVariants(variants);
  };

  function generateSku(
    categoryName: string | null | undefined,
    productName: string,
    attributes: { optionValue: string }[]
  ): string {
    // Category prefix: First 2 letters, pad with X if needed, or "XX" if no category
    const categoryPrefix = categoryName
      ? categoryName.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 2).padEnd(2, "X")
      : "XX";

    const productPrefix = productName
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 10);

    const attributeSuffix = attributes
      .map((attr) => attr.optionValue.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5))
      .join("-");

    return `${categoryPrefix}-${productPrefix}-${attributeSuffix}`;
  }

  const handleVariantChange = useCallback((index: number, field: string, value: string | number | null) => {
    setGeneratedVariants((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  }, []);

  const handleDeleteVariant = useCallback((index: number) => {
    setGeneratedVariants((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleApplyPriceToAll = useCallback(() => {
    setGeneratedVariants((prev) => prev.map((v) => ({ ...v, price: basePrice })));
  }, [basePrice]);

  const handleApplyCostToAll = useCallback(() => {
    setGeneratedVariants((prev) => prev.map((v) => ({ ...v, costPrice: baseCostPrice })));
  }, [baseCostPrice]);

  const calculateEstimatedVariants = () => {
    let count = 1;
    selectedTemplates.forEach((templateId) => {
      const options = selectedOptions.get(templateId) || [];
      count *= options.length;
    });
    return count;
  };

  const handleUseVariants = useCallback(() => {
    if (generatedVariants.length === 0) {
      alert("No hay variantes para usar");
      return;
    }
    // Pass variants to parent
    onVariantsGenerated(generatedVariants);

    // Clear state immediately after to free memory
    // The parent will now manage this data
    setGeneratedVariants([]);
    setSelectedTemplates([]);
    setSelectedOptions(new Map());
    setBasePrice(0);
    setBaseCostPrice(0);
  }, [generatedVariants, onVariantsGenerated]);

  if (templates.length === 0) {
    return (
      <div className="border-2 border-dashed rounded-lg p-8 text-center">
        <p className="text-gray-500 mb-2">No hay plantillas de atributos disponibles</p>
        <p className="text-sm text-gray-400">
          Crea primero plantillas de atributos en Configuración → Atributos
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Step 1: Select Attributes */}
      <div className="space-y-3">
        <h4 className="font-medium text-gray-900">Paso 1: Selecciona Atributos (máx. 3)</h4>
        <div className="grid grid-cols-3 gap-3">
          {templates.map((template) => (
            <button
              key={template.id}
              type="button"
              onClick={() => handleTemplateToggle(template.id)}
              disabled={disabled}
              className={`p-3 border-2 rounded-lg text-sm font-medium transition-colors ${
                selectedTemplates.includes(template.id)
                  ? "border-blue-500 bg-blue-50 text-blue-700"
                  : "border-gray-300 bg-white text-gray-700 hover:border-gray-400"
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {template.name}
            </button>
          ))}
        </div>
      </div>

      {/* Step 2: Select Options */}
      {selectedTemplates.length > 0 && (
        <div className="space-y-4">
          <h4 className="font-medium text-gray-900">Paso 2: Selecciona Opciones</h4>
          {selectedTemplates.map((templateId) => {
            const template = templates.find((t) => t.id === templateId)!;
            return (
              <div key={templateId} className="space-y-2">
                <label className="text-sm font-medium text-gray-700">{template.name}</label>
                <div className="flex flex-wrap gap-2">
                  {template.options.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => handleOptionToggle(templateId, option.id)}
                      disabled={disabled}
                      className={`px-3 py-1.5 text-sm border-2 rounded-md transition-colors ${
                        selectedOptions.get(templateId)?.includes(option.id)
                          ? "bg-blue-600 text-white border-blue-600"
                          : "bg-white text-gray-700 border-gray-300 hover:border-gray-400"
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      {option.value}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}

          <div className="grid grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Precio Base
              </label>
              <input
                type="number"
                value={basePrice}
                onChange={(e) => setBasePrice(Number(e.target.value))}
                disabled={disabled}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                step="0.01"
                min="0"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Costo Base
              </label>
              <input
                type="number"
                value={baseCostPrice}
                onChange={(e) => setBaseCostPrice(Number(e.target.value))}
                disabled={disabled}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                step="0.01"
                min="0"
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <p className="text-sm text-gray-600">
              Generará <strong>{calculateEstimatedVariants()}</strong> variantes
            </p>
            <Button type="button" onClick={generateVariants} disabled={disabled}>
              Generar Variantes
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Review Generated Variants */}
      {generatedVariants.length > 0 && (
        <div className="space-y-4 border-t pt-6">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-gray-900">
              Paso 3: Revisar y Editar ({generatedVariants.length} variantes)
            </h4>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleApplyPriceToAll}
                disabled={disabled}
              >
                Aplicar Precio a Todos
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleApplyCostToAll}
                disabled={disabled}
              >
                Aplicar Costo a Todos
              </Button>
            </div>
          </div>

          <div className="space-y-3 max-h-96 overflow-y-auto">
            {generatedVariants.map((variant, index) => (
              <div key={index} className="border rounded-lg p-4 bg-gray-50">
                <div className="flex gap-4 items-start">
                  <div className="flex-1 space-y-3">
                    <div>
                      <label className="text-xs font-medium text-gray-600">Atributos</label>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {variant.attributes.map((attr) => (
                          <span
                            key={attr.optionId}
                            className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded"
                          >
                            {attr.optionValue}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="text-xs font-medium text-gray-600">SKU</label>
                        <input
                          type="text"
                          value={variant.sku}
                          onChange={(e) => handleVariantChange(index, "sku", e.target.value)}
                          disabled={disabled}
                          className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md mt-1"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-medium text-gray-600">Precio</label>
                        <input
                          type="number"
                          value={variant.price}
                          onChange={(e) =>
                            handleVariantChange(index, "price", Number(e.target.value))
                          }
                          disabled={disabled}
                          className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md mt-1"
                          step="0.01"
                          min="0"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-medium text-gray-600">Costo</label>
                        <input
                          type="number"
                          value={variant.costPrice}
                          onChange={(e) =>
                            handleVariantChange(index, "costPrice", Number(e.target.value))
                          }
                          disabled={disabled}
                          className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md mt-1"
                          step="0.01"
                          min="0"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="w-24">
                    <label className="text-xs font-medium text-gray-600 block mb-1">
                      Imagen
                    </label>
                    <ImageUpload
                      currentImageUrl={variant.imageUrl}
                      onImageChange={(url, publicId) => {
                        handleVariantChange(index, "imageUrl", url);
                        handleVariantChange(index, "imagePublicId", publicId);
                      }}
                      disabled={disabled}
                    />
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteVariant(index)}
                    disabled={disabled}
                    className="mt-6"
                  >
                    Eliminar
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <Button
            type="button"
            onClick={handleUseVariants}
            disabled={disabled}
            className="w-full"
          >
            Usar Estas Variantes ({generatedVariants.length})
          </Button>
        </div>
      )}
    </div>
  );
}
