import { getSupabaseClient } from "../config/supabase";
import type { JWTPayload } from "../config/jwt";

/**
 * Doctor UUIDs this receptionist may work with (same clinic). Empty if not receptionist or error.
 * Uses service-role Supabase (server-only): RLS often blocks receptionists reading assignment rows
 * even for themselves; filters are strictly the verified JWT userId + clinicId.
 */
export async function fetchAssignedDoctorIds(user: JWTPayload): Promise<string[]> {
  if (user.role !== "receptionist" || !user.clinicId) {
    return [];
  }
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("receptionist_doctor_assignments")
    .select("doctor_user_id")
    .eq("receptionist_user_id", user.userId)
    .eq("clinic_id", user.clinicId);
  if (error) {
    console.error("[receptionist-scope] fetchAssignedDoctorIds:", error.message);
    return [];
  }
  return [...new Set((data ?? []).map((r: { doctor_user_id: string }) => r.doctor_user_id))];
}

export function receptionistMustCoverDoctor(
  user: JWTPayload,
  doctorUserId: string,
  assignedDoctorIds: string[]
): { ok: true } | { ok: false; message: string } {
  if (user.role !== "receptionist") return { ok: true };
  if (assignedDoctorIds.includes(doctorUserId)) return { ok: true };
  return { ok: false, message: "You are not assigned to this doctor" };
}
