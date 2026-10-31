import { z } from "zod";
import { ROLES } from "@/shared/domain/role";
import { MIN_PASSWORD_LENGTH, normalizeUsername, USERNAME_PATTERN } from "../domain/user-account";

// Shared by the forms (instant feedback) and the use cases (the real check). The messages are
// shown next to the fields, so they are written in Spanish here.

const profileFields = {
  name: z
    .string()
    .trim()
    .min(3, { error: "Escribe el nombre completo." })
    .max(80, { error: "El nombre admite hasta 80 caracteres." }),
  position: z.string().trim().max(60, { error: "El cargo admite hasta 60 caracteres." }).optional(),
  documentId: z
    .string()
    .trim()
    .regex(/^[0-9A-Za-z\s.-]*$/, { error: "El CI solo lleva números y letras." })
    .max(20, { error: "El CI admite hasta 20 caracteres." })
    .optional(),
  workZoneId: z.union([z.literal(""), z.uuid()]).optional(),
};

export const createUserSchema = z.object({
  ...profileFields,
  username: z
    .string()
    .transform(normalizeUsername)
    .pipe(
      z.string().regex(USERNAME_PATTERN, {
        error: "Entre 3 y 30 letras sin acentos, números, puntos o guiones bajos.",
      }),
    ),
  email: z.union([z.literal(""), z.email({ error: "El correo no es válido." })]).optional(),
  role: z.enum(ROLES, { error: "Elige un rol." }),
});

export type CreateUserInput = z.input<typeof createUserSchema>;

export const updateUserSchema = z.object(profileFields);

export type UpdateUserInput = z.input<typeof updateUserSchema>;

export const userIdSchema = z.object({ userId: z.uuid() });

export const changeOwnPasswordSchema = z
  .object({
    currentPassword: z.string().min(1, { error: "Escribe tu contraseña actual." }),
    newPassword: z
      .string()
      .min(MIN_PASSWORD_LENGTH, { error: `Usa al menos ${MIN_PASSWORD_LENGTH} caracteres.` })
      .max(128, { error: "Usa como máximo 128 caracteres." }),
    confirmation: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmation, {
    error: "Las contraseñas no coinciden.",
    path: ["confirmation"],
  })
  .refine((data) => data.newPassword !== data.currentPassword, {
    error: "La nueva contraseña debe ser distinta de la actual.",
    path: ["newPassword"],
  });

export type ChangeOwnPasswordInput = z.input<typeof changeOwnPasswordSchema>;
