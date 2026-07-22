/**
 * Admin panel Zod validation schemas.
 *
 * Used for:
 * - Change / set-password request body validation
 */

import { z } from "zod";

import { APP_USER_ROLES } from "@/DB/schema";

// Password policy: >= 8 chars, at least one letter and one number.
export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(200, "Password is too long")
  .regex(/[A-Za-z]/, "Password must contain at least one letter")
  .regex(/[0-9]/, "Password must contain at least one number");

/**
 * Change-password payload. `currentPassword` is optional because an admin who
 * has no credential password yet (SSO-only, provisioning for the first time)
 * sets an initial one without a current password — their active SSO session is
 * the proof of identity. When a password already exists the API requires and
 * verifies `currentPassword`.
 */
export const changePasswordSchema = z
  .object({
    currentPassword: z.string().optional(),
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

// ─────────────────────────────────────────────
// USER MANAGEMENT (superadmin only)
// ─────────────────────────────────────────────

const roleEnum = z.enum(APP_USER_ROLES);

/** Grant/revoke a role on a target user. Revoking resets them to "user". */
export const setUserRoleSchema = z.object({
  userId: z.string().min(1, "userId is required"),
  role: roleEnum,
});
export type SetUserRoleInput = z.infer<typeof setUserRoleSchema>;

/**
 * Provision (or reset) a temporary credential password for a target user.
 * The target must already hold an admin role ("creds imply admin"); the API
 * enforces that. If `password` is omitted the API generates a strong temp one
 * and returns it once.
 */
export const provisionCredentialsSchema = z.object({
  userId: z.string().min(1, "userId is required"),
  password: passwordSchema.optional(),
});
export type ProvisionCredentialsInput = z.infer<
  typeof provisionCredentialsSchema
>;
