"use client";

import Badge from "@/components/ui/badge";
import TrashIcon from "@/components/icons/TrashIcon";
import type { PrinterSerialized } from "@/types/printer";
import { PrinterConnectionType, PaperWidth } from "@prisma/client";

interface PrinterTableProps {
  printers: PrinterSerialized[];
  onEdit: (printer: PrinterSerialized) => void;
  onDelete: (printer: PrinterSerialized) => void;
}

export default function PrinterTable({
  printers,
  onEdit,
  onDelete,
}: PrinterTableProps) {
  if (printers.length === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-lg shadow">
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
            d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
          />
        </svg>
        <h3 className="mt-2 text-sm font-medium text-gray-900">
          No hay impresoras configuradas
        </h3>
        <p className="mt-1 text-sm text-gray-500">
          Si tu negocio usa impresoras térmicas, podés agregar una haciendo clic
          en &quot;Nueva Impresora&quot;.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white shadow rounded-lg overflow-hidden">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Nombre
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Tipo
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Dirección / Sistema
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Papel
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Auto-imprimir
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Caja
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Estado
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Acciones
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {printers.map((printer) => (
            <tr
              key={printer.id}
              onClick={() => onEdit(printer)}
              className="hover:bg-gray-50 cursor-pointer"
            >
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm font-medium text-gray-900">
                  {printer.name}
                </div>
                {printer.model && (
                  <div className="text-xs text-gray-500">{printer.model}</div>
                )}
              </td>

              <td className="px-6 py-4 whitespace-nowrap">
                {printer.connectionType === PrinterConnectionType.TCP_IP ? (
                  <Badge variant="neutral">TCP/IP</Badge>
                ) : (
                  <Badge variant="neutral">USB/Serial</Badge>
                )}
              </td>

              <td className="px-6 py-4 whitespace-nowrap">
                <span className="text-sm text-gray-700 font-mono">
                  {printer.connectionType === PrinterConnectionType.TCP_IP
                    ? (printer.ipAddress ?? "—")
                    : (printer.systemPrinterName ?? "—")}
                </span>
              </td>

              <td className="px-6 py-4 whitespace-nowrap">
                <span className="text-sm text-gray-700">
                  {printer.paperWidth === PaperWidth.MM80 ? "80mm" : "58mm"}
                </span>
              </td>

              <td className="px-6 py-4 whitespace-nowrap">
                {printer.autoPrint ? (
                  <Badge variant="success">Sí</Badge>
                ) : (
                  <Badge variant="neutral">No</Badge>
                )}
              </td>

              <td className="px-6 py-4 whitespace-nowrap">
                <span className="text-sm text-gray-700">
                  {printer.cashRegister?.name ?? (
                    <span className="text-gray-400">Sin caja</span>
                  )}
                </span>
              </td>

              <td className="px-6 py-4 whitespace-nowrap">
                {printer.active ? (
                  <Badge variant="success">Activa</Badge>
                ) : (
                  <Badge variant="neutral">Inactiva</Badge>
                )}
              </td>

              <td
                className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => onEdit(printer)}
                    className="text-blue-600 hover:text-blue-900"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => onDelete(printer)}
                    className="text-red-600 hover:text-red-900"
                    title="Eliminar impresora"
                  >
                    <TrashIcon className="h-5 w-5" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
