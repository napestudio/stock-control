"use client";

import { useState, useTransition, useOptimistic } from "react";
import type { ProductCategory } from "@prisma/client";
import type {
  StockWithVariantSerialized,
  StockPaginationInfo,
  StockOptimisticAction,
} from "@/types/stock";
import {
  adjustStock,
  updateMinimumStock,
  getStockList,
} from "@/app/actions/stock-actions";
import StockTable from "@/components/stock/stock-table";
import StockAdjustmentSidebar from "@/components/stock/stock-adjustment-sidebar";
import MinimumStockSidebar from "@/components/stock/minimum-stock-sidebar";
import StockMovementSidebar from "@/components/stock/stock-movement-sidebar";

interface StockManagementClientProps {
  initialStockList: StockWithVariantSerialized[];
  initialPagination: StockPaginationInfo;
  categories: ProductCategory[];
}

export default function StockManagementClient({
  initialStockList,
  initialPagination,
  categories,
}: StockManagementClientProps) {
  const [stockList, setStockList] = useState(initialStockList);
  const [pagination, setPagination] = useState(initialPagination);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [lowStockOnly, setLowStockOnly] = useState(false);

  // Optimistic updates for instant feedback
  const [optimisticStock, addOptimisticUpdate] = useOptimistic(
    stockList,
    (state: StockWithVariantSerialized[], action: StockOptimisticAction) => {
      switch (action.type) {
        case "adjust":
          return state.map((s) =>
            s.productVariantId === action.variantId
              ? {
                  ...s,
                  quantity: action.newQuantity,
                  isLowStock: action.newQuantity <= s.minimumStock,
                }
              : s,
          );
        case "updateMinimum":
          return state.map((s) =>
            s.productVariantId === action.variantId
              ? {
                  ...s,
                  minimumStock: action.newMinimum,
                  isLowStock: s.quantity <= action.newMinimum,
                }
              : s,
          );
        default:
          return state;
      }
    },
  );

  const [isPending, startTransition] = useTransition();

  // Sidebar states
  const [adjustSidebarOpen, setAdjustSidebarOpen] = useState(false);
  const [minimumSidebarOpen, setMinimumSidebarOpen] = useState(false);
  const [movementSidebarOpen, setMovementSidebarOpen] = useState(false);
  const [selectedStock, setSelectedStock] =
    useState<StockWithVariantSerialized | null>(null);

  const [error, setError] = useState("");

  // Refresh stock list
  async function refreshStock() {
    try {
      const result = await getStockList(
        {
          search: searchQuery || undefined,
          categoryId: categoryFilter || undefined,
          lowStockOnly,
        },
        currentPage,
        50,
      );
      setStockList(result.stockList);
      setPagination(result.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar stock");
    }
  }

  // Handle stock adjustment
  async function handleAdjustStock(data: {
    productVariantId: string;
    type: "IN" | "OUT" | "ADJUSTMENT" | "RETURN";
    quantity: number;
    reason?: string;
  }) {
    startTransition(async () => {
      try {
        setError("");

        // Optimistic update
        const currentStock = stockList.find(
          (s) => s.productVariantId === data.productVariantId,
        );
        if (currentStock) {
          let newQuantity = currentStock.quantity;
          switch (data.type) {
            case "IN":
            case "RETURN":
              newQuantity += data.quantity;
              break;
            case "OUT":
              newQuantity -= data.quantity;
              break;
            case "ADJUSTMENT":
              newQuantity = data.quantity;
              break;
          }
          addOptimisticUpdate({
            type: "adjust",
            variantId: data.productVariantId,
            newQuantity,
          });
        }

        await adjustStock(data);
        await refreshStock();
        setAdjustSidebarOpen(false);
        setSelectedStock(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al ajustar stock");
      }
    });
  }

  // Handle minimum stock update
  async function handleUpdateMinimum(data: {
    productVariantId: string;
    minimumStock: number;
  }) {
    startTransition(async () => {
      try {
        setError("");

        addOptimisticUpdate({
          type: "updateMinimum",
          variantId: data.productVariantId,
          newMinimum: data.minimumStock,
        });

        await updateMinimumStock(data);
        await refreshStock();
        setMinimumSidebarOpen(false);
        setSelectedStock(null);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Error al actualizar stock mínimo",
        );
      }
    });
  }

  // Filter handlers
  async function handleSearchChange(query: string) {
    setSearchQuery(query);
    setCurrentPage(1);
    startTransition(async () => {
      try {
        setError("");
        const result = await getStockList(
          {
            search: query || undefined,
            categoryId: categoryFilter || undefined,
            lowStockOnly,
          },
          1,
          50,
        );
        setStockList(result.stockList);
        setPagination(result.pagination);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al buscar");
      }
    });
  }

  async function handleCategoryChange(category: string) {
    setCategoryFilter(category);
    setCurrentPage(1);
    startTransition(async () => {
      try {
        setError("");
        const result = await getStockList(
          {
            search: searchQuery || undefined,
            categoryId: category || undefined,
            lowStockOnly,
          },
          1,
          50,
        );
        setStockList(result.stockList);
        setPagination(result.pagination);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al filtrar");
      }
    });
  }

  async function handleLowStockToggle(checked: boolean) {
    setLowStockOnly(checked);
    setCurrentPage(1);
    startTransition(async () => {
      try {
        setError("");
        const result = await getStockList(
          {
            search: searchQuery || undefined,
            categoryId: categoryFilter || undefined,
            lowStockOnly: checked,
          },
          1,
          50,
        );
        setStockList(result.stockList);
        setPagination(result.pagination);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al filtrar");
      }
    });
  }

  async function handlePageChange(newPage: number) {
    setCurrentPage(newPage);
    startTransition(async () => {
      try {
        setError("");
        const result = await getStockList(
          {
            search: searchQuery || undefined,
            categoryId: categoryFilter || undefined,
            lowStockOnly,
          },
          newPage,
          50,
        );
        setStockList(result.stockList);
        setPagination(result.pagination);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al cargar página");
      }
    });
  }

  return (
    <div className="p-6">
      {/* Filters Section */}
      <div className="mb-6 bg-white rounded-lg shadow p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 items-center gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Buscar
            </label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="SKU, producto, variante..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isPending}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Categoría
            </label>
            <select
              value={categoryFilter}
              onChange={(e) => handleCategoryChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isPending}
            >
              <option value="">Todas las categorías</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={lowStockOnly}
                onChange={(e) => handleLowStockToggle(e.target.checked)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                disabled={isPending}
              />
              <span className="text-sm font-medium text-gray-700">
                Solo stock bajo
              </span>
            </label>
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative">
          <span className="block sm:inline">{error}</span>
          <button
            onClick={() => setError("")}
            className="absolute top-0 bottom-0 right-0 px-4 py-3"
          >
            <span className="text-2xl">&times;</span>
          </button>
        </div>
      )}

      {/* Main Content */}
      <div className="bg-white rounded-lg shadow">
        {optimisticStock.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <p className="text-lg mb-2">No se encontraron productos</p>
            <p className="text-sm">
              Intenta ajustar los filtros o agrega nuevos productos
            </p>
          </div>
        ) : (
          <>
            <StockTable
              stockList={optimisticStock}
              onAdjustStock={(stock) => {
                setSelectedStock(stock);
                setAdjustSidebarOpen(true);
              }}
              onUpdateMinimum={(stock) => {
                setSelectedStock(stock);
                setMinimumSidebarOpen(true);
              }}
              onViewMovements={(stock) => {
                setSelectedStock(stock);
                setMovementSidebarOpen(true);
              }}
            />

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                <div className="text-sm text-gray-700">
                  Mostrando página {pagination.page} de {pagination.totalPages}{" "}
                  ({pagination.totalCount} productos)
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1 || isPending}
                    className="px-3 py-1 border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    Anterior
                  </button>
                  <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={!pagination.hasMore || isPending}
                    className="px-3 py-1 border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    Siguiente
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Sidebars */}
      {adjustSidebarOpen && selectedStock && (
        <StockAdjustmentSidebar
          stock={selectedStock}
          onSubmit={handleAdjustStock}
          onClose={() => {
            setAdjustSidebarOpen(false);
            setSelectedStock(null);
          }}
          isPending={isPending}
        />
      )}

      {minimumSidebarOpen && selectedStock && (
        <MinimumStockSidebar
          stock={selectedStock}
          onSubmit={handleUpdateMinimum}
          onClose={() => {
            setMinimumSidebarOpen(false);
            setSelectedStock(null);
          }}
          isPending={isPending}
        />
      )}

      {movementSidebarOpen && selectedStock && (
        <StockMovementSidebar
          variantId={selectedStock.productVariantId}
          variantName={`${selectedStock.variant.product.name} - ${selectedStock.variant.displayName}`}
          onClose={() => {
            setMovementSidebarOpen(false);
            setSelectedStock(null);
          }}
        />
      )}
    </div>
  );
}
