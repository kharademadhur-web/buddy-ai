import { getSupabaseClient } from "../config/supabase";

/**
 * Generate a clinic code (2-4 letters + 3 digits)
 * Example: MUM001, DEL002, BNG001
 */
export async function generateClinicCode(clinicName: string): Promise<string> {
  const supabase = getSupabaseClient();

  // Extract first 2-4 letters from clinic name
  const initials = clinicName
    .split(" ")
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join("")
    .slice(0, 4);

  // Find the count of clinics with this prefix to generate suffix
  const { data: clinics, error } = await supabase
    .from("clinics")
    .select("clinic_code")
    .ilike("clinic_code", `${initials}%`);

  if (error) {
    console.error("Error fetching clinics:", error);
  }

  const count = (clinics?.length || 0) + 1;
  const code = `${initials}${String(count).padStart(3, "0")}`;

  return code;
}

/**
 * Reserve next numeric suffix via DB (atomic). Same semantics as previous read-then-increment flow.
 */
export async function reserveNextUserIdSuffix(
  clinicId: string,
  role: "doctor" | "receptionist" | "independent"
): Promise<number> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase.rpc("next_user_id_suffix", {
    p_clinic_id: clinicId,
    p_role: role,
  });

  if (error) {
    console.error("next_user_id_suffix RPC error, using fallback allocator:", error);
    return reserveNextUserIdSuffixFallback(clinicId, role);
  }

  const n =
    typeof data === "number"
      ? data
      : data != null
        ? parseInt(String(data), 10)
        : NaN;
  if (Number.isNaN(n)) {
    throw new Error("Failed to reserve user ID suffix");
  }

  return n;
}

async function reserveNextUserIdSuffixFallback(
  clinicId: string,
  role: "doctor" | "receptionist" | "independent"
): Promise<number> {
  const supabase = getSupabaseClient();
  const { data: clinic } = await supabase
    .from("clinics")
    .select("clinic_code")
    .eq("id", clinicId)
    .maybeSingle();
  const clinicCode = String(clinic?.clinic_code || "").trim().toUpperCase();
  const roleCode = getRoleCode(role);
  const prefix = `${clinicCode}-${roleCode}-`;

  const { data: rows, error } = await supabase
    .from("users")
    .select("user_id")
    .eq("clinic_id", clinicId)
    .eq("role", role);

  if (error) {
    throw new Error(error.message || "Failed to reserve user ID suffix");
  }

  let maxSuffix = 0;
  for (const row of rows ?? []) {
    const id = String((row as { user_id?: string }).user_id || "");
    if (!id.startsWith(prefix)) continue;
    const num = parseInt(id.slice(prefix.length), 10);
    if (!Number.isNaN(num)) maxSuffix = Math.max(maxSuffix, num);
  }
  return maxSuffix + 1;
}

/**
 * When counters drift behind existing users.user_id values, bump counters.current_count
 * so the next next_user_id_suffix call issues a free suffix (deploy migration 013 for RPC).
 */
export async function repairCounterFromExistingUserIds(
  clinicCode: string,
  clinicId: string,
  role: "doctor" | "receptionist" | "independent"
): Promise<void> {
  const supabase = getSupabaseClient();

  const { error: rpcErr } = await supabase.rpc("repair_user_id_counter", {
    p_clinic_id: clinicId,
    p_role: role,
  });

  if (!rpcErr) return;

  console.error("repair_user_id_counter RPC failed, using client fallback", rpcErr);

  const roleCode = getRoleCode(role);
  const prefix = `${clinicCode}-${roleCode}-`;

  const { data: rows, error: listErr } = await supabase
    .from("users")
    .select("user_id")
    .eq("clinic_id", clinicId)
    .eq("role", role);

  if (listErr) {
    console.error("repairCounterFromExistingUserIds: list users failed", listErr);
    return;
  }

  let maxSuffix = 0;
  for (const row of rows ?? []) {
    const id = row.user_id as string;
    if (!id?.startsWith(prefix)) continue;
    const tail = id.slice(prefix.length);
    const num = parseInt(tail, 10);
    if (!Number.isNaN(num)) maxSuffix = Math.max(maxSuffix, num);
  }

  const target = maxSuffix + 1;

  const { data: existing } = await supabase
    .from("counters")
    .select("id")
    .eq("clinic_id", clinicId)
    .eq("role", role)
    .maybeSingle();

  if (!existing) {
    const { error: insErr } = await supabase.from("counters").insert({
      clinic_id: clinicId,
      role,
      current_count: target,
    });
    if (insErr) console.error("repairCounterFromExistingUserIds: insert counter failed", insErr);
    return;
  }

  const { error: upErr } = await supabase
    .from("counters")
    .update({ current_count: target })
    .eq("clinic_id", clinicId)
    .eq("role", role);

  if (upErr) console.error("repairCounterFromExistingUserIds: update counter failed", upErr);
}

