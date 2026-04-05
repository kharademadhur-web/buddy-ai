import jwt from "jsonwebtoken";
import type { JWTPayload } from "./jwt";

function getSupabaseJwtSecret(): string {
  const secret = process.env.SUPABASE_JWT_SECRET;
  if (!secret) {
    throw new Error(
      "SUPABASE_JWT_SECRET is not set. This must be your Supabase project's JWT secret (NOT the service key)."
    );
  }
  return secret;
}

/**
 * Mint a Supabase-compatible JWT for PostgREST/RLS.
 *
 * Important: In Supabase/PostgREST, the `role` claim controls the database role.
 * We keep that as `authenticated` and put your app RBAC role into `app_role`.
 */
export function signSupabaseRlsJwt(user: JWTPayload): string {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const expSeconds = nowSeconds + 15 * 60; // 15 minutes

  const claims = {
    aud: "authenticated",
    role: "authenticated",
    iat: nowSeconds,
    exp: expSeconds,

    // App RBAC + tenancy
    app_role: user.role,
    clinicId: user.clinicId ?? null,
    userId: user.userId,
  };

  return jwt.sign(claims, getSupabaseJwtSecret(), { algorithm: "HS256" });
}

