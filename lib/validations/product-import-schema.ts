import { z } from "zod";

export const csvProductRowSchema = z.object({
  name: z.string().min(1, "Nombre requerido").max(200, "Nombre demasiado largo"),
  quantity: z
    .number()
    .int("Cantidad debe ser un número entero")
    .min(0, "Cantidad debe ser mayor o igual a 0"),
  price: z
    .number()
    .min(0, "Precio debe ser mayor o igual a 0"),
});

export type CSVProductRow = z.infer<typeof csvProductRowSchema>;

export const importProductsSchema = z.object({
  rows: z.array(csvProductRowSchema).min(1, "El archivo debe tener al menos una fila"),
});

export type ImportProductsInput = z.infer<typeof importProductsSchema>;

export type ImportResult = {
  created: number;
  skipped: number;
  errors: { row: number; name: string; message: string }[];
};
