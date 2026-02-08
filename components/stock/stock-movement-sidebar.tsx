"use client";

import { useEffect, useState } from "react";
import Sidebar from "@/components/ui/sidebar";
import { getStockMovements } from "@/app/actions/stock-actions";
import type { StockMovementWithVariant } from "@/types/stock";

interface StockMovementSidebarProps {
  variantId: string;
  variantName: string;
  onClose: () => void;
}

export default function StockMovementSidebar({
  variantId,
  variantName,
  onClose,
}: StockMovementSidebarProps) {
  const [movements, setMovements] = useState<StockMovementWithVariant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadMovements() {
      try {
        setLoading(true);
        setError("");
        const result = await getStockMovements(variantId);
        setMovements(result.movements);
      } catch (err) {
        console.error("Error loading movements:", err);
        setError(err instanceof Error ? err.message : "Error al cargar movimientos");
      } finally {
        setLoading(false);
      }
    }
    loadMovements();
  }, [variantId]);

  const getMovementTypeLabel = (type: string) => {
    switch (type) {
      case "IN":
        return "Entrada";
      case "OUT":
        return "Salida";
      case "ADJUSTMENT":
        return "Ajuste";
      case "RETURN":
        return "Devolución";
      default:
        return type;
    }
  };

  const getMovementTypeColor = (type: string) => {
    switch (type) {
      case "IN":
      case "RETURN":
        return "bg-green-100 text-green-800";
      case "OUT":
        return "bg-red-100 text-red-800";
      case "ADJUSTMENT":
        return "bg-blue-100 text-blue-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <Sidebar isOpen onClose={onClose} title="Historial de Movimientos" size="lg">
      <div className="mb-4 bg-gray-50 p-3 rounded-md">
        <p className="text-sm font-medium text-gray-900">{variantName}</p>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
          <p className="mt-3 text-sm text-gray-600">Cargando movimientos...</p>
        </div>
      ) : error ? (
        <div className="text-center py-12">
          <p className="text-red-600">{error}</p>
        </div>
      ) : movements.length === 0 ? (
        <div className="text-center py-12">
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
              d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
            />
          </svg>
          <p className="mt-3 text-sm text-gray-600">No hay movimientos registrados</p>
          <p className="text-xs text-gray-500 mt-1">
            Los movimientos de stock aparecerán aquí cuando realices ajustes
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Fecha
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tipo
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Cantidad
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Razón
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {movements.map((movement) => (
                <tr key={movement.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm whitespace-nowrap text-gray-900">
                    {new Date(movement.createdAt).toLocaleString("es-ES", {
                      year: "numeric",
                      month: "2-digit",
                      day: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-medium rounded ${getMovementTypeColor(
                        movement.type
                      )}`}
                    >
                      {getMovementTypeLabel(movement.type)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                    {movement.type === "OUT" ? "-" : "+"}
                    {movement.quantity}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {movement.reason || "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Sidebar>
  );
}
