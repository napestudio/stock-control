"use client";

import type { SaleItem } from "@/types/sale";
import { useState } from "react";

interface SaleItemsListProps {
  items: SaleItem[];
  onRemove: (itemId: string) => void;
  onUpdateQuantity: (itemId: string, quantity: number) => void;
  disabled?: boolean;
}

export default function SaleItemsList({
  items,
  onRemove,
  onUpdateQuantity,
  disabled = false,
}: SaleItemsListProps) {
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editQuantity, setEditQuantity] = useState<number>(1);

  function handleStartEdit(item: SaleItem) {
    setEditingItemId(item.id);
    setEditQuantity(item.quantity);
  }

  function handleSaveEdit(itemId: string) {
    if (editQuantity > 0) {
      onUpdateQuantity(itemId, editQuantity);
    }
    setEditingItemId(null);
  }

  function handleCancelEdit() {
    setEditingItemId(null);
    setEditQuantity(1);
  }

  function handleIncrement(item: SaleItem) {
    onUpdateQuantity(item.id, item.quantity + 1);
  }

  function handleDecrement(item: SaleItem) {
    if (item.quantity > 1) {
      onUpdateQuantity(item.id, item.quantity - 1);
    }
  }

  const subtotal = items.reduce((sum, item) => {
    const price = item.variant?.price || 0;
    return sum + price * item.quantity;
  }, 0);

  if (items.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">No hay productos en la venta</p>
        <p className="text-sm text-gray-400 mt-1">
          Usa el buscador para agregar productos
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium text-gray-900">
        Productos ({items.length})
      </h3>

      <div className="space-y-2">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200"
          >
            {/* Product info */}
            <div className="flex-1 min-w-0">
              <p className="font-medium text-gray-900 truncate">
                {item.variant?.product?.name || "Producto"}
              </p>
              <p className="text-sm text-gray-600 truncate">
                {item.variant?.displayName || item.variant?.sku || ""}
              </p>
              <p className="text-sm font-medium text-gray-900 mt-1">
                ${(item.variant?.price || 0).toLocaleString("es-Ar")} c/u
              </p>
            </div>

            {/* Quantity controls */}
            <div className="flex items-center gap-2">
              {editingItemId === item.id ? (
                <>
                  <input
                    type="number"
                    min="1"
                    value={editQuantity}
                    onChange={(e) =>
                      setEditQuantity(parseInt(e.target.value) || 1)
                    }
                    className="w-16 px-2 py-1 text-center border border-gray-300 rounded"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => handleSaveEdit(item.id)}
                    className="text-green-600 hover:text-green-800 text-sm font-medium"
                    disabled={disabled}
                  >
                    ✓
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    className="text-gray-600 hover:text-gray-800 text-sm font-medium"
                    disabled={disabled}
                  >
                    ✗
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => handleDecrement(item)}
                    disabled={disabled || item.quantity <= 1}
                    className="w-8 h-8 flex items-center justify-center rounded-full bg-white border border-gray-300 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    -
                  </button>
                  <button
                    type="button"
                    onClick={() => handleStartEdit(item)}
                    className="w-12 h-8 flex items-center justify-center text-gray-900 font-medium hover:bg-white rounded"
                    disabled={disabled}
                  >
                    {item.quantity}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleIncrement(item)}
                    disabled={disabled}
                    className="w-8 h-8 flex items-center justify-center rounded-full bg-white border border-gray-300 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    +
                  </button>
                </>
              )}
            </div>

            {/* Subtotal */}
            <div className="text-right min-w-20">
              <p className="font-bold text-gray-900">
                $
                {((item.variant?.price || 0) * item.quantity).toLocaleString(
                  "es-Ar",
                )}
              </p>
            </div>

            {/* Remove button */}
            <button
              type="button"
              onClick={() => onRemove(item.id)}
              disabled={disabled}
              className="text-red-600 hover:text-red-800 p-2 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Eliminar producto"
            >
              <svg
                className="w-5 h-5"
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
        ))}
      </div>

      {/* Total */}
      <div className="pt-4 border-t border-gray-200">
        <div className="flex justify-between items-center">
          <span className="text-lg font-medium text-gray-900">Subtotal:</span>
          <span className="text-2xl font-bold text-gray-900">
            ${subtotal.toLocaleString("es-Ar")}
          </span>
        </div>
      </div>
    </div>
  );
}
