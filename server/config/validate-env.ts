/**
 * Validate that all required environment variables are set and safe
 * This runs on server startup to prevent insecure deployments
 */
function getSupabaseProjectUrl(): string | undefined {
  const v = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  return v?.trim() || undefined;
}

function isPlaceholder(value: string): boolean {
  const v = value.toLowerCase();
  return (
    v.includes("change-in-production") ||
    v.includes("replace_with_") ||
    v.includes("your-project") ||
    v.includes("your-project-ref") ||
    v.includes("<your-") ||
    v.includes("default-") ||
    v === "https://your-project.supabase.co"
  );
}

export interface EnvironmentValidationIssues {
  missing: string[];
  unsafe: string[];
  /** True when production has no valid http(s) origin for CORS (same check as startup exit). */
  productionCorsFatal: boolean;
}

/**
 * Collect validation issues without exiting — used by `pnpm verify:deployment` and tests.
 * Mirrors `validateEnvironmentVariables()` logic.
 */
export function collectEnvironmentValidationIssues(): EnvironmentValidationIssues {
  const requiredStringVars: Record<string, string> = {
    SUPABASE_SERVICE_KEY: "Supabase service role key",
    SUPABASE_JWT_SECRET: "Supabase JWT secret (Dashboard → Settings → API; not the service key)",
    JWT_SECRET: "JWT signing secret",
    JWT_REFRESH_SECRET: "JWT refresh secret",
    ENCRYPTION_KEY: "Data encryption key",
  };

  const missingVars: string[] = [];
  const unsafeVars: string[] = [];

  const url = getSupabaseProjectUrl();
  if (!url) {
    missingVars.push("SUPABASE_URL or VITE_SUPABASE_URL (Supabase project URL)");
  } else if (isPlaceholder(url)) {
    unsafeVars.push("SUPABASE_URL / VITE_SUPABASE_URL (replace placeholder with real project URL)");
  }

  Object.entries(requiredStringVars).forEach(([key, description]) => {
    const value = process.env[key];

    if (!value?.trim()) {
      missingVars.push(`${key} (${description})`);
    } else if (isPlaceholder(value)) {
      unsafeVars.push(`${key} (${description})`);
    }
  });

  let productionCorsFatal = false;

  if (
    process.env.NODE_ENV === "production" &&
    process.env.CORS_ALLOW_LOCALHOST !== "true"
  ) {
    const pub = process.env.PUBLIC_URL?.trim() ?? "";
    if (!pub) {
      missingVars.push(
        "PUBLIC_URL (required in production — e.g. https://<your-app>.azurewebsites.net)"
      );
    } else if (!pub.startsWith("https://")) {
      unsafeVars.push("PUBLIC_URL (must use https:// in production)");
    }

    const hasProdOrigin =
      !!process.env.CORS_ORIGINS?.split(",").some((s) => /^https?:\/\//i.test(s.trim())) ||
      /^https?:\/\//i.test(process.env.ADMIN_URL?.trim() ?? "") ||
      /^https?:\/\//i.test(process.env.STAFF_PORTAL_URL?.trim() ?? "") ||
      /^https?:\/\//i.test(process.env.MOBILE_APP_URL?.trim() ?? "") ||
      /^https?:\/\//i.test(pub);
    if (!hasProdOrigin) {
      productionCorsFatal = true;
    }

    const corsLine = process.env.CORS_ORIGINS?.trim() ?? "";
    if (corsLine && !corsLine.split(",").some((s) => s.trim().startsWith("https://"))) {
      unsafeVars.push(
        "CORS_ORIGINS (production requires at least one https:// origin when CORS_ALLOW_LOCALHOST is not true)"
      );
    }
  }

  return {
    missing: missingVars,
    unsafe: unsafeVars,
    productionCorsFatal,
  };
}

function logMissingAndExit(missingVars: string[]): never {
  console.error("❌ MISSING REQUIRED ENVIRONMENT VARIABLES:");
  missingVars.forEach((v) => console.error(`   - ${v}`));
  console.error("\nPlease set these variables before starting the server.\n");
  process.exit(1);
}

export function validateEnvironmentVariables(): void {
  const { missing, unsafe, productionCorsFatal } = collectEnvironmentValidationIssues();

  if (productionCorsFatal) {
    console.error(
      "❌ Production CORS: set at least one of CORS_ORIGINS, ADMIN_URL, STAFF_PORTAL_URL, MOBILE_APP_URL, PUBLIC_URL (with http(s) URL), or set CORS_ALLOW_LOCALHOST=true for local testing."
    );
    process.exit(1);
  }

  if (missing.length > 0) {
    logMissingAndExit(missing);
  }

  if (unsafe.length > 0) {
    console.error("❌ UNSAFE ENVIRONMENT VARIABLES (placeholder or default values):");
    unsafe.forEach((v) => console.error(`   - ${v}`));
    console.error("\nPlease set secure values for these variables.\n");
    process.exit(1);
  }

  console.log("✅ Environment variables validated successfully");
}

/**
 * Get a required environment variable or throw error
 */
export function getRequiredEnv(key: string, description?: string): string {
  const value = process.env[key];

  if (!value) {
    throw new Error(
      `Missing required environment variable: ${key}${description ? ` (${description})` : ""}`
    );
  }

  return value;
}

/**
 * Get an optional environment variable with a default
 */
export function getOptionalEnv(key: string, defaultValue: string): string {
  return process.env[key] || defaultValue;
}
