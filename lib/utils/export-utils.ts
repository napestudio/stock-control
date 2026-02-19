import type { SalesReportRow, StockReportRow } from "@/types/report";

function triggerCsvDownload(csvContent: string, filename: string): void {
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function buildCsv(headers: string[], rows: string[][]): string {
  return [
    headers.join(","),
    ...rows.map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","),
    ),
  ].join("\n");
}

/**
 * Export sales report rows to CSV format
 */
export function exportSalesToCSV(rows: SalesReportRow[], filename: string): void {
  const headers = ["Fecha", "Cliente", "Artículos", "Método de Pago", "Total", "Estado"];
  const csvRows = rows.map((r) => [
    new Date(r.date).toLocaleString("es-AR"),
    r.customer,
    String(r.itemCount),
    r.paymentMethod,
    r.total.toFixed(2),
    r.status,
  ]);
  triggerCsvDownload(buildCsv(headers, csvRows), filename);
}

/**
 * Export stock movement report rows to CSV format
 */
export function exportStockMovementsToCSV(rows: StockReportRow[], filename: string): void {
  const headers = ["Fecha", "Producto", "SKU", "Tipo", "Cantidad", "Razón"];
  const csvRows = rows.map((r) => [
    new Date(r.date).toLocaleString("es-AR"),
    r.product,
    r.sku,
    r.type,
    String(r.quantity),
    r.reason,
  ]);
  triggerCsvDownload(buildCsv(headers, csvRows), filename);
}

/**
 * Export cash movements to CSV format
 */
export function exportMovementsToCSV(
  movements: Array<{
    createdAt: string;
    type: string;
    paymentMethod: string;
    amount: number;
    description: string | null;
    session: {
      cashRegister: { name: string };
      user: { name: string | null; email: string };
    };
  }>,
  filename: string
): void {
  // Convert to CSV format
  const headers = [
    "Fecha",
    "Tipo",
    "Método de Pago",
    "Monto",
    "Caja",
    "Usuario",
    "Descripción",
  ];

  const rows = movements.map((m) => [
    new Date(m.createdAt).toLocaleString("es-AR"),
    m.type,
    m.paymentMethod,
    m.amount.toFixed(2),
    m.session.cashRegister.name,
    m.session.user.name || m.session.user.email,
    m.description || "",
  ]);

  triggerCsvDownload(buildCsv(headers, rows), filename);
}
