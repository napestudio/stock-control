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

// Helper function to get attribute summary
function getAttributeSummary(product: ProductWithRelations): string | null {
  const variants = product.variants;
  if (!variants || variants.length === 0) return null;

  // Get unique template names from all variants
  const templateNames = new Set<string>();
  variants.forEach((variant) => {
    // DEFENSIVE: Check if attributes exist and is array
    if (Array.isArray(variant.attributes)) {
      variant.attributes.forEach((attr) => {
        // DEFENSIVE: Check if attr has required properties
        if (attr?.option?.template?.name) {
          templateNames.add(attr.option.template.name);
        }
      });
    }
  });

  if (templateNames.size === 0) return null;

  return Array.from(templateNames).join(" × ");
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
        <h3 className="mt-2 text-sm font-medium text-gray-900">
          No hay productos
        </h3>
        <p className="mt-1 text-sm text-gray-500">
          Comienza creando un nuevo producto.
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
              Producto
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Categoría
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Variantes
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Stock Total
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Estado
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Acciones
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {products.map((product) => {
            const totalStock = product.variants.reduce(
              (sum, v) => sum + (v.stock?.quantity || 0),
              0,
            );
            const isTemp = product.id.startsWith("temp-");

            return (
              <tr
                key={product.id}
                className={`hover:bg-gray-50 cursor-pointer ${
                  isTemp ? "bg-blue-50" : ""
                }`}
                onClick={() => onEdit(product)}
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
                            (Guardando...)
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
                <td className="px-6 py-4">
                  <div className="text-sm text-gray-900">
                    {product.variants.length} variante
                    {product.variants.length !== 1 ? "s" : ""}
                  </div>
                  {getAttributeSummary(product) && (
                    <div className="text-xs text-gray-500 mt-1">
                      {getAttributeSummary(product)}
                    </div>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">{totalStock}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {product.active ? (
                    <Badge variant="success">Activo</Badge>
                  ) : (
                    <Badge variant="neutral">Inactivo</Badge>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <div
                    className="flex justify-end gap-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => onView(product)}
                      className="text-indigo-600 hover:text-indigo-900"
                      title="Ver detalle"
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
                          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                        />
                      </svg>
                    </button>
                    <button
                      onClick={() => onDelete(product)}
                      className="text-red-600 hover:text-red-900"
                      title="Eliminar producto"
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
