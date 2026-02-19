"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  getSalesReport,
  getStockMovementsReport,
  exportSalesReport,
  exportStockMovementsReport,
} from "@/app/actions/report-actions";
import {
  exportSalesToCSV,
  exportStockMovementsToCSV,
} from "@/lib/utils/export-utils";
import type {
  SalesReportResult,
  StockReportResult,
  SalesReportSummary,
  StockReportSummary,
} from "@/types/report";

type Tab = "sales" | "stock";

interface ReportsClientProps {
  initialFrom: string;
  initialTo: string;
  initialSalesReport: SalesReportResult;
  initialStockReport: StockReportResult;
}

// ─── KPI Card ─────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">
        {label}
      </p>
      <p
        className={`mt-1 text-2xl font-bold ${highlight ? "text-green-600" : "text-gray-900"}`}
      >
        {value}
      </p>
    </div>
  );
}

// ─── Sales KPIs ───────────────────────────────────────────────────────────

function SalesKpis({ summary }: { summary: SalesReportSummary }) {
  const fmt = (n: number) =>
    n.toLocaleString("es-AR", { style: "currency", currency: "ARS" });

  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
      <KpiCard label="Facturado" value={fmt(summary.totalRevenue)} />
      <KpiCard label="Costo" value={fmt(summary.totalCost)} />
      <KpiCard
        label="Ganancia bruta"
        value={fmt(summary.grossProfit)}
        highlight
      />
      <KpiCard label="Cantidad de ventas" value={String(summary.saleCount)} />
      <KpiCard label="Ticket promedio" value={fmt(summary.averageTicket)} />
    </div>
  );
}

// ─── Stock KPIs ───────────────────────────────────────────────────────────

function StockKpis({ summary }: { summary: StockReportSummary }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <KpiCard label="Entradas" value={`+${summary.totalIn}`} highlight />
      <KpiCard label="Salidas" value={`−${summary.totalOut}`} />
      <KpiCard label="Ajustes / Devol." value={String(summary.totalAdjustments)} />
      <KpiCard
        label="Balance neto"
        value={`${summary.netBalance >= 0 ? "+" : ""}${summary.netBalance}`}
        highlight={summary.netBalance >= 0}
      />
    </div>
  );
}

// ─── Pagination ───────────────────────────────────────────────────────────

function Pagination({
  page,
  totalPages,
  total,
  pageSize,
  onPage,
  isPending,
}: {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  onPage: (p: number) => void;
  isPending: boolean;
}) {
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="flex items-center justify-between mt-4 text-sm text-gray-600">
      <span>
        {total === 0
          ? "Sin resultados"
          : `Mostrando ${from}–${to} de ${total}`}
      </span>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPage(page - 1)}
          disabled={page <= 1 || isPending}
        >
          ← Anterior
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPage(page + 1)}
          disabled={page >= totalPages || isPending}
        >
          Siguiente →
        </Button>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────

