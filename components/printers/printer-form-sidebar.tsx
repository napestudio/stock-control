"use client";

import { useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { PrinterConnectionType, PaperWidth } from "@prisma/client";
import {
  createPrinterSchema,
  type CreatePrinterInput,
} from "@/lib/validations/printer-schema";
import { createPrinter, updatePrinter } from "@/app/actions/printer-actions";
import FormInput from "@/components/ui/form-input";
import Sidebar from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { listSystemPrinters, testPrint } from "@/lib/utils/gg-ez-print";
import type { PrinterSerialized, SystemPrinter } from "@/types/printer";
import type { CashRegisterWithStats } from "@/types/cash-register";

interface PrinterFormSidebarProps {
  mode: "create" | "edit";
  printer?: PrinterSerialized;
  cashRegisters: CashRegisterWithStats[];
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function PrinterFormSidebar({
  mode,
  printer,
  cashRegisters,
  isOpen,
  onClose,
  onSuccess,
}: PrinterFormSidebarProps) {
  const [error, setError] = useState("");
  const [systemPrinters, setSystemPrinters] = useState<SystemPrinter[]>([]);
  const [isSearchingPrinters, setIsSearchingPrinters] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [isPending, startTransition] = useTransition();
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors },
  } = useForm<CreatePrinterInput>({
    resolver: zodResolver(createPrinterSchema),
    defaultValues:
      mode === "edit" && printer
        ? {
            name: printer.name,
            description: printer.description ?? "",
            model: printer.model ?? "",
            connectionType: printer.connectionType,
            ipAddress: printer.ipAddress ?? "",
            systemPrinterName: printer.systemPrinterName ?? "",
            paperWidth: printer.paperWidth,
            autoPrint: printer.autoPrint,
            active: printer.active,
            cashRegisterId: printer.cashRegisterId ?? "",
          }
        : {
            name: "",
            description: "",
            model: "",
            connectionType: PrinterConnectionType.TCP_IP,
            ipAddress: "",
            systemPrinterName: "",
            paperWidth: PaperWidth.MM80,
            autoPrint: false,
            active: true,
            cashRegisterId: "",
          },
  });

  const connectionType = useWatch({ control, name: "connectionType" });
  const paperWidth = useWatch({ control, name: "paperWidth" });

  async function handleTest() {
    if (!printer) return;

    const printerName =
      printer.connectionType === "TCP_IP"
        ? printer.ipAddress
        : printer.systemPrinterName;

    if (!printerName) {
      setTestResult({
        success: false,
        message:
          printer.connectionType === "TCP_IP"
            ? "La impresora no tiene dirección IP configurada."
            : "La impresora no tiene nombre de sistema configurado.",
      });
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    const result = await testPrint({
      printerName,
      connectionType: printer.connectionType,
      paperWidth: printer.paperWidth,
      printerDisplayName: printer.name,
    });

    setIsTesting(false);
    setTestResult({
      success: result.success,
      message: result.success ? "Prueba enviada correctamente." : result.error,
    });

    if (result.success) {
      setTimeout(() => setTestResult(null), 4000);
    }
  }

  async function handleSearchPrinters() {
    setIsSearchingPrinters(true);
    setSearchError("");
    setSystemPrinters([]);

    const result = await listSystemPrinters();

    if (result.success) {
      setSystemPrinters(result.printers);
      if (result.printers.length === 0) {
        setSearchError("No se encontraron impresoras en el sistema.");
      }
    } else {
      setSearchError(result.error);
    }

    setIsSearchingPrinters(false);
  }

  async function onSubmit(data: CreatePrinterInput) {
    setError("");
    startTransition(async () => {
      try {
        if (mode === "create") {
          await createPrinter(data);
        } else if (mode === "edit" && printer) {
          await updatePrinter(printer.id, data);
        }
        onSuccess();
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Ocurrió un error");
      }
    });
  }

  return (
    <Sidebar
      isOpen={isOpen}
      onClose={onClose}
      title={mode === "create" ? "Nueva Impresora" : "Editar Impresora"}
      size="lg"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        {/* Connection type selector */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">
            Tipo de Conexión <span className="text-red-500 ml-1">*</span>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => {
                setValue("connectionType", PrinterConnectionType.TCP_IP);
                setValue("systemPrinterName", "");
                setSystemPrinters([]);
                setSearchError("");
              }}
              className={`p-4 rounded-lg border-2 text-left transition-colors ${
                connectionType === PrinterConnectionType.TCP_IP
                  ? "border-indigo-500 bg-indigo-50"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <svg
                  className="h-4 w-4 text-gray-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.14 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0"
                  />
                </svg>
                <span className="font-medium text-sm">Red (TCP/IP)</span>
              </div>
              <div className="text-xs text-gray-500">
                Impresora conectada a la red
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                setValue("connectionType", PrinterConnectionType.USB_SERIAL);
                setValue("ipAddress", "");
              }}
              className={`p-4 rounded-lg border-2 text-left transition-colors ${
                connectionType === PrinterConnectionType.USB_SERIAL
                  ? "border-indigo-500 bg-indigo-50"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <svg
                  className="h-4 w-4 text-gray-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 18h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                  />
                </svg>
                <span className="font-medium text-sm">USB / Serial</span>
              </div>
              <div className="text-xs text-gray-500">
                Impresora conectada por USB
              </div>
            </button>
          </div>
        </div>

        {/* TCP/IP: IP address */}
        {connectionType === PrinterConnectionType.TCP_IP && (
          <FormInput
            label="Dirección IP"
            {...register("ipAddress")}
            error={errors.ipAddress?.message}
            required
            placeholder="192.168.1.100"
          />
        )}

        {/* USB/Serial: system printer name + search button */}
        {connectionType === PrinterConnectionType.USB_SERIAL && (
          <div className="space-y-2">
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Impresora del Sistema{" "}
                  <span className="text-red-500 ml-1">*</span>
                </label>
                {systemPrinters.length > 0 ? (
                  <select
                    {...register("systemPrinterName")}
                    className={`block w-full px-3 py-2 border ${
                      errors.systemPrinterName
                        ? "border-red-300"
                        : "border-gray-300"
                    } rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-sm`}
                  >
                    <option value="">Seleccionar impresora</option>
                    {systemPrinters.map((sp) => (
                      <option key={sp.name} value={sp.name}>
                        {sp.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    {...register("systemPrinterName")}
                    placeholder="Nombre de la impresora Windows"
                    className={`block w-full px-3 py-2 border ${
                      errors.systemPrinterName
                        ? "border-red-300"
                        : "border-gray-300"
                    } rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-sm`}
                  />
                )}
              </div>
              <Button
                type="button"
                variant="outline"
                disabled={isSearchingPrinters}
                onClick={handleSearchPrinters}
                className="shrink-0 whitespace-nowrap"
              >
                {isSearchingPrinters ? "Buscando..." : "Buscar Impresoras"}
              </Button>
            </div>
            {searchError && (
              <p className="text-sm text-amber-600">{searchError}</p>
            )}
            {errors.systemPrinterName && (
              <p className="text-sm text-red-600">
                {errors.systemPrinterName.message}
              </p>
            )}
            <p className="text-xs text-gray-500">
              Nombre exacto de la impresora como aparece en Windows (sensible a
              mayúsculas)
            </p>
          </div>
        )}

        {/* Divider */}
        <div className="border-t border-gray-100 pt-1">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">
            Información Básica
          </p>
        </div>

        <FormInput
          label="Nombre"
          {...register("name")}
          error={errors.name?.message}
          required
          placeholder="Impresora Caja 1"
        />

        <div className="w-full">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Descripción
          </label>
          <textarea
            {...register("description")}
            rows={2}
            placeholder="Descripción opcional..."
            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-sm resize-none"
          />
        </div>

        <FormInput
          label="Modelo"
          {...register("model")}
          error={errors.model?.message}
          placeholder="Epson TM-T88VI"
        />

        {/* Cash register selector */}
        <div className="w-full">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Caja registradora
          </label>
          <select
            {...register("cashRegisterId")}
            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-sm"
          >
            <option value="">Sin caja</option>
            {cashRegisters
              .filter((r) => r.active)
              .map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
          </select>
          <p className="mt-1 text-xs text-gray-500">
            Asigna la impresora a una caja registradora
          </p>
        </div>

        {/* Divider */}
        <div className="border-t border-gray-100 pt-1">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">
            Configuración de Impresión
          </p>
        </div>

        {/* Paper width */}
        <div className="w-full">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Ancho del Papel
          </label>
          <div className="flex gap-3">
            {[
              { value: PaperWidth.MM80, label: "80mm" },
              { value: PaperWidth.MM58, label: "58mm" },
            ].map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => setValue("paperWidth", value)}
                className={`px-4 py-2 rounded-lg border-2 text-sm font-medium transition-colors ${
                  paperWidth === value
                    ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                    : "border-gray-200 text-gray-700 hover:border-gray-300"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Auto-print toggle */}
        <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg">
          <input
            type="checkbox"
            id="autoPrint"
            {...register("autoPrint")}
            className="mt-0.5 h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
          />
          <div>
            <label
              htmlFor="autoPrint"
              className="text-sm font-medium text-gray-900"
            >
              Impresión Automática
            </label>
            <p className="text-xs text-gray-500 mt-0.5">
              Imprimir automáticamente cuando realices una venta desde la caja
              (si no está activado, tendrás que imprimir manualmente desde el
              detalle de la venta)
            </p>
          </div>
        </div>

        {/* Active toggle (edit mode only) */}
        {mode === "edit" && (
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="active"
              {...register("active")}
              className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
            />
            <label
              htmlFor="active"
              className="text-sm font-medium text-gray-700"
            >
              Impresora activa
            </label>
          </div>
        )}

        {/* Test printer — edit mode only */}
        {mode === "edit" && (
          <div className="space-y-2 pt-2 border-t border-gray-100">
            {testResult && (
              <div
                className={`px-3 py-2 rounded text-sm ${
                  testResult.success
                    ? "bg-green-50 text-green-700 border border-green-200"
                    : "bg-red-50 text-red-700 border border-red-200"
                }`}
              >
                {testResult.message}
              </div>
            )}
            <button
              type="button"
              onClick={handleTest}
              disabled={isTesting || isPending}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg
                className="h-4 w-4"
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
              {isTesting ? "Enviando prueba..." : "Probar Impresora"}
            </button>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPending
              ? mode === "create"
                ? "Creando..."
                : "Guardando..."
              : mode === "create"
                ? "Crear"
                : "Guardar"}
          </button>
        </div>
      </form>
    </Sidebar>
  );
}
