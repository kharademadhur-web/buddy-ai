import { z } from "zod";

/**
 * Password validation schema
 * Requirements:
 * - Minimum 8 characters
 * - At least one letter (a-z, A-Z)
 * - At least one number (0-9)
 */
export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[a-zA-Z]/, "Password must contain at least one letter")
  .regex(/\d/, "Password must contain at least one number");

/**
 * User ID schema
 * Accepts phone numbers or email
 */
export const userIdSchema = z
  .string()
  .min(1, "User ID is required")
  .refine(
    (val) => {
      // Accept phone (10+ digits) or email format
      const phoneRegex = /^\d{10,}$/;
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return phoneRegex.test(val.replace(/\D/g, "")) || emailRegex.test(val);
    },
    "Invalid user ID (phone or email)"
  );

/**
 * Login form schema
 */
export const loginFormSchema = z.object({
  userId: userIdSchema,
  password: z.string().min(1, "Password is required"),
  rememberMe: z.boolean().optional().default(false),
  deviceId: z.string().optional(),
});

export type LoginFormInput = z.infer<typeof loginFormSchema>;

/**
 * OTP login schema (first-time login)
 */
export const otpLoginSchema = z.object({
  userId: userIdSchema,
  otp: z
    .string()
    .length(6, "OTP must be 6 digits")
    .regex(/^\d+$/, "OTP must contain only numbers"),
  deviceId: z.string().optional(),
});

export type OTPLoginInput = z.infer<typeof otpLoginSchema>;

/**
 * Set password schema (after OTP verification)
 */
export const setPasswordSchema = z
  .object({
    newPassword: passwordSchema,
    confirmPassword: z.string().min(1, "Confirm password is required"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

export type SetPasswordInput = z.infer<typeof setPasswordSchema>;

/**
 * Change password schema
 */
export const changePasswordSchema = z
  .object({
    oldPassword: z.string().min(1, "Current password is required"),
    newPassword: passwordSchema,
    confirmPassword: z.string().min(1, "Confirm password is required"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "New passwords don't match",
    path: ["confirmPassword"],
  })
  .refine((data) => data.oldPassword !== data.newPassword, {
    message: "New password must be different from current password",
    path: ["newPassword"],
  });

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

/**
 * Create user schema (admin operation)
 */
export const createUserSchema = z.object({
  name: z.string().min(1, "Name is required").min(3, "Name must be at least 3 characters"),
  phone: z
    .string()
    .min(10, "Phone must be 10 digits")
    .regex(/^\d{10}$/, "Phone must be 10 digits"),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  role: z.enum(["doctor", "reception", "admin", "solo-doctor"], {
    errorMap: () => ({ message: "Invalid role" }),
  }),
  clinicId: z.string().optional(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;

/**
 * Reset password request schema
 */
export const resetPasswordRequestSchema = z.object({
  userIdOrEmail: z.string().min(1, "User ID or email is required"),
});

export type ResetPasswordRequestInput = z.infer<typeof resetPasswordRequestSchema>;

/**
 * Reset password schema
 */
export const resetPasswordSchema = z
  .object({
    resetToken: z.string().min(1, "Reset token is required"),
    newPassword: passwordSchema,
    confirmPassword: z.string().min(1, "Confirm password is required"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

/**
 * Create role schema (admin operation)
 */
export const createRoleSchema = z.object({
  name: z.string().min(1, "Role name is required").min(3, "Name must be at least 3 characters"),
  description: z.string().optional(),
  permissions: z
    .array(z.string())
    .min(1, "At least one permission must be selected"),
});

export type CreateRoleInput = z.infer<typeof createRoleSchema>;

/**
 * Edit role schema
 */
export const editRoleSchema = z.object({
  name: z.string().min(1, "Role name is required").optional(),
  description: z.string().optional(),
  permissions: z.array(z.string()).optional(),
});

export type EditRoleInput = z.infer<typeof editRoleSchema>;

/**
 * Utility function to validate password strength
 */
export function validatePasswordStrength(password: string): {
  strength: "weak" | "medium" | "strong";
  score: number;
  feedback: string[];
} {
  const feedback: string[] = [];
  let score = 0;

  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (password.length >= 16) score += 1;

  if (/[a-z]/.test(password)) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) score += 1;

  if (password.length < 8)
    feedback.push("Password should be at least 8 characters");
  if (!/[a-z]/.test(password)) feedback.push("Add lowercase letters");
  if (!/[A-Z]/.test(password)) feedback.push("Add uppercase letters");
  if (!/\d/.test(password)) feedback.push("Add numbers");
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password))
    feedback.push("Add special characters for stronger security");

  let strength: "weak" | "medium" | "strong";
  if (score <= 2) strength = "weak";
  else if (score <= 4) strength = "medium";
  else strength = "strong";

  return {
    strength,
    score,
    feedback,
  };
}
