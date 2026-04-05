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
 * Generate a unique user ID in format: CLINICCODE-ROLE-NUMBER
 * Example: MUM001-DOC-10234
 */
export async function generateUserIdUnique(
  clinicCode: string,
  role: "doctor" | "receptionist" | "independent"
): Promise<string> {
  const supabase = getSupabaseClient();

  const roleCode = getRoleCode(role);

  try {
    // Get clinic ID from clinic code
    const { data: clinicData, error: clinicError } = await supabase
      .from("clinics")
      .select("id")
      .eq("clinic_code", clinicCode)
      .single();

    if (clinicError || !clinicData) {
      throw new Error(`Clinic with code ${clinicCode} not found`);
    }

    // Get or create counter
    let { data: counterData, error: counterError } = await supabase
      .from("counters")
      .select("current_count")
      .eq("clinic_id", clinicData.id)
      .eq("role", role)
      .single();

    // If counter doesn't exist, create it
    if (counterError || !counterData) {
      const { data: newCounter, error: createError } = await supabase
        .from("counters")
        .insert({
          clinic_id: clinicData.id,
          role,
          current_count: 10000,
        })
        .select("current_count")
        .single();

      if (createError || !newCounter) {
        throw createError || new Error("Failed to create counter");
      }

      counterData = newCounter;
    }

    // Generate user ID with current count
    const userId = `${clinicCode}-${roleCode}-${counterData.current_count}`;

    return userId;
  } catch (error) {
    console.error("Error generating user ID:", error);
    throw new Error("Failed to generate user ID");
  }
}

/**
 * Increment counter after user creation
 */
export async function incrementUserIdCounter(
  clinicCode: string,
  role: "doctor" | "receptionist" | "independent"
): Promise<boolean> {
  const supabase = getSupabaseClient();

  try {
    // Get clinic ID
    const { data: clinicData, error: clinicError } = await supabase
      .from("clinics")
      .select("id")
      .eq("clinic_code", clinicCode)
      .single();

    if (clinicError || !clinicData) {
      throw new Error(`Clinic with code ${clinicCode} not found`);
    }

    // Fetch current counter then increment (Supabase doesn't provide atomic increment without a SQL function)
    const { data: counter, error: counterError } = await supabase
      .from("counters")
      .select("current_count")
      .eq("clinic_id", clinicData.id)
      .eq("role", role)
      .single();

    if (counterError || !counter) {
      throw counterError || new Error("Counter not found");
    }

    const { error: updateError } = await supabase
      .from("counters")
      .update({ current_count: counter.current_count + 1 })
      .eq("clinic_id", clinicData.id)
      .eq("role", role);

    if (updateError) throw updateError;

    return true;
  } catch (error) {
    console.error("Error incrementing counter:", error);
    return false;
  }
}

/**
 * Get role code abbreviation
 */
function getRoleCode(
  role: "doctor" | "receptionist" | "independent"
): string {
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
  isValidUserIdFormat,
  parseUserId,
};

export default UserIdGeneratorService;
