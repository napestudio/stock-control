import { z } from "zod";

export const createUserSchema = z.object({
  name: z.string().min(1, "El nombre es obligatorio").max(100),
  roleId: z.string().uuid("Rol inválido"),
  active: z.boolean().optional(),
});

export const editUserSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100).optional(),
  roleId: z.string().uuid().optional(),
  active: z.boolean().optional(),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().optional(),
    newPassword: z
      .string()
      .min(8, "La contraseña debe tener al menos 8 caracteres")
      .regex(/[A-Z]/, "Debe contener una letra mayúscula")
      .regex(/[a-z]/, "Debe contener una letra minúscula")
      .regex(/[0-9]/, "Debe contener un número"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Las contraseñas no coinciden",
    path: ["confirmPassword"],
  });

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type EditUserInput = z.infer<typeof editUserSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
