import { generateSecurePassword, hashPassword } from "../config/encryption";
import { getSupabaseClient } from "../config/supabase";

export interface GeneratedCredentials {
  user_id: string;
  password: string;
  password_hash: string;
}

export interface SendCredentialsOptions {
  method?: "email" | "sms" | "whatsapp";
  additionalInfo?: string;
}

/**
 * Generate credentials for a new user
 */
export async function generateCredentials(
  user_id: string
): Promise<GeneratedCredentials> {
  try {
    const password = generateSecurePassword(12);
    const password_hash = await hashPassword(password);

    return {
      user_id,
      password,
      password_hash,
    };
  } catch (error) {
    console.error("Error generating credentials:", error);
    throw new Error("Failed to generate credentials");
  }
}

/**
 * Hash a password for secure storage
 */
export async function hashPasswordFunction(password: string): Promise<string> {
  return hashPassword(password);
}

/**
 * Send credentials to user via email/SMS/WhatsApp
 */
export async function sendCredentials(
  user: {
    name: string;
    user_id: string;
    email?: string;
    phone?: string;
  },
  password: string,
  options: SendCredentialsOptions = {}
): Promise<boolean> {
  const { method = "email", additionalInfo = "" } = options;

  try {
    console.log(`Sending credentials via ${method}`);

    const message = formatCredentialMessage(
      user.name,
      user.user_id,
      password,
      additionalInfo
    );

    switch (method) {
      case "email":
        return await sendViaEmail(user.email || "", message, user);

      case "sms":
        return await sendViaSMS(user.phone || "", message);

      case "whatsapp":
        return await sendViaWhatsApp(user.phone || "", message);

      default:
        console.warn(`Unknown send method: ${method}`);
        return false;
    }
  } catch (error) {
    console.error("Error sending credentials:", error);
    return false;
  }
}

/**
 * Format credential message
 */
function formatCredentialMessage(
  name: string,
  user_id: string,
  password: string,
  additionalInfo: string
): string {
  const timestamp = new Date().toLocaleString();

  return `
Hello ${name},

Your clinic account has been created successfully!

User ID: ${user_id}
Password: ${password}

Login URL: https://admin.estrellx.shop/login

⚠️  IMPORTANT:
- Change your password immediately after first login
- Do not share these credentials with anyone
- This message contains sensitive information

Additional Info: ${additionalInfo}

Created at: ${timestamp}
    `.trim();
}

/**
 * Send credentials via email
 */
async function sendViaEmail(
  email: string,
  message: string,
  user: { name: string; user_id: string }
): Promise<boolean> {
  try {
    console.log(`📧 Email to ${email}:\n${message}`);
    return true;
  } catch (error) {
    console.error("Email sending error:", error);
    return false;
  }
}

/**
 * Send credentials via SMS
 */
async function sendViaSMS(
  phone: string,
  message: string
): Promise<boolean> {
  try {
    console.log(`📱 SMS to ${phone}:\n${message}`);
    return true;
  } catch (error) {
    console.error("SMS sending error:", error);
    return false;
  }
}

/**
 * Send credentials via WhatsApp
 */
async function sendViaWhatsApp(
  phone: string,
  message: string
): Promise<boolean> {
  try {
    console.log(`💬 WhatsApp to ${phone}:\n${message}`);
    return true;
  } catch (error) {
    console.error("WhatsApp sending error:", error);
    return false;
  }
}

/**
 * Log credential generation for audit purposes
 */
export async function logCredentialGeneration(
  userId: string,
  action: "created" | "reset"
): Promise<void> {
  const supabase = getSupabaseClient();

  try {
    await supabase.from("audit_logs").insert({
      user_id: userId,
      action: `credentials_${action}`,
      resource_type: "credentials",
      resource_id: userId,
      created_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error logging credential generation:", error);
  }
}

const CredentialGeneratorService = {
  generateCredentials,
  hashPassword: hashPasswordFunction,
  sendCredentials,
  logCredentialGeneration,
};

export default CredentialGeneratorService;
