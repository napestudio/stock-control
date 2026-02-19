"use client";

import { useState, useTransition } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  BarChart,
  Bar,
} from "recharts";
import { getStatistics, getSalesReport } from "@/app/actions/report-actions";
import type {
  StatisticsData,
  SalesReportSummary,
} from "@/types/report";

// ─── Date presets ─────────────────────────────────────────────────────────

type Preset = "7" | "30" | "90" | "custom";

function buildRange(days: number) {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - days);
  return {
    from: from.toISOString().split("T")[0],
    to: to.toISOString().split("T")[0],
  };
}

// ─── KPI card ─────────────────────────────────────────────────────────────

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

// ─── Colours for pie chart ────────────────────────────────────────────────

const PIE_COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];

// ─── Main component ───────────────────────────────────────────────────────

interface StatisticsClientProps {
  initialFrom: string;
  initialTo: string;
  initialStatistics: StatisticsData;
  initialSummary: SalesReportSummary;
}

export default function StatisticsClient({
  initialFrom,
  initialTo,
  initialStatistics,
  initialSummary,
}: StatisticsClientProps) {
  const [preset, setPreset] = useState<Preset>("30");
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);
  const [stats, setStats] = useState(initialStatistics);
  const [summary, setSummary] = useState(initialSummary);
  const [isPending, startTransition] = useTransition();

  function fetchData(newFrom: string, newTo: string) {
    startTransition(async () => {
      const [newStats, newReport] = await Promise.all([
        getStatistics(newFrom, newTo),
        getSalesReport(newFrom, newTo, 1, 1),
      ]);
      setStats(newStats);
      setSummary(newReport.summary);
    });
  }

  function handlePreset(p: Preset) {
    setPreset(p);
    if (p === "custom") return;
    const days = p === "7" ? 7 : p === "30" ? 30 : 90;
    const range = buildRange(days);
    setFrom(range.from);
    setTo(range.to);
    fetchData(range.from, range.to);
  }

  function handleCustomDate(field: "from" | "to", value: string) {
    const newFrom = field === "from" ? value : from;
    const newTo = field === "to" ? value : to;
    if (field === "from") setFrom(value);
    else setTo(value);
    if (newFrom && newTo) fetchData(newFrom, newTo);
  }

  const fmt = (n: number) =>
    n.toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });

  const fmtShort = (n: number) => {
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}k`;
    return `$${n.toFixed(0)}`;
  };

  const hasRevenueData = stats.revenueTimeSeries.length > 0;
  const hasPaymentData = stats.paymentBreakdown.length > 0;
  const hasProductData = stats.topProducts.length > 0;

  return (
    <div className="space-y-6">
      {/* Date range controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {(["7", "30", "90", "custom"] as Preset[]).map((p) => (
            <button
              key={p}
              onClick={() => handlePreset(p)}
              disabled={isPending}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                preset === p
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              {p === "7"
                ? "7 días"
                : p === "30"
                  ? "30 días"
                  : p === "90"
                    ? "90 días"
                    : "Personalizado"}
            </button>
          ))}
        </div>

        {preset === "custom" && (
          <div className="flex items-end gap-2">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500">Desde</label>
              <input
                type="date"
                value={from}
                max={to}
                onChange={(e) => handleCustomDate("from", e.target.value)}
                disabled={isPending}
                className="px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500">Hasta</label>
              <input
                type="date"
                value={to}
                min={from}
                onChange={(e) => handleCustomDate("to", e.target.value)}
                disabled={isPending}
                className="px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
              />
            </div>
          </div>
        )}

        {isPending && (
          <span className="text-sm text-gray-400">Actualizando...</span>
        )}
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard label="Facturado" value={fmt(summary.totalRevenue)} />
        <KpiCard label="Costo" value={fmt(summary.totalCost)} />
        <KpiCard label="Ganancia bruta" value={fmt(summary.grossProfit)} highlight />
        <KpiCard label="Ventas" value={String(summary.saleCount)} />
      </div>

      {/* Revenue line chart + payment methods donut */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue line chart — 2/3 width */}
        <div className="lg:col-span-2 bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">
            Evolución de ventas
          </h3>
          {hasRevenueData ? (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart
                data={stats.revenueTimeSeries}
                margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(d: string) =>
                    new Date(d + "T12:00:00").toLocaleDateString("es-AR", {
                      day: "numeric",
                      month: "short",
                    })
                  }
                  tick={{ fontSize: 11 }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tickFormatter={fmtShort}
                  tick={{ fontSize: 11 }}
                  width={56}
                />
                <Tooltip
                  formatter={(value) =>
                    typeof value === "number" ? [fmt(value), "Facturado"] : [value, "Facturado"]
                  }
                  labelFormatter={(label) => {
                    const str = String(label);
                    return new Date(str + "T12:00:00").toLocaleDateString("es-AR", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                    });
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke="#6366f1"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState message="Sin ventas en el período seleccionado." />
          )}
        </div>

        {/* Payment methods donut — 1/3 width */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">
            Métodos de pago
          </h3>
          {hasPaymentData ? (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={stats.paymentBreakdown}
                  dataKey="total"
                  nameKey="label"
                  cx="50%"
                  cy="45%"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={2}
                >
                  {stats.paymentBreakdown.map((_, index) => (
                    <Cell
                      key={index}
                      fill={PIE_COLORS[index % PIE_COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) =>
                    typeof value === "number" ? [fmt(value), "Total"] : [value, "Total"]
                  }
                />
                <Legend
                  iconType="circle"
                  iconSize={8}
                  formatter={(value) => (
                    <span className="text-xs text-gray-600">{value}</span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState message="Sin datos de pago." />
          )}
        </div>
      </div>

      {/* Top 5 products horizontal bar */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">
          Top 5 productos por facturación
        </h3>
        {hasProductData ? (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart
              layout="vertical"
              data={stats.topProducts}
              margin={{ top: 0, right: 40, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
              <XAxis
                type="number"
                tickFormatter={fmtShort}
                tick={{ fontSize: 11 }}
              />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fontSize: 11 }}
                width={120}
              />
              <Tooltip
                formatter={(value, _name, props) => {
                  const revenue = typeof value === "number" ? fmt(value) : String(value);
                  const units = (props.payload as { unitsSold?: number }).unitsSold ?? 0;
                  return [revenue, `${units} unidades`];
                }}
              />
              <Bar dataKey="revenue" fill="#6366f1" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <EmptyState message="Sin productos vendidos en el período seleccionado." />
        )}
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center h-40 text-sm text-gray-400">
      {message}
    </div>
  );
}
