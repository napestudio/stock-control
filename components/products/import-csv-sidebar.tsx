"use client";

import { importProductsFromCSV } from "@/app/actions/product-import-actions";
import Badge from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Sidebar from "@/components/ui/sidebar";
import type { CSVProductRow, ImportResult } from "@/lib/validations/product-import-schema";
import { csvProductRowSchema } from "@/lib/validations/product-import-schema";
import Papa from "papaparse";
import { useRef, useState, useTransition } from "react";

interface ImportCSVSidebarProps {
  onClose: () => void;
  onImportComplete: () => void;
}

type Step = "upload" | "preview" | "results";

type PreviewRow = {
  row: number;
  name: string;
  rawQuantity: string;
  rawPrice: string;
  data?: CSVProductRow;
  error?: string;
};

/**
 * Parse Argentine price format: "$50.000" → 50000
 * Removes $, spaces, and dots (used as thousands separator in Argentina)
 */
function parseArgentineNumber(value: string): number {
  const cleaned = value
    .replace(/\$/g, "")
    .replace(/\s/g, "")
    .replace(/\./g, "")
    .replace(/,/g, "");
  return parseInt(cleaned, 10);
}

/**
 * Find the index of a column in a header row, case-insensitively.
 */
function findColIndex(headerRow: string[], ...keys: string[]): number {
  for (const key of keys) {
    const idx = headerRow.findIndex(
      (h) => h.trim().toLowerCase() === key.toLowerCase()
    );
    if (idx !== -1) return idx;
  }
  return -1;
}

/**
 * Format a number as Argentine currency display.
 */
function formatPrice(value: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(value);
}

