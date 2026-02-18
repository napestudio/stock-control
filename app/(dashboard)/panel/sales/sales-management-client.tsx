"use client";

import { useState, useTransition, useOptimistic } from "react";
import type {
  SaleWithRelations,
  SaleSummary,
  SaleItem,
  SalePaginationInfo,
  OptimisticSaleItemAction,
} from "@/types/sale";
import {
  createSale,
  addSaleItem,
  removeSaleItem,
  updateSaleItemQuantity,
  completeSale,
  cancelSale,
} from "@/app/actions/sale-actions";
import type {
  CompleteSaleInput,
  AddSaleItemInput,
} from "@/lib/validations/sale-schema";
import { Button } from "@/components/ui/button";
import SaleSidebar from "@/components/sales/sale-sidebar";

interface SalesManagementClientProps {
  pendingSales: SaleWithRelations[];
  initialSales: SaleSummary[];
  initialPagination: SalePaginationInfo;
}

export default function SalesManagementClient({
  pendingSales: initialPendingSales,
  initialSales,
  initialPagination,
}: SalesManagementClientProps) {
  const [pendingSales, setPendingSales] = useState<SaleWithRelations[]>(
    initialPendingSales,
  );
  const [selectedSale, setSelectedSale] = useState<SaleWithRelations | null>(
    null,
  );
  const [showSidebar, setShowSidebar] = useState(false);
  const [sales, setSales] = useState<SaleSummary[]>(initialSales);
  const [isPending, startTransition] = useTransition();

  // Optimistic updates for sale items
  const [optimisticItems, addOptimisticItem] = useOptimistic(
    selectedSale?.items || [],
    (state: SaleItem[], action: OptimisticSaleItemAction): SaleItem[] => {
      switch (action.type) {
        case "add": {
          // Create optimistic item
          const tempItem: SaleItem = {
            id: action.tempId,
            saleId: selectedSale?.id || "",
            productVariantId: action.variantId,
            quantity: action.quantity,
            priceAtSale: 0,
            costAtSale: 0,
            variant: {
              id: action.variantId,
              productId: "",
              sku: "...",
              name: null,
              price: 0,
              costPrice: 0,
              imageUrl: null,
              imagePublicId: null,
              displayName: "Cargando...",
              stock: null,
              product: {
                id: "",
                name: "Cargando...",
                description: null,
                categoryId: null,
                imageUrl: null,
                imagePublicId: null,
                active: true,
                createdAt: new Date(),
                updatedAt: new Date(),
                deletedAt: null,
              },
            },
          };
          return [...state, tempItem];
        }

        case "remove": {
          return state.filter((item) => item.id !== action.itemId);
        }

        case "updateQuantity": {
          return state.map((item) =>
            item.id === action.itemId
              ? { ...item, quantity: action.quantity }
              : item,
          );
        }

        default:
          return state;
      }
    },
  );

  // Create new sale
  async function handleCreateSale() {
    startTransition(async () => {
      try {
        const sale = await createSale({});
        setPendingSales((prev) => [sale, ...prev]); // Add to beginning
        setSelectedSale(sale); // Select the new sale
        setShowSidebar(true); // Open sidebar for new sale
      } catch (error) {
        console.error("Error creating sale:", error);
        alert(error instanceof Error ? error.message : "Error al crear venta");
      }
    });
  }

  // Add item to sale
  async function handleAddItem(variantId: string, quantity: number) {
    if (!selectedSale) return;

    startTransition(async () => {
      const tempId = crypto.randomUUID();
      addOptimisticItem({ type: "add", tempId, variantId, quantity });
      try {
        const data: AddSaleItemInput = {
          saleId: selectedSale.id,
          productVariantId: variantId,
          quantity,
        };
        const item = await addSaleItem(data);

        // Update selected sale with new item
        const updatedSale = {
          ...selectedSale,
          items: [...selectedSale.items.filter((i) => i.id !== tempId), item],
        };
        setSelectedSale(updatedSale);

        // Also update in pendingSales array
        setPendingSales((prev) =>
          prev.map((s) => (s.id === selectedSale.id ? updatedSale : s)),
        );
      } catch (error) {
        console.error("Error adding item:", error);
        alert(
          error instanceof Error ? error.message : "Error al agregar producto",
        );
      }
    });
  }

  // Remove item from sale
  async function handleRemoveItem(itemId: string) {
    if (!selectedSale) return;

    startTransition(async () => {
      addOptimisticItem({ type: "remove", itemId });
      try {
        await removeSaleItem(itemId);

        // Update selected sale
        const updatedSale = {
          ...selectedSale,
          items: selectedSale.items.filter((item) => item.id !== itemId),
        };
        setSelectedSale(updatedSale);

        // Also update in pendingSales array
        setPendingSales((prev) =>
          prev.map((s) => (s.id === selectedSale.id ? updatedSale : s)),
        );
      } catch (error) {
        console.error("Error removing item:", error);
        alert(
          error instanceof Error ? error.message : "Error al eliminar producto",
        );
      }
    });
  }

  // Update item quantity
  async function handleUpdateQuantity(itemId: string, quantity: number) {
    if (!selectedSale) return;

    startTransition(async () => {
      addOptimisticItem({ type: "updateQuantity", itemId, quantity });
      try {
        const updatedItem = await updateSaleItemQuantity({
          saleItemId: itemId,
          quantity,
        });

        // Update selected sale
        const updatedSale = {
          ...selectedSale,
          items: selectedSale.items.map((item) =>
            item.id === itemId ? updatedItem : item,
          ),
        };
        setSelectedSale(updatedSale);

        // Also update in pendingSales array
        setPendingSales((prev) =>
          prev.map((s) => (s.id === selectedSale.id ? updatedSale : s)),
        );
      } catch (error) {
        console.error("Error updating quantity:", error);
        alert(
          error instanceof Error
            ? error.message
            : "Error al actualizar cantidad",
        );
      }
    });
  }

  // Complete sale
  async function handleCompleteSale(data: CompleteSaleInput) {
    if (!selectedSale) return;

    startTransition(async () => {
      try {
        const completedSale = await completeSale(data);

        // Add to completed sales list (prevent duplicates)
        setSales((prev) => {
          const exists = prev.some((s) => s.id === completedSale.id);
          if (exists) {
            return prev.map((s) =>
              s.id === completedSale.id
                ? { ...completedSale, itemCount: completedSale.items.length }
                : s,
            );
          }
          return [
            {
              ...completedSale,
              itemCount: completedSale.items.length,
            },
            ...prev,
          ];
        });

        // Remove from pending sales
        setPendingSales((prev) => prev.filter((s) => s.id !== selectedSale.id));
        setSelectedSale(null);
        setShowSidebar(false);

        alert("Venta completada exitosamente");
      } catch (error) {
        console.error("Error completing sale:", error);
        alert(
          error instanceof Error ? error.message : "Error al completar venta",
        );
      }
    });
  }

  // Cancel sale
  async function handleCancelSale() {
    if (!selectedSale) return;

    if (!confirm("¿Estás seguro de cancelar esta venta?")) {
      return;
    }

    startTransition(async () => {
      try {
        await cancelSale(selectedSale.id);
        setPendingSales((prev) => prev.filter((s) => s.id !== selectedSale.id));
        setSelectedSale(null);
        setShowSidebar(false);
      } catch (error) {
        console.error("Error canceling sale:", error);
        alert(
          error instanceof Error ? error.message : "Error al cancelar venta",
        );
      }
    });
  }

  // Select a sale to edit
  function handleSelectSale(sale: SaleWithRelations) {
    setSelectedSale(sale);
    setShowSidebar(true);
  }

  return (
    <div className="space-y-6">
      {/* Header with New Sale button */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            Historial de Ventas
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            {initialPagination.totalCount} venta
            {initialPagination.totalCount !== 1 ? "s" : ""} registrada
            {initialPagination.totalCount !== 1 ? "s" : ""}
          </p>
        </div>
        <Button
          onClick={handleCreateSale}
          disabled={isPending}
          size="lg"
        >
          Nueva Venta
        </Button>
      </div>

      {/* Pending sales cards */}
      {pendingSales.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-900">
              Ventas en Curso ({pendingSales.length})
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pendingSales.map((sale) => (
              <div
                key={sale.id}
                className={`bg-white border rounded-lg p-4 hover:shadow-md transition-shadow ${
                  selectedSale?.id === sale.id
                    ? "border-blue-500 ring-2 ring-blue-200"
                    : "border-gray-200"
                }`}
              >
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      Venta #{sale.id.slice(0, 8)}...
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(sale.createdAt).toLocaleString("es-ES", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </p>
                  </div>
                  {selectedSale?.id === sale.id && (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      Activa
                    </span>
                  )}
                </div>

                <div className="space-y-2 mb-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Productos:</span>
                    <span className="font-medium text-gray-900">
                      {sale.items.length}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Total:</span>
                    <span className="font-medium text-gray-900">
                      $
                      {sale.items
                        .reduce(
                          (sum, item) =>
                            sum + (item.variant?.price || 0) * item.quantity,
                          0,
                        )
                        .toFixed(2)}
                    </span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleSelectSale(sale)}
                    className="flex-1"
                  >
                    {selectedSale?.id === sale.id ? "Continuar" : "Abrir"}
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      setSelectedSale(sale);
                      handleCancelSale();
                    }}
                    disabled={isPending}
                    className="px-3"
                  >
                    ✕
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sales table - placeholder for now */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">
            Ventas recientes
          </h3>
        </div>
        <div className="p-6">
          {sales.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500">No hay ventas registradas</p>
              <p className="text-sm text-gray-400 mt-2">
                Crea tu primera venta con el botón `&quot;`Nueva Venta`&quot;`
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Fecha
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Cliente
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Items
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Estado
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {sales.map((sale) => (
                    <tr key={sale.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(sale.createdAt).toLocaleDateString("es-ES", {
                          year: "numeric",
                          month: "2-digit",
                          day: "2-digit",
                        })}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {sale.customer
                          ? `${sale.customer.firstName} ${sale.customer.lastName}`
                          : "N/A"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {sale.itemCount}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        ${sale.total.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            sale.status === "COMPLETED"
                              ? "bg-green-100 text-green-800"
                              : sale.status === "PENDING"
                                ? "bg-yellow-100 text-yellow-800"
                                : "bg-red-100 text-red-800"
                          }`}
                        >
                          {sale.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Sale Sidebar */}
      {showSidebar && selectedSale && (
        <SaleSidebar
          sale={selectedSale}
          items={optimisticItems}
          onAddItem={handleAddItem}
          onRemoveItem={handleRemoveItem}
          onUpdateQuantity={handleUpdateQuantity}
          onComplete={handleCompleteSale}
          onClose={() => setShowSidebar(false)}
          isPending={isPending}
        />
      )}
    </div>
  );
}
