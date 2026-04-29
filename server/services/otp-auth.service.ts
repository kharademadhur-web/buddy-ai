import { getSupabaseClient } from "../config/supabase";
import { hashPassword, verifyPassword } from "../config/encryption";
import { generateTokens, JWTPayload } from "../config/jwt";
import SupabaseAuthService from "./supabase-auth.service";

type ContactType = "phone" | "email";

function normalizeContact(contact: string, contactType: ContactType): string {
  const trimmed = contact.trim();
  if (contactType === "phone") return trimmed.replace(/\D/g, "");
  return trimmed.toLowerCase();
}

/** Exported for patient intake: match OTP session contact to patient.phone */
export function normalizePhoneDigits(contact: string): string {
  return contact.trim().replace(/\D/g, "");
}

function generateOtpCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function getOtpValidityMinutes(): number {
  const v = Number(process.env.OTP_VALIDITY_MINUTES ?? 5);
  return Number.isFinite(v) && v > 0 ? v : 5;
}

function getOtpMaxAttempts(): number {
  const v = Number(process.env.OTP_MAX_ATTEMPTS ?? 5);
  return Number.isFinite(v) && v > 0 ? v : 5;
}

export class OtpAuthService {
  static async sendOtp(contact: string, contactType: ContactType) {
    const supabase = getSupabaseClient();
    const normalized = normalizeContact(contact, contactType);

    const otp = generateOtpCode();
    const otp_hash = await hashPassword(otp);

    const expires = new Date();
    expires.setMinutes(expires.getMinutes() + getOtpValidityMinutes());

    const { data, error } = await supabase
      .from("otp_sessions")
      .insert({
        contact: normalized,
        contact_type: contactType,
        otp_hash,
        attempts: 0,
        expires_at: expires.toISOString(),
      })
      .select("id, expires_at")
      .single();

    if (error || !data) {
      throw new Error(`Failed to create OTP session: ${error?.message ?? "unknown error"}`);
    }

    if (process.env.NODE_ENV !== "production") {
      console.log(`[OTP][DEV] contact=${normalized} type=${contactType} otp=${otp} session=${data.id}`);
    }

    return { sessionId: data.id as string, expiresAt: data.expires_at as string };
  }

  /**
   * Validates OTP and marks session verified. Shared by login and patient-phone proof.
   */
  static async verifyOtpSessionCode(sessionId: string, otp: string) {
    const supabase = getSupabaseClient();

    const { data: session, error } = await supabase
      .from("otp_sessions")
      .select("*")
      .eq("id", sessionId)
      .single();

    if (error || !session) {
      throw new Error("Invalid OTP session");
    }

    if (session.verified_at) {
      throw new Error("OTP already used");
    }

    if (new Date(session.expires_at).getTime() < Date.now()) {
      throw new Error("OTP expired");
    }

    if ((session.attempts ?? 0) >= getOtpMaxAttempts()) {
      throw new Error("Too many attempts. Please request a new OTP.");
    }

    const ok = await verifyPassword(otp, session.otp_hash);

    const nextAttempts = (session.attempts ?? 0) + 1;
    await supabase
      .from("otp_sessions")
      .update({
        attempts: ok ? session.attempts : nextAttempts,
        last_attempt_at: new Date().toISOString(),
        verified_at: ok ? new Date().toISOString() : null,
      })
      .eq("id", sessionId);

    if (!ok) {
      throw new Error("Invalid OTP");
    }

    return session as {
      id: string;
      contact: string;
      contact_type: ContactType;
      verified_at: string | null;
    };
  }

