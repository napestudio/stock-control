"use client";

import Image from "next/image";
import Modal from "@/components/ui/modal";
import Badge from "@/components/ui/badge";
import type { ProductWithRelations } from "@/types/product";

interface ProductDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: ProductWithRelations;
  onEdit: () => void;
}

export default function ProductDetailModal({
  isOpen,
  onClose,
  product,
  onEdit,
}: ProductDetailModalProps) {
  const totalStock = product.variants.reduce(
    (sum, v) => sum + (v.stock?.quantity || 0),
    0
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={product.name} size="lg">
      <div className="space-y-6">
        {/* Product Image */}
        {product.imageUrl && (
          <div className="relative w-full h-64 rounded-lg overflow-hidden bg-gray-100">
            <Image
              src={product.imageUrl}
              alt={product.name}
              fill
              className="object-contain"
              sizes="(max-width: 768px) 100vw, 600px"
            />
          </div>
        )}

        {/* Product info */}
        <div className="space-y-3">
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <h3 className="text-sm font-medium text-gray-500">Description</h3>
              <p className="mt-1 text-sm text-gray-900">
                {product.description || "No description"}
              </p>
            </div>
            <div>
              {product.active ? (
                <Badge variant="success">Active</Badge>
              ) : (
                <Badge variant="neutral">Inactive</Badge>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <h3 className="text-sm font-medium text-gray-500">Category</h3>
              <p className="mt-1 text-sm text-gray-900">
                {product.category?.name || "Uncategorized"}
              </p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500">
                Total Stock
              </h3>
              <p className="mt-1 text-sm text-gray-900">{totalStock} units</p>
            </div>
          </div>
        </div>

        {/* Variants table */}
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-3">Variants</h3>
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    SKU
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Name
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                    Price
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                    Cost
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                    Stock
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {product.variants.map((variant) => (
                  <tr key={variant.id}>
                    <td className="px-4 py-2 text-sm font-medium text-gray-900">
                      {variant.sku}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-500">
                      {variant.name || "-"}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-900 text-right">
                      ${Number(variant.price).toFixed(2)}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-500 text-right">
                      ${Number(variant.costPrice).toFixed(2)}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-900 text-right">
                      {variant.stock?.quantity || 0}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Close
          </button>
          <button
            onClick={onEdit}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700"
          >
            Edit Product
          </button>
        </div>
      </div>
    </Modal>
  );
}
