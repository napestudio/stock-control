import { AttributeTemplate, AttributeOption, VariantAttribute } from "@prisma/client";

// ======================================
// COMPOSITE TYPES WITH RELATIONS
// ======================================

export type AttributeTemplateWithOptions = AttributeTemplate & {
  options: AttributeOption[];
};

export type VariantAttributeWithDetails = VariantAttribute & {
  option: AttributeOption & {
    template: AttributeTemplate;
  };
};

// ======================================
// FORM & UI TYPES
// ======================================

export interface AttributeSelectionOption {
  templateId: string;
  templateName: string;
  optionId: string;
  optionValue: string;
}

export interface VariantGeneratorInput {
  selectedAttributes: Map<string, string[]>; // templateId -> [optionId, optionId]
  basePrice: number;
  baseCostPrice: number;
}

export interface GeneratedVariant {
  sku: string;
  displayName: string;
  attributes: AttributeSelectionOption[];
  price: number;
  costPrice: number;
  imageUrl?: string;
  imagePublicId?: string;
}