export default function ImportCSVSidebar({
  onClose,
  onImportComplete,
}: ImportCSVSidebarProps) {
  const [step, setStep] = useState<Step>("upload");
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [parseError, setParseError] = useState<string>("");
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validRows = previewRows.filter((r) => r.data !== undefined);
  const invalidRows = previewRows.filter((r) => r.error !== undefined);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setParseError("");

    Papa.parse<string[]>(file, {
      header: false,
      skipEmptyLines: true,
      complete: (results) => {
        const rawRows = results.data;

        if (rawRows.length === 0) {
          setParseError("El archivo está vacío o no tiene filas de datos.");
          return;
        }

        // Find the header row — the first row that contains "PRENDA"
        const headerRowIndex = rawRows.findIndex((row) =>
          row.some((cell) => cell.trim().toLowerCase() === "prenda")
        );

        if (headerRowIndex === -1) {
          setParseError(
            "No se encontró la fila de encabezados. Asegurate de que el archivo tenga una columna llamada 'PRENDA'."
          );
          return;
        }

        const headerRow = rawRows[headerRowIndex];

        const nameColIdx = findColIndex(headerRow, "prenda", "nombre", "name");
        const qtyColIdx = findColIndex(headerRow, "cantidad", "qty", "quantity", "stock");
        const priceColIdx = findColIndex(
          headerRow,
          "precio unidad",
          "precio",
          "price",
          "precio_unidad"
        );

        if (nameColIdx === -1 || qtyColIdx === -1 || priceColIdx === -1) {
          setParseError(
            `Columnas requeridas no encontradas. Encabezados detectados: ${headerRow.join(", ")}`
          );
          return;
        }

        // Only process rows after the header, skip empty names and footer rows (e.g. "TOTAL")
        const dataRows = rawRows.slice(headerRowIndex + 1).filter((row) => {
          const name = row[nameColIdx]?.trim();
          return name && name.toLowerCase() !== "total";
        });

        if (dataRows.length === 0) {
          setParseError("No se encontraron filas de datos después del encabezado.");
          return;
        }

        const rows: PreviewRow[] = dataRows.map((row, idx) => {
          const rowNumber = idx + 1;
          const rawName = row[nameColIdx]?.trim() ?? "";
          const rawQty = row[qtyColIdx]?.trim() ?? "";
          const rawPrice = row[priceColIdx]?.trim() ?? "";

          const quantity = parseArgentineNumber(rawQty);
          const price = parseArgentineNumber(rawPrice);

          const parsed = csvProductRowSchema.safeParse({
            name: rawName,
            quantity: isNaN(quantity) ? -1 : quantity,
            price: isNaN(price) ? -1 : price,
          });

          if (!parsed.success) {
            const firstError = parsed.error.issues[0];
            return {
              row: rowNumber,
              name: rawName || "(vacío)",
              rawQuantity: rawQty,
              rawPrice: rawPrice,
              error: firstError?.message ?? "Fila inválida",
            };
          }

          return {
            row: rowNumber,
            name: rawName,
            rawQuantity: rawQty,
            rawPrice: rawPrice,
            data: parsed.data,
          };
        });

        setPreviewRows(rows);
        setStep("preview");
      },
      error: (err) => {
        setParseError(`Error al leer el archivo: ${err.message}`);
      },
    });

    // Reset input so the same file can be re-selected
    e.target.value = "";
  }

  function handleImport() {
    const rowsToImport = validRows
      .map((r) => r.data)
      .filter((d): d is CSVProductRow => d !== undefined);

    startTransition(async () => {
      try {
        const result = await importProductsFromCSV(rowsToImport);
        setImportResult(result);
        setStep("results");
      } catch (err) {
        setParseError(
          err instanceof Error ? err.message : "Error al importar productos"
        );
      }
    });
  }

  function handleClose() {
    if (step === "results" && importResult && importResult.created > 0) {
      onImportComplete();
    }
    onClose();
  }

  return (
    <Sidebar isOpen onClose={handleClose} title="Importar productos desde CSV" size="lg">
      {/* STEP 1: Upload */}
      {step === "upload" && (
        <div className="space-y-6">
          <div className="text-sm text-gray-600 space-y-2">
            <p>
              Subí un archivo CSV o TSV con el inventario. Se esperan las
              siguientes columnas:
            </p>
            <ul className="list-disc list-inside space-y-1 text-gray-500">
              <li>
                <span className="font-medium text-gray-700">PRENDA</span> —
                nombre del producto
              </li>
              <li>
                <span className="font-medium text-gray-700">CANTIDAD</span> —
                stock inicial
              </li>
              <li>
                <span className="font-medium text-gray-700">PRECIO UNIDAD</span>{" "}
                — precio de venta (formato: $50.000)
              </li>
            </ul>
            <p className="text-gray-400 text-xs">
              Las columnas TOTAL y otras adicionales serán ignoradas.
            </p>
          </div>

          <div
            className="border-2 border-dashed border-gray-300 rounded-xl p-10 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="flex flex-col items-center gap-3">
              <svg
                className="w-12 h-12 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              <div>
                <p className="text-sm font-medium text-gray-700">
                  Hacé clic para seleccionar el archivo
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  CSV o TSV (separado por comas o tabulaciones)
                </p>
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.tsv,.txt"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          {parseError && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
              {parseError}
            </div>
          )}
        </div>
      )}

      {/* STEP 2: Preview */}
      {step === "preview" && (
        <div className="space-y-4">
          {/* Summary */}
          <div className="flex gap-3 flex-wrap">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-800">
              <span className="w-2 h-2 rounded-full bg-green-500" />
              {validRows.length} listas para importar
            </span>
            {invalidRows.length > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-3 py-1 text-sm font-medium text-red-800">
                <span className="w-2 h-2 rounded-full bg-red-500" />
                {invalidRows.length} con errores (serán omitidas)
              </span>
            )}
          </div>

          {/* Preview table */}
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="overflow-y-auto max-h-96">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-gray-600 w-6">
                      #
                    </th>
                    <th className="px-3 py-2 text-left font-medium text-gray-600">
                      Nombre
                    </th>
                    <th className="px-3 py-2 text-right font-medium text-gray-600 w-20">
                      Stock
                    </th>
                    <th className="px-3 py-2 text-right font-medium text-gray-600 w-28">
                      Precio
                    </th>
                    <th className="px-3 py-2 text-center font-medium text-gray-600 w-20">
                      Estado
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {previewRows.map((row) => (
                    <tr
                      key={row.row}
                      className={row.error ? "bg-red-50" : "bg-white"}
                    >
                      <td className="px-3 py-2 text-gray-400 text-xs">
                        {row.row}
                      </td>
                      <td className="px-3 py-2 text-gray-800 font-medium">
                        {row.name}
                        {row.error && (
                          <span className="block text-xs text-red-600 font-normal">
                            {row.error}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right text-gray-600">
                        {row.data ? row.data.quantity : row.rawQuantity}
                      </td>
                      <td className="px-3 py-2 text-right text-gray-600">
                        {row.data ? formatPrice(row.data.price) : row.rawPrice}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {row.data ? (
                          <Badge variant="success">OK</Badge>
                        ) : (
                          <Badge variant="error">Error</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {parseError && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
              {parseError}
            </div>
          )}

          <div className="flex justify-between gap-3 pt-2">
            <Button
              variant="outline"
              onClick={() => {
                setStep("upload");
                setPreviewRows([]);
                setParseError("");
              }}
            >
              Volver
            </Button>
            <Button
              onClick={handleImport}
              disabled={isPending || validRows.length === 0}
            >
              {isPending
                ? "Importando..."
                : `Importar ${validRows.length} producto${validRows.length !== 1 ? "s" : ""}`}
            </Button>
          </div>
        </div>
      )}

      {/* STEP 3: Results */}
      {step === "results" && importResult && (
        <div className="space-y-5">
          <div className="space-y-3">
            {importResult.created > 0 && (
              <div className="flex items-center gap-3 rounded-lg bg-green-50 border border-green-200 p-4">
                <svg
                  className="w-5 h-5 text-green-600 shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                <p className="text-sm font-medium text-green-800">
                  {importResult.created} producto
                  {importResult.created !== 1 ? "s" : ""} importado
                  {importResult.created !== 1 ? "s" : ""} exitosamente
                </p>
              </div>
            )}

            {importResult.skipped > 0 && (
              <div className="flex items-center gap-3 rounded-lg bg-yellow-50 border border-yellow-200 p-4">
                <svg
                  className="w-5 h-5 text-yellow-600 shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <p className="text-sm font-medium text-yellow-800">
                  {importResult.skipped} producto
                  {importResult.skipped !== 1 ? "s" : ""} omitido
                  {importResult.skipped !== 1 ? "s" : ""} (ya existían)
                </p>
              </div>
            )}

            {importResult.errors.filter((e) => e.message !== "El producto ya existe").length > 0 && (
              <div className="rounded-lg bg-red-50 border border-red-200 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <svg
                    className="w-5 h-5 text-red-600 shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                  <p className="text-sm font-medium text-red-800">
                    {importResult.errors.filter((e) => e.message !== "El producto ya existe").length}{" "}
                    error
                    {importResult.errors.filter((e) => e.message !== "El producto ya existe").length !== 1
                      ? "es"
                      : ""}{" "}
                    al importar
                  </p>
                </div>
                <ul className="space-y-1 text-sm text-red-700">
                  {importResult.errors
                    .filter((e) => e.message !== "El producto ya existe")
                    .map((err) => (
                      <li key={`${err.row}-${err.name}`} className="text-xs">
                        Fila {err.row} — <span className="font-medium">{err.name}</span>:{" "}
                        {err.message}
                      </li>
                    ))}
                </ul>
              </div>
            )}
          </div>

          <div className="flex justify-end pt-2">
            <Button onClick={handleClose}>Cerrar</Button>
          </div>
        </div>
      )}
    </Sidebar>
  );
}
