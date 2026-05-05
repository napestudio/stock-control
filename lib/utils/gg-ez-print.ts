/**
 * Client-only utility for communicating with gg-ez-print.
 * https://github.com/RenzoCostarelli/gg-ez-print
 *
 * IMPORTANT: Never import this file in server components or server actions.
 * It uses browser-only WebSocket APIs.
 */

import type { SystemPrinter, GgEzPrintListResponse } from "@/types/printer";
import type { PrinterConnectionType, PaperWidth } from "@prisma/client";

const WS_URL = "ws://localhost:8080/ws";
const DEFAULT_TIMEOUT_MS = 5000;

function isGgEzPrintStatusResponse(
  value: unknown
): value is { status: string; message?: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    "status" in value &&
    typeof (value as Record<string, unknown>)["status"] === "string"
  );
}

function isGgEzPrintListResponse(value: unknown): value is GgEzPrintListResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    (value as Record<string, unknown>)["type"] === "printer_list" &&
    "printers" in value &&
    Array.isArray((value as Record<string, unknown>)["printers"])
  );
}

export type PrintResult =
  | { success: true }
  | { success: false; error: string };

export type TestPrintPayload = {
  printerName: string;
  connectionType: PrinterConnectionType;
  paperWidth: PaperWidth;
  printerDisplayName: string;
};

export type ListPrintersResult =
  | { success: true; printers: SystemPrinter[] }
  | { success: false; error: string };

/**
 * Sends a test print job to gg-ez-print to verify the printer is working.
 */
export function testPrint(
  payload: TestPrintPayload,
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<PrintResult> {
  return new Promise((resolve) => {
    let ws: WebSocket;
    let timeoutId: ReturnType<typeof setTimeout>;
    let settled = false;

    function settle(result: PrintResult) {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      if (ws && ws.readyState !== WebSocket.CLOSED) {
        ws.close();
      }
      resolve(result);
    }

    try {
      ws = new WebSocket(WS_URL);
    } catch {
      resolve({
        success: false,
        error:
          "No se pudo conectar al servicio de impresión. Verifique que gg-ez-print esté ejecutándose.",
      });
      return;
    }

    timeoutId = setTimeout(() => {
      settle({
        success: false,
        error: `Tiempo de espera agotado (${timeoutMs / 1000}s). Verifique que gg-ez-print esté ejecutándose.`,
      });
    }, timeoutMs);

    ws.onopen = () => {
      const paperWidthMm = payload.paperWidth === "MM80" ? 80 : 58;
      const separator = "=".repeat(paperWidthMm === 80 ? 32 : 24);
      const content = [
        separator,
        "   PRUEBA DE IMPRESION",
        separator,
        `Impresora: ${payload.printerDisplayName}`,
        `Conexion: ${payload.connectionType === "TCP_IP" ? "TCP/IP" : "USB/Serial"}`,
        `Papel: ${paperWidthMm}mm`,
        separator,
        "Si puede leer este mensaje,",
        "la impresora funciona",
        "correctamente.",
        separator,
      ].join("\n");

      ws.send(
        JSON.stringify({
          action: "print",
          data: {
            printer_name: payload.printerName,
            type: payload.connectionType === "TCP_IP" ? "Network" : "USB",
            content,
            font_size: 1,
            paper_width: paperWidthMm,
          },
        })
      );
    };

    ws.onmessage = (event: MessageEvent<string>) => {
      try {
        const parsed: unknown = JSON.parse(event.data);
        if (isGgEzPrintStatusResponse(parsed)) {
          if (parsed.status === "success") {
            settle({ success: true });
          } else {
            settle({
              success: false,
              error: parsed.message ?? "La impresora reportó un error.",
            });
          }
        } else {
          settle({
            success: false,
            error: "Respuesta inesperada del servicio de impresión.",
          });
        }
      } catch {
        settle({
          success: false,
          error: "Error al procesar la respuesta del servicio de impresión.",
        });
      }
    };

    ws.onerror = () => {
      settle({
        success: false,
        error:
          "Error de conexión. Verifique que gg-ez-print esté ejecutándose en el puerto 8080.",
      });
    };

    ws.onclose = (event: CloseEvent) => {
      if (!event.wasClean && !settled) {
        settle({
          success: false,
          error: "La conexión con gg-ez-print se cerró inesperadamente.",
        });
      }
    };
  });
}

/**
 * Opens a WebSocket connection to gg-ez-print, requests the printer list,
 * and resolves with a typed result. Never throws — errors are returned
 * as { success: false, error: string }.
 */
export function listSystemPrinters(
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<ListPrintersResult> {
  return new Promise((resolve) => {
    let ws: WebSocket;
    let timeoutId: ReturnType<typeof setTimeout>;
    let settled = false;

    function settle(result: ListPrintersResult) {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      if (ws && ws.readyState !== WebSocket.CLOSED) {
        ws.close();
      }
      resolve(result);
    }

    try {
      ws = new WebSocket(WS_URL);
    } catch {
      resolve({
        success: false,
        error:
          "No se pudo conectar al servicio de impresión. Verifique que gg-ez-print esté ejecutándose.",
      });
      return;
    }

    timeoutId = setTimeout(() => {
      settle({
        success: false,
        error: `Tiempo de espera agotado (${timeoutMs / 1000}s). Verifique que gg-ez-print esté ejecutándose.`,
      });
    }, timeoutMs);

    ws.onopen = () => {
      ws.send(JSON.stringify({ action: "list" }));
    };

    ws.onmessage = (event: MessageEvent<string>) => {
      try {
        const parsed: unknown = JSON.parse(event.data);
        if (isGgEzPrintListResponse(parsed)) {
          settle({ success: true, printers: parsed.printers });
        } else {
          settle({
            success: false,
            error: "Respuesta inesperada del servicio de impresión.",
          });
        }
      } catch {
        settle({
          success: false,
          error: "Error al procesar la respuesta del servicio de impresión.",
        });
      }
    };

    ws.onerror = () => {
      settle({
        success: false,
        error:
          "Error de conexión. Verifique que gg-ez-print esté ejecutándose en el puerto 8080.",
      });
    };

    ws.onclose = (event: CloseEvent) => {
      if (!event.wasClean && !settled) {
        settle({
          success: false,
          error: "La conexión con gg-ez-print se cerró inesperadamente.",
        });
      }
    };
  });
}
