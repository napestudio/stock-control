export interface VariantScanDetail {
  id: string;
  sku: string;
  displayName: string | null;
  productName: string;
  productDescription: string | null;
  productImageUrl: string | null;
  variantImageUrl: string | null;
  price: number;
  costPrice: number;
  stockQuantity: number;
}