  /** Reception intake: prove phone without issuing login tokens or creating users. */
  /**
   * Password change: verify current password + phone matches account, then send OTP.
   */
  static async sendPasswordChangeOtpWithPasswordAndPhone(
    userId: string,
    currentPassword: string,
    phoneInput: string
  ) {
    const ok = await SupabaseAuthService.verifyCurrentPassword(userId, currentPassword);
    if (!ok) {
      throw new Error("Current password is incorrect");
    }
    const supabase = getSupabaseClient();
    const { data: user, error } = await supabase
      .from("users")
      .select("phone, role")
      .eq("id", userId)
      .maybeSingle();
    if (error || !user?.phone) {
      throw new Error("Phone number not on file. Contact your administrator.");
    }
    const role = String(user.role || "");
    if (!["doctor", "independent", "receptionist", "clinic-admin"].includes(role)) {
      throw new Error("Password change via OTP is not available for this account.");
    }
    const a = normalizePhoneDigits(phoneInput);
    const b = normalizePhoneDigits(user.phone);
    if (!a || a !== b) {
      throw new Error("Phone number does not match the number registered to this account");
    }
    return this.sendOtp(user.phone, "phone");
  }

  /**
   * Send OTP to the authenticated user's phone (password change flow).
   */
  static async sendPasswordChangeOtpForUser(userId: string) {
    const supabase = getSupabaseClient();
    const { data: user, error } = await supabase
      .from("users")
      .select("id, phone, role")
      .eq("id", userId)
      .maybeSingle();

    if (error || !user?.phone) {
      throw new Error("Phone number not on file. Contact your administrator.");
    }

    const role = String(user.role || "");
    if (!["doctor", "independent", "receptionist", "clinic-admin"].includes(role)) {
      throw new Error("Password change via OTP is not available for this account.");
    }

    return this.sendOtp(user.phone, "phone");
  }

  static async verifyPhoneOtpForPatientProof(sessionId: string, otp: string) {
    const session = await this.verifyOtpSessionCode(sessionId, otp);
    if (session.contact_type !== "phone") {
      throw new Error("OTP session must be for phone verification");
    }
    return { phone: session.contact };
  }

  static async verifyOtp(sessionId: string, otp: string) {
    const supabase = getSupabaseClient();
    const session = await this.verifyOtpSessionCode(sessionId, otp);

    const contactType: ContactType = session.contact_type;
    const contact: string = session.contact;

    const email = contactType === "email" ? contact : null;
    const phone = contactType === "phone" ? contact : null;

    // Tolerate duplicate rows that match the same contact: prefer the newest active row.
    let userQuery = supabase.from("users").select("*");
    userQuery = email ? userQuery.eq("email", email) : userQuery.eq("phone", phone);
    const { data: existingRows } = await userQuery
      .order("created_at", { ascending: false })
      .limit(1);
    const existingUser = Array.isArray(existingRows) ? existingRows[0] ?? null : null;

    let user = existingUser;
    if (!user) {
      const randomPasswordHash = await hashPassword(`otp-${Date.now()}-${Math.random()}`);
      const user_id = `OTP-IND-${Date.now()}`;
      const { data: created, error: createError } = await supabase
        .from("users")
        .insert({
          user_id,
          name: contactType === "email" ? contact.split("@")[0] : "OTP User",
          email,
          phone,
          role: "independent",
          password_hash: randomPasswordHash,
          is_active: true,
        })
        .select("*")
        .single();

      if (createError || !created) {
        throw new Error(`Failed to create user for OTP login: ${createError?.message ?? "unknown error"}`);
      }
      user = created;
    }

    const payload: JWTPayload = {
      userId: user.id,
      user_id: user.user_id,
      name: user.name,
      role: user.role,
      clinicId: user.clinic_id ?? undefined,
      email: user.email ?? undefined,
      phone: user.phone ?? undefined,
    };

    const tokens = generateTokens(payload);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        id: user.id,
        contact,
        contactType,
        // Always reflect the real DB role; previously hardcoded to "doctor" which
        // misled the client into showing the wrong portal for non-doctor accounts.
        role: user.role,
        clinicId: user.clinic_id ?? undefined,
        doctorId: undefined,
        name: user.name,
        isVerified: true,
      },
    };
  }
}

export default OtpAuthService;
