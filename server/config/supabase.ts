import { createClient, SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  "https://your-project.supabase.co";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || "";
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || "";

if (!SUPABASE_URL || (!SUPABASE_SERVICE_KEY && !SUPABASE_ANON_KEY)) {
  console.warn(
    "⚠️  Supabase credentials not found. Set SUPABASE_URL (or VITE_SUPABASE_URL) and SUPABASE_SERVICE_KEY (server) and/or VITE_SUPABASE_ANON_KEY."
  );
}

let serviceSupabaseClient: SupabaseClient | null = null;

/**
 * Initialize Supabase client
 * Use service role key for backend operations (has elevated permissions)
 */
export function getSupabaseClient(): SupabaseClient {
  if (!serviceSupabaseClient) {
    const keySource = SUPABASE_SERVICE_KEY
      ? "SUPABASE_SERVICE_KEY"
      : SUPABASE_ANON_KEY
        ? "VITE_SUPABASE_ANON_KEY"
        : "MISSING";
    const key = SUPABASE_SERVICE_KEY || SUPABASE_ANON_KEY || "";
    if (process.env.NODE_ENV !== "production") {
      console.log(
        `[supabase] init keySource=${keySource} keyLen=${key.length} keyPrefix=${key.slice(0, 8)}`
      );
    }
    if (!SUPABASE_SERVICE_KEY && process.env.NODE_ENV === "production") {
      console.error(
        "[supabase] CRITICAL: SUPABASE_SERVICE_KEY is missing in production. Device approvals and other privileged DB operations will fail under RLS. Add the service_role key from Supabase → Settings → API."
      );
    }
    serviceSupabaseClient = createClient(SUPABASE_URL, key, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }
  return serviceSupabaseClient;
}

/**
 * Create a Supabase client that ENFORCES RLS by using the anon key + a user JWT.
 * This is intended for request-scoped access using a JWT signed with the Supabase JWT secret.
 */
export function getSupabaseRlsClient(userJwt: string): SupabaseClient {
  if (!SUPABASE_ANON_KEY) {
    throw new Error(
      "VITE_SUPABASE_ANON_KEY is required to create an RLS-enforcing Supabase client."
    );
  }

  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: {
      headers: {
        Authorization: `Bearer ${userJwt}`,
      },
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Get raw database connection for complex queries
 */
export async function executeRawQuery(sql: string, params: any[] = []) {
  const client = getSupabaseClient();
  const { data, error } = await client.rpc("execute_raw_sql", {
    sql,
    params,
  });

  if (error) {
    console.error("Raw SQL execution error:", error);
    throw error;
  }

  return data;
}

/**
 * Database type definitions
 */
export interface Database {
  public: {
    Tables: {
      clinics: {
        Row: {
          id: string;
          name: string;
          address: string | null;
          phone: string | null;
          email: string | null;
          clinic_code: string;
          subscription_status: "active" | "pending" | "inactive";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          address?: string | null;
          phone?: string | null;
          email?: string | null;
          clinic_code: string;
          subscription_status?: "active" | "pending" | "inactive";
          created_at?: string;
          updated_at?: string;
        };
      };
      users: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          phone: string | null;
          email: string | null;
          clinic_id: string | null;
          role: "doctor" | "receptionist" | "independent" | "super-admin";
          password_hash: string;
          device_id: string | null;
          device_approved_at: string | null;
          is_active: boolean;
          login_attempts: number;
          locked_until?: string | null;
          locked_at?: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          phone?: string | null;
          email?: string | null;
          clinic_id?: string | null;
          role: "doctor" | "receptionist" | "independent" | "super-admin";
          password_hash: string;
          device_id?: string | null;
          device_approved_at?: string | null;
          is_active?: boolean;
          login_attempts?: number;
          locked_until?: string | null;
          locked_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      doctors: {
        Row: {
          id: string;
          user_id: string;
          license_number: string | null;
          license_verified: boolean;
          signature_url: string | null;
          aadhaar_url: string | null;
          aadhaar_number_encrypted: string | null;
          pan_url: string | null;
          pan_number_encrypted: string | null;
          kyc_status: "pending" | "verified" | "rejected";
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          license_number?: string | null;
          license_verified?: boolean;
          signature_url?: string | null;
          aadhaar_url?: string | null;
          aadhaar_number_encrypted?: string | null;
          pan_url?: string | null;
          pan_number_encrypted?: string | null;
          kyc_status?: "pending" | "verified" | "rejected";
          created_at?: string;
        };
      };
    };
  };
}

export default getSupabaseClient;
