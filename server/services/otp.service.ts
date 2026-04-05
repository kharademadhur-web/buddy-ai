import crypto from "crypto";
import { OTPSession } from "../models/OTPSession";
import { User } from "../models/User";

const OTP_VALIDITY_MINUTES = 5;
const OTP_MAX_ATTEMPTS = 5;

/**
 * Generate a random 6-digit OTP
 */
export function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Hash OTP for secure storage
 */
function hashOTP(otp: string): string {
  return crypto.createHash("sha256").update(otp).digest("hex");
}

/**
 * Send OTP to user (phone/email)
 * TODO: Integrate with actual SMS/Email service
 */
export async function sendOTPToUser(
  contact: string,
  contactType: "phone" | "email",
  otp: string
): Promise<void> {
  // Mock implementation - Replace with real SMS/Email service
  console.log(`
    ╔════════════════════════════════════════════════════╗
    ║               OTP SENT (Mock)                      ║
    ║────────────────────────────────────────────────────║
    ║ To: ${contactType === "phone" ? `+91 ${contact}` : contact}
    ║ Message: Your SmartClinic OTP is: ${otp}
    ║ Valid for: ${OTP_VALIDITY_MINUTES} minutes
    ╚════════════════════════════════════════════════════╝
  `);

  // TODO: Replace with actual SMS/Email API
  // if (contactType === "phone") {
  //   await twilioClient.messages.create({
  //     body: `Your SmartClinic OTP is: ${otp}`,
  //     from: process.env.TWILIO_PHONE,
  //     to: `+91${contact}`,
  //   });
  // } else {
  //   await emailService.send({
  //     to: contact,
  //     subject: "Your SmartClinic OTP",
  //     body: `Your OTP is: ${otp}`,
  //   });
  // }
}

/**
 * Create a new OTP session
 */
export async function createOTPSession(
  contact: string,
  contactType: "phone" | "email"
): Promise<{
  sessionId: string;
  expiresIn: number;
}> {
  try {
    // Generate OTP
    const otp = generateOTP();
    const otpHash = hashOTP(otp);

    // Create session
    const sessionId = `session_${crypto.randomBytes(16).toString("hex")}`;
    const expiresAt = new Date(Date.now() + OTP_VALIDITY_MINUTES * 60 * 1000);

    const session = new OTPSession({
      sessionId,
      contact,
      contactType,
      otpHash,
      expiresAt,
      attempts: 0,
      maxAttempts: OTP_MAX_ATTEMPTS,
    });

    await session.save();

    // Send OTP to user
    await sendOTPToUser(contact, contactType, otp);

    return {
      sessionId,
      expiresIn: OTP_VALIDITY_MINUTES * 60, // seconds
    };
  } catch (error) {
    console.error("Error creating OTP session:", error);
    throw new Error("Failed to send OTP");
  }
}

/**
 * Verify OTP for a session
 */
export async function verifyOTP(
  sessionId: string,
  otp: string
): Promise<{
  verified: boolean;
  contact: string;
  contactType: "phone" | "email";
}> {
  try {
    const session = await OTPSession.findOne({ sessionId });

    if (!session) {
      throw new Error("Invalid session");
    }

    // Check if already verified
    if (session.verified) {
      throw new Error("OTP already verified");
    }

    // Check expiry
    if (new Date() > session.expiresAt) {
      await OTPSession.deleteOne({ sessionId });
      throw new Error("OTP expired");
    }

    // Check attempts
    if (session.attempts >= session.maxAttempts) {
      await OTPSession.deleteOne({ sessionId });
      throw new Error("Too many attempts");
    }

    // Verify OTP
    const otpHash = hashOTP(otp);
    if (otpHash !== session.otpHash) {
      // Increment attempts
      session.attempts += 1;
      await session.save();

      const remaining = session.maxAttempts - session.attempts;
      throw new Error(`Invalid OTP. ${remaining} attempts remaining`);
    }

    // Mark as verified
    session.verified = true;
    session.verifiedAt = new Date();
    await session.save();

    return {
      verified: true,
      contact: session.contact,
      contactType: session.contactType,
    };
  } catch (error) {
    console.error("Error verifying OTP:", error);
    throw error;
  }
}

/**
 * Get or create user after OTP verification
 */
export async function getOrCreateUser(
  contact: string,
  contactType: "phone" | "email"
): Promise<{
  userId: string;
  isNewUser: boolean;
  requiresOnboarding: boolean;
}> {
  try {
    let user = await User.findOne({ contact });

    if (!user) {
      // New user
      user = new User({
        contact,
        contactType,
        isVerified: true,
        verifiedAt: new Date(),
        status: "pending", // Pending onboarding
      });
      await user.save();

      return {
        userId: user._id.toString(),
        isNewUser: true,
        requiresOnboarding: true, // User needs to complete onboarding
      };
    }

    // Existing user
    user.isVerified = true;
    user.verifiedAt = new Date();
    user.lastLogin = new Date();
    await user.save();

    return {
      userId: user._id.toString(),
      isNewUser: false,
      requiresOnboarding: user.role === null, // If no role assigned, needs onboarding
    };
  } catch (error) {
    console.error("Error getting/creating user:", error);
    throw new Error("Failed to create user account");
  }
}

/**
 * Clean up expired OTP sessions (can be run as cron job)
 */
export async function cleanupExpiredOTPSessions(): Promise<number> {
  try {
    const result = await OTPSession.deleteMany({
      expiresAt: { $lt: new Date() },
    });

    console.log(`Cleaned up ${result.deletedCount} expired OTP sessions`);
    return result.deletedCount;
  } catch (error) {
    console.error("Error cleaning up OTP sessions:", error);
    return 0;
  }
}
