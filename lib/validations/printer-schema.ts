import { z } from "zod";
import { PrinterConnectionType, PaperWidth } from "@prisma/client";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const IP_REGEX = /^(\d{1,3}\.){3}\d{1,3}$/;

const printerBaseFields = {
  name: z
    .string()
    .min(1, "El nombre es obligatorio")
    .max(100, "El nombre debe tener 100 caracteres o menos"),
  description: z.string().max(500).optional().or(z.literal("")),
  model: z.string().max(100).optional().or(z.literal("")),
  connectionType: z.nativeEnum(PrinterConnectionType, {
    message: "Tipo de conexión inválido",
  }),
  ipAddress: z
    .string()
    .regex(IP_REGEX, "Ingrese una dirección IP válida (ej: 192.168.1.100)")
    .optional()
    .or(z.literal("")),
  systemPrinterName: z.string().max(200).optional().or(z.literal("")),
  paperWidth: z.nativeEnum(PaperWidth, {
    message: "Ancho de papel inválido",
  }),
  autoPrint: z.boolean(),
  cashRegisterId: z
    .string()
    .regex(UUID_REGEX, "ID de caja inválido")
    .optional()
    .or(z.literal("")),
};

function validateConnectionFields(
  data: { connectionType: PrinterConnectionType; ipAddress?: string; systemPrinterName?: string },
  ctx: z.RefinementCtx
) {
  if (data.connectionType === PrinterConnectionType.TCP_IP) {
    if (!data.ipAddress || data.ipAddress === "") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "La dirección IP es obligatoria para conexión TCP/IP",
        path: ["ipAddress"],
      });
    }
  }
  if (data.connectionType === PrinterConnectionType.USB_SERIAL) {
    if (!data.systemPrinterName || data.systemPrinterName === "") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "El nombre del sistema es obligatorio para conexión USB/Serial",
        path: ["systemPrinterName"],
      });
    }
  }
}

export const createPrinterSchema = z
  .object({
    ...printerBaseFields,
    active: z.boolean(),
  })
  .superRefine(validateConnectionFields);

export const updatePrinterSchema = z
  .object({
    id: z.string().regex(UUID_REGEX, "ID inválido"),
    ...printerBaseFields,
    active: z.boolean().optional(),
  })
  .superRefine(validateConnectionFields);

export const deletePrinterSchema = z.object({
  id: z.string().regex(UUID_REGEX, "ID inválido"),
});

export type CreatePrinterInput = z.infer<typeof createPrinterSchema>;
export type UpdatePrinterInput = z.infer<typeof updatePrinterSchema>;
export type DeletePrinterInput = z.infer<typeof deletePrinterSchema>;