export default function ReportsClient({
  initialFrom,
  initialTo,
  initialSalesReport,
  initialStockReport,
}: ReportsClientProps) {
  const [tab, setTab] = useState<Tab>("sales");
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);

  const [salesReport, setSalesReport] = useState(initialSalesReport);
  const [stockReport, setStockReport] = useState(initialStockReport);

  const [isPending, startTransition] = useTransition();
  const [isExporting, startExport] = useTransition();

  function fetchCurrentTab(newFrom: string, newTo: string, page = 1) {
    startTransition(async () => {
      if (tab === "sales") {
        const result = await getSalesReport(newFrom, newTo, page);
        setSalesReport(result);
      } else {
        const result = await getStockMovementsReport(newFrom, newTo, page);
        setStockReport(result);
      }
    });
  }

  function handleFromChange(value: string) {
    setFrom(value);
    if (value && to) fetchCurrentTab(value, to);
  }

  function handleToChange(value: string) {
    setTo(value);
    if (from && value) fetchCurrentTab(from, value);
  }

  function handleTabChange(newTab: Tab) {
    setTab(newTab);
    // Fetch the other tab's data if not already triggered by the user
    startTransition(async () => {
      if (newTab === "sales") {
        const result = await getSalesReport(from, to, 1);
        setSalesReport(result);
      } else {
        const result = await getStockMovementsReport(from, to, 1);
        setStockReport(result);
      }
    });
  }

  function handlePage(page: number) {
    fetchCurrentTab(from, to, page);
  }

  function handleExport() {
    const today = new Date().toISOString().split("T")[0];
    startExport(async () => {
      if (tab === "sales") {
        const rows = await exportSalesReport(from, to);
        exportSalesToCSV(rows, `ventas-${from}-${today}.csv`);
      } else {
        const rows = await exportStockMovementsReport(from, to);
        exportStockMovementsToCSV(rows, `inventario-${from}-${today}.csv`);
      }
    });
  }

  const currentPagination =
    tab === "sales" ? salesReport.pagination : stockReport.pagination;

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        {(["sales", "stock"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => handleTabChange(t)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              tab === t
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            {t === "sales" ? "Ventas" : "Inventario"}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600">Desde</label>
            <input
              type="date"
              value={from}
              max={to}
              onChange={(e) => handleFromChange(e.target.value)}
              disabled={isPending}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600">Hasta</label>
            <input
              type="date"
              value={to}
              min={from}
              onChange={(e) => handleToChange(e.target.value)}
              disabled={isPending}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
            />
          </div>
          <Button
            variant="outline"
            onClick={handleExport}
            disabled={isExporting || isPending}
          >
            {isExporting ? "Exportando..." : "Exportar CSV"}
          </Button>
        </div>
      </div>

      {/* KPIs */}
      {tab === "sales" ? (
        <SalesKpis summary={salesReport.summary} />
      ) : (
        <StockKpis summary={stockReport.summary} />
      )}

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {isPending ? (
          <div className="flex items-center justify-center py-16 text-sm text-gray-500">
            Cargando...
          </div>
        ) : tab === "sales" ? (
          <SalesTable rows={salesReport.rows} />
        ) : (
          <StockTable rows={stockReport.rows} />
        )}
      </div>

      {/* Pagination */}
      <Pagination
        page={currentPagination.page}
        totalPages={currentPagination.totalPages}
        total={currentPagination.total}
        pageSize={currentPagination.pageSize}
        onPage={handlePage}
        isPending={isPending}
      />
    </div>
  );
}

// ─── Sales table ──────────────────────────────────────────────────────────

function SalesTable({
  rows,
}: {
  rows: SalesReportResult["rows"];
}) {
  if (rows.length === 0) {
    return (
      <div className="text-center py-12 text-sm text-gray-500">
        No hay ventas en el período seleccionado.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50">
          <tr>
            {["#", "Fecha", "Cliente", "Artículos", "Pago", "Total", "Estado"].map(
              (h) => (
                <th
                  key={h}
                  className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide"
                >
                  {h}
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((row) => (
            <tr key={row.id} className="hover:bg-gray-50 transition-colors">
              <td className="px-4 py-3 font-mono text-gray-500 text-xs">
                {row.id}
              </td>
              <td className="px-4 py-3 text-gray-700">
                {new Date(row.date).toLocaleDateString("es-AR")}
              </td>
              <td className="px-4 py-3 text-gray-900">{row.customer}</td>
              <td className="px-4 py-3 text-gray-700 text-center">
                {row.itemCount}
              </td>
              <td className="px-4 py-3 text-gray-700">{row.paymentMethod}</td>
              <td className="px-4 py-3 font-semibold text-gray-900">
                {row.total.toLocaleString("es-AR", {
                  style: "currency",
                  currency: "ARS",
                })}
              </td>
              <td className="px-4 py-3">
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                    row.status === "Completada"
                      ? "bg-green-100 text-green-800"
                      : "bg-red-100 text-red-800"
                  }`}
                >
                  {row.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Stock table ──────────────────────────────────────────────────────────

function StockTable({
  rows,
}: {
  rows: StockReportResult["rows"];
}) {
  if (rows.length === 0) {
    return (
      <div className="text-center py-12 text-sm text-gray-500">
        No hay movimientos en el período seleccionado.
      </div>
    );
  }

  const typeColors: Record<string, string> = {
    Entrada: "bg-green-100 text-green-800",
    Salida: "bg-red-100 text-red-800",
    Ajuste: "bg-yellow-100 text-yellow-800",
    Devolución: "bg-blue-100 text-blue-800",
  };

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50">
          <tr>
            {["Fecha", "Producto", "SKU", "Tipo", "Cantidad", "Razón"].map(
              (h) => (
                <th
                  key={h}
                  className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide"
                >
                  {h}
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((row) => (
            <tr key={row.id} className="hover:bg-gray-50 transition-colors">
              <td className="px-4 py-3 text-gray-700">
                {new Date(row.date).toLocaleDateString("es-AR")}
              </td>
              <td className="px-4 py-3 text-gray-900 font-medium">
                {row.product}
              </td>
              <td className="px-4 py-3 font-mono text-gray-500 text-xs">
                {row.sku}
              </td>
              <td className="px-4 py-3">
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                    typeColors[row.type] ?? "bg-gray-100 text-gray-800"
                  }`}
                >
                  {row.type}
                </span>
              </td>
              <td className="px-4 py-3 font-semibold text-gray-900">
                {row.quantity}
              </td>
              <td className="px-4 py-3 text-gray-600 text-xs">{row.reason}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
