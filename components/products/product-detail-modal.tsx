"use client";

import Image from "next/image";
import { QRCodeSVG } from "qrcode.react";
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
              <h3 className="text-sm font-medium text-gray-500">Descripción</h3>
              <p className="mt-1 text-sm text-gray-900">
                {product.description || "Sin descripción"}
              </p>
            </div>
            <div>
              {product.active ? (
                <Badge variant="success">Activo</Badge>
              ) : (
                <Badge variant="neutral">Inactivo</Badge>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <h3 className="text-sm font-medium text-gray-500">Categoría</h3>
              <p className="mt-1 text-sm text-gray-900">
                {product.category?.name || "Sin categoría"}
              </p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500">
                Stock Total
              </h3>
              <p className="mt-1 text-sm text-gray-900">{totalStock} unidades</p>
            </div>
          </div>
        </div>

        {/* Variants table */}
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-3">
            Variantes ({product.variants.length})
          </h3>
          <div className="border border-gray-200 rounded-lg overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Imagen
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Atributos
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    SKU
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                    Precio
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                    Costo
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                    Stock
                  </th>
                  <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">
                    QR
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {product.variants.map((variant) => (
                  <tr key={variant.id}>
                    <td className="px-4 py-2">
                      <div className="relative w-12 h-12 rounded overflow-hidden bg-gray-100">
                        <Image
                          src={
                            variant.imageUrl ||
                            product.imageUrl ||
                            "/placeholder-product.png"
                          }
                          alt={variant.displayName || variant.name || "Variant"}
                          fill
                          className="object-cover"
                          sizes="48px"
                        />
                      </div>
                    </td>
                    <td className="px-4 py-2">
                      {variant.attributes && Array.isArray(variant.attributes) && variant.attributes.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {variant.attributes.map((attr) => (
                            attr?.option?.value && (
                              <span
                                key={attr.id}
                                className="inline-flex items-center px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded"
                              >
                                {attr.option.value}
                              </span>
                            )
                          ))}
                        </div>
                      ) : (
                        <span className="text-sm text-gray-500">
                          {variant.displayName || variant.name || "-"}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-sm font-mono text-gray-900">
                      {variant.sku}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-900 text-right">
                      ${Number(variant.price).toFixed(2)}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-500 text-right">
                      ${Number(variant.costPrice).toFixed(2)}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-900 text-right font-medium">
                      {variant.stock?.quantity || 0}
                    </td>
                    <td className="px-4 py-2 text-center">
                      <div className="flex flex-col items-center gap-1">
                        <QRCodeSVG value={variant.sku} size={48} />
                        <span className="text-xs text-gray-400">
                          {variant.sku}
                        </span>
                      </div>
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
            Cerrar
          </button>
          <button
            onClick={onEdit}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700"
          >
            Editar Producto
          </button>
        </div>
      </div>
    </Modal>
  );
}