/** PostgREST / Postgres duplicate-key on users.user_id */
export function isDuplicateUserIdConstraintError(err: unknown): boolean {
  if (err == null) return false;
  const serialized = (() => {
    try {
      return JSON.stringify(err).toLowerCase();
    } catch {
      return "";
    }
  })();
  if (serialized.includes("23505") || serialized.includes("users_user_id_key")) {
    return true;
  }
  if (typeof err !== "object") return false;
  const e = err as { message?: string; code?: string | number };
  const code = String(e.code ?? "");
  if (code === "23505") return true;
  const m = (e.message ?? "").toLowerCase();
  return (
    m.includes("users_user_id_key") ||
    (m.includes("duplicate key") && m.includes("user_id"))
  );
}

/**
 * Generate a unique user ID in format: CLINICCODE-ROLE-NUMBER
 * Example: MUM001-DOC-10234
 * Requires clinic_id so the counter can be updated atomically (see migration 013).
 */
export async function generateUserIdUnique(
  clinicCode: string,
  clinicId: string,
  role: "doctor" | "receptionist" | "independent"
): Promise<string> {
  const roleCode = getRoleCode(role);
  const suffix = await reserveNextUserIdSuffix(clinicId, role);
  return `${clinicCode}-${roleCode}-${suffix}`;
}

/**
 * Deterministic fallback allocator that scans existing users for the max suffix.
 * Useful when RPC counters are misconfigured in an environment.
 */
export async function generateUserIdUniqueByScan(
  clinicCode: string,
  clinicId: string,
  role: "doctor" | "receptionist" | "independent"
): Promise<string> {
  const supabase = getSupabaseClient();
  const normalizedClinicCode = clinicCode.trim().toUpperCase();
  const roleCode = getRoleCode(role);
  const prefix = `${normalizedClinicCode}-${roleCode}-`;

  const { data: rows, error } = await supabase
    .from("users")
    .select("user_id")
    .eq("clinic_id", clinicId)
    .eq("role", role);

  if (error) {
    throw new Error(error.message || "Failed to generate user ID");
  }

  let maxSuffix = 0;
  for (const row of rows ?? []) {
    const id = String((row as { user_id?: string }).user_id || "").toUpperCase();
    if (!id.startsWith(prefix)) continue;
    const tail = id.slice(prefix.length);
    const n = parseInt(tail, 10);
    if (!Number.isNaN(n)) maxSuffix = Math.max(maxSuffix, n);
  }

  return `${normalizedClinicCode}-${roleCode}-${maxSuffix + 1}`;
}

/**
 * @deprecated Counter is advanced inside next_user_id_suffix; kept for compatibility.
 */
export async function incrementUserIdCounter(
  _clinicCode: string,
  _role: "doctor" | "receptionist" | "independent"
): Promise<boolean> {
  return true;
}

/**
 * Get role code abbreviation
 */
function getRoleCode(role: "doctor" | "receptionist" | "independent"): string {
  const roleCodes: Record<string, string> = {
    doctor: "DOC",
    receptionist: "REC",
    independent: "IND",
  };
  return roleCodes[role] || role.toUpperCase().slice(0, 3);
}

/**
 * Validate user ID format
 */
export function isValidUserIdFormat(userId: string): boolean {
  // Format: CLINICCODE-ROLE-NUMBER
  // Example: MUM001-DOC-10234
  const pattern = /^[A-Z]{2,4}\d{3}-[A-Z]{3}-\d{5,}$/;
  return pattern.test(userId);
}

/**
 * Parse user ID to extract components
 */
export function parseUserId(
  userId: string
): {
  clinicCode: string;
  role: string;
  number: string;
} | null {
  const parts = userId.split("-");
  if (parts.length !== 3) {
    return null;
  }

  const [clinicCode, role, number] = parts;

  if (!isValidUserIdFormat(userId)) {
    return null;
  }

  return {
    clinicCode,
    role,
    number,
  };
}

const UserIdGeneratorService = {
  generateClinicCode,
  generateUserID: generateUserIdUnique,
  incrementUserIdCounter,
  reserveNextUserIdSuffix,
  generateUserIdUniqueByScan,
  repairCounterFromExistingUserIds,
  isDuplicateUserIdConstraintError,
  isValidUserIdFormat,
  parseUserId,
};

export default UserIdGeneratorService;
