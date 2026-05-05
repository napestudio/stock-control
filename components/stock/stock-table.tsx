"use client";

import type { StockWithVariantSerialized } from "@/types/stock";
import Badge from "@/components/ui/badge";
import AdjustmentsIcon from "@/components/icons/AdjustmentsIcon";
import ClockIcon from "@/components/icons/ClockIcon";

interface StockTableProps {
  stockList: StockWithVariantSerialized[];
  onAdjustStock: (stock: StockWithVariantSerialized) => void;
  onViewMovements: (stock: StockWithVariantSerialized) => void;
}

export default function StockTable({
  stockList,
  onAdjustStock,
  onViewMovements,
}: StockTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              SKU
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Producto
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Variante
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Stock Actual
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Stock Mínimo
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Estado
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Acciones
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {stockList.map((stock) => (
            <tr
              key={stock.id}
              className={stock.isLowStock ? "bg-red-50" : "hover:bg-gray-50"}
            >
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                {stock.variant.sku}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                {stock.variant.product.name}
                {stock.variant.product.category && (
                  <span className="ml-2 text-xs text-gray-500">
                    ({stock.variant.product.category.name})
                  </span>
                )}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                {stock.variant.displayName || stock.variant.name || "Default"}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                {stock.quantity}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                {stock.minimumStock}
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                {stock.quantity === 0 ? (
                  <Badge variant="warning">Sin Stock</Badge>
                ) : stock.isLowStock ? (
                  <Badge variant="error">Stock Bajo</Badge>
                ) : (
                  <Badge variant="success">OK</Badge>
                )}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm space-x-2">
                <button
                  onClick={() => onAdjustStock(stock)}
                  title="Ajustar stock"
                  className="inline-flex items-center justify-center p-1.5 rounded text-blue-600 hover:text-blue-800 hover:bg-blue-50 transition-colors"
                >
                  <AdjustmentsIcon className="w-5 h-5" />
                </button>
                <button
                  onClick={() => onViewMovements(stock)}
                  title="Ver historial"
                  className="inline-flex items-center justify-center p-1.5 rounded text-gray-600 hover:text-gray-800 hover:bg-gray-100 transition-colors"
                >
                  <ClockIcon className="w-5 h-5" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
