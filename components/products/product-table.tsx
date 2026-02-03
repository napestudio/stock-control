"use client";

import Image from "next/image";
import Badge from "@/components/ui/badge";
import type { ProductWithRelations } from "@/types/product";

interface ProductTableProps {
  products: ProductWithRelations[];
  onView: (product: ProductWithRelations) => void;
  onEdit: (product: ProductWithRelations) => void;
  onDelete: (product: ProductWithRelations) => void;
  isPending?: boolean;
}

export default function ProductTable({
  products,
  onView,
  onEdit,
  onDelete,
  isPending,
}: ProductTableProps) {
  if (products.length === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-lg shadow">
        <svg
          className="mx-auto h-12 w-12 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
          />
        </svg>
        <h3 className="mt-2 text-sm font-medium text-gray-900">No products</h3>
        <p className="mt-1 text-sm text-gray-500">
          Get started by creating a new product.
        </p>
      </div>
    );
  }

  return (
    <div
      className={`bg-white shadow rounded-lg overflow-hidden ${
        isPending ? "opacity-60" : ""
      }`}
    >
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Product
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Category
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Variants
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Total Stock
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Status
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {products.map((product) => {
            const totalStock = product.variants.reduce(
              (sum, v) => sum + (v.stock?.quantity || 0),
              0
            );
            const isTemp = product.id.startsWith("temp-");

            return (
              <tr
                key={product.id}
                className={`hover:bg-gray-50 cursor-pointer ${
                  isTemp ? "bg-blue-50" : ""
                }`}
                onClick={() => onView(product)}
              >
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    {product.imageUrl && (
                      <div className="relative w-10 h-10 rounded overflow-hidden shrink-0">
                        <Image
                          src={product.imageUrl}
                          alt={product.name}
                          fill
                          className="object-cover"
                          sizes="40px"
                        />
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900">
                        {product.name}
                        {isTemp && (
                          <span className="ml-2 text-xs text-blue-600">
                            (Saving...)
                          </span>
                        )}
                      </div>
                      {product.description && (
                        <div className="text-sm text-gray-500 truncate max-w-xs">
                          {product.description}
                        </div>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">
                    {product.category?.name || "-"}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">
                    {product.variants.length} variant
                    {product.variants.length !== 1 ? "s" : ""}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">{totalStock}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {product.active ? (
                    <Badge variant="success">Active</Badge>
                  ) : (
                    <Badge variant="neutral">Inactive</Badge>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <div
                    className="flex justify-end gap-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => onEdit(product)}
                      className="text-indigo-600 hover:text-indigo-900"
                      title="Edit product"
                      disabled={isTemp}
                    >
                      <svg
                        className="h-5 w-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                        />
                      </svg>
                    </button>
                    <button
                      onClick={() => onDelete(product)}
                      className="text-red-600 hover:text-red-900"
                      title="Delete product"
                      disabled={isTemp}
                    >
                      <svg
                        className="h-5 w-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
