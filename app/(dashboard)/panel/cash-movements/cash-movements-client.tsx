"use client";

import { useState } from "react";
import { getCashMovementsHistory } from "@/app/actions/cash-session-actions";
import { Button } from "@/components/ui/button";
import { PaymentMethod, CashMovementType } from "@prisma/client";
import { exportMovementsToCSV } from "@/lib/utils/export-utils";
import MovementsHistoryTable from "@/components/cash-registers/movements-history-table";
import type { CashRegister } from "@prisma/client";

type Movement = Awaited<
  ReturnType<typeof getCashMovementsHistory>
>["movements"][0];
type Pagination = Awaited<
  ReturnType<typeof getCashMovementsHistory>
>["pagination"];
type Summary = Awaited<ReturnType<typeof getCashMovementsHistory>>["summary"];

interface Props {
  initialMovements: Movement[];
  initialPagination: Pagination;
  initialSummary: Summary;
  cashRegisters: CashRegister[];
}

export default function CashMovementsClient({
  initialMovements,
  initialPagination,
  initialSummary,
  cashRegisters,
}: Props) {
  const [movements, setMovements] = useState(initialMovements);
  const [pagination, setPagination] = useState(initialPagination);
  const [summary, setSummary] = useState(initialSummary);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [filtersExpanded, setFiltersExpanded] = useState(false); // Default collapsed

  // Filter state
  const [filters, setFilters] = useState({
    dateFrom: "",
    dateTo: "",
    cashRegisterId: "",
    userId: "",
    paymentMethod: "",
    movementType: "",
    searchQuery: "",
  });

  async function refreshMovements() {
    setLoading(true);
    try {
      const result = await getCashMovementsHistory(
        {
          dateFrom: filters.dateFrom ? new Date(filters.dateFrom) : undefined,
          dateTo: filters.dateTo ? new Date(filters.dateTo) : undefined,
          cashRegisterId: filters.cashRegisterId || undefined,
          userId: filters.userId || undefined,
          paymentMethod: (filters.paymentMethod as PaymentMethod) || undefined,
          movementType:
            (filters.movementType as CashMovementType) || undefined,
          searchQuery: filters.searchQuery || undefined,
        },
        currentPage,
        50
      );
      setMovements(result.movements);
      setPagination(result.pagination);
      setSummary(result.summary);
    } finally {
      setLoading(false);
    }
  }

  function handleFilterChange(key: string, value: string) {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setCurrentPage(1); // Reset to page 1 on filter change
  }

  function handleApplyFilters() {
    refreshMovements();
  }

  function handleClearFilters() {
    setFilters({
      dateFrom: "",
      dateTo: "",
      cashRegisterId: "",
      userId: "",
      paymentMethod: "",
      movementType: "",
      searchQuery: "",
    });
    setCurrentPage(1);
    setTimeout(refreshMovements, 0);
  }

  function handleExport() {
    exportMovementsToCSV(movements, "movimientos-caja.csv");
  }

  function handlePrevPage() {
    if (currentPage > 1) {
      setCurrentPage((p) => p - 1);
      setTimeout(refreshMovements, 0);
    }
  }

  function handleNextPage() {
    if (pagination.hasMore) {
      setCurrentPage((p) => p + 1);
      setTimeout(refreshMovements, 0);
    }
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="bg-white p-4 rounded-lg border shadow-sm">
          <div className="text-sm font-medium text-gray-600 mb-1">
            Total Movimientos
          </div>
          <div className="text-2xl font-bold text-gray-900">
            {summary.totalCount}
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg border shadow-sm">
          <div className="text-sm font-medium text-gray-600 mb-1">
            Monto Total
          </div>
          <div className="text-2xl font-bold text-gray-900">
            ${summary.totalAmount.toFixed(2)}
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg border shadow-sm">
          <div className="text-sm font-medium text-gray-600 mb-1">
            Promedio por Movimiento
          </div>
          <div className="text-2xl font-bold text-gray-900">
            $
            {summary.totalCount > 0
              ? (summary.totalAmount / summary.totalCount).toFixed(2)
              : "0.00"}
          </div>
        </div>
      </div>

      {/* Filters - Collapsible */}
      <div className="bg-white rounded-lg border shadow-sm">
        {/* Collapsible header - clickable to toggle */}
        <button
          type="button"
          onClick={() => setFiltersExpanded(!filtersExpanded)}
          className="w-full flex items-center justify-between p-6 hover:bg-gray-50 transition-colors"
        >
          <h3 className="font-semibold text-lg text-gray-900">Filtros</h3>
          <svg
            className={`w-5 h-5 text-gray-500 transition-transform duration-200 ${
              filtersExpanded ? "rotate-180" : ""
            }`}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* Conditionally rendered content */}
        {filtersExpanded && (
          <div className="px-6 pb-6 space-y-4 border-t">
            <div className="grid gap-4 md:grid-cols-4 pt-4">
              {/* Date From */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Desde
                </label>
                <input
                  type="date"
                  value={filters.dateFrom}
                  onChange={(e) => handleFilterChange("dateFrom", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              {/* Date To */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Hasta
                </label>
                <input
                  type="date"
                  value={filters.dateTo}
                  onChange={(e) => handleFilterChange("dateTo", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              {/* Cash Register */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Caja
                </label>
                <select
                  value={filters.cashRegisterId}
                  onChange={(e) =>
                    handleFilterChange("cashRegisterId", e.target.value)
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="">Todas</option>
                  {cashRegisters.map((register) => (
                    <option key={register.id} value={register.id}>
                      {register.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Payment Method */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Método de Pago
                </label>
                <select
                  value={filters.paymentMethod}
                  onChange={(e) =>
                    handleFilterChange("paymentMethod", e.target.value)
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="">Todos</option>
                  <option value="CASH">Efectivo</option>
                  <option value="CREDIT_CARD">Tarjeta de Crédito</option>
                  <option value="DEBIT_CARD">Tarjeta de Débito</option>
                  <option value="TRANSFER">Transferencia</option>
                  <option value="CHECK">Cheque</option>
                  <option value="OTHER">Otro</option>
                </select>
              </div>

              {/* Movement Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tipo de Movimiento
                </label>
                <select
                  value={filters.movementType}
                  onChange={(e) =>
                    handleFilterChange("movementType", e.target.value)
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="">Todos</option>
                  <option value="OPENING">Apertura</option>
                  <option value="DEPOSIT">Depósito</option>
                  <option value="WITHDRAWAL">Retiro</option>
                  <option value="EXPENSE">Gasto</option>
                  <option value="REFUND">Reembolso</option>
                  <option value="ADJUSTMENT">Ajuste</option>
                  <option value="CLOSING">Cierre</option>
                </select>
              </div>

              {/* Search */}
              <div className="md:col-span-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Buscar en Descripción
                </label>
                <input
                  type="text"
                  value={filters.searchQuery}
                  onChange={(e) =>
                    handleFilterChange("searchQuery", e.target.value)
                  }
                  placeholder="Buscar por descripción..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <Button onClick={handleApplyFilters} disabled={loading}>
                {loading ? "Cargando..." : "Aplicar Filtros"}
              </Button>
              <Button variant="outline" onClick={handleClearFilters}>
                Limpiar Filtros
              </Button>
              <Button variant="outline" onClick={handleExport} className="ml-auto">
                Exportar CSV
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Table */}
      <MovementsHistoryTable movements={movements} loading={loading} />

      {/* Pagination */}
      <div className="flex justify-between items-center bg-white p-4 rounded-lg border shadow-sm">
        <Button
          variant="outline"
          onClick={handlePrevPage}
          disabled={currentPage === 1 || loading}
        >
          Anterior
        </Button>

        <span className="text-sm text-gray-600">
          Página {currentPage} de {pagination.totalPages} (
          {pagination.totalCount} movimientos)
        </span>

        <Button
          variant="outline"
          onClick={handleNextPage}
          disabled={!pagination.hasMore || loading}
        >
          Siguiente
        </Button>
      </div>
    </div>
  );
}
