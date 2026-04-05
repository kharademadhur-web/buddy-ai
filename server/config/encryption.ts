import crypto from "crypto";

const ENCRYPTION_ALGORITHM = "aes-256-gcm";

/**
 * Validate and get encryption key from environment
 */
function getEncryptionKeyString(): string {
  const key = process.env.ENCRYPTION_KEY;

  if (!key) {
    throw new Error(
      "FATAL: ENCRYPTION_KEY environment variable is not set. " +
      "Generate a secure key using: node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\""
    );
  }

  if (key.includes("change-in-production") || key === "default-encryption-key-change-in-production") {
    throw new Error(
      "FATAL: ENCRYPTION_KEY contains unsafe default value. " +
      "Set a secure random key in environment variables."
    );
  }

  if (key.length < 32) {
    console.warn("WARNING: ENCRYPTION_KEY is shorter than 32 bytes. Recommended: 32+ bytes (base64 encoded).");
  }

  return key;
}

/**
 * Derive a 32-byte key from the ENCRYPTION_KEY
 */
function getEncryptionKey(): Buffer {
  const keyString = getEncryptionKeyString();

  // If it's base64 encoded (standard format), decode it
  if (keyString.length > 40) {
    try {
      const decoded = Buffer.from(keyString, "base64");
      if (decoded.length >= 32) {
        return decoded.slice(0, 32);
      }
    } catch {
      // Not valid base64, continue with hash approach
    }
  }

  // Fallback: hash to get a consistent 32-byte key
  return crypto.createHash("sha256").update(keyString).digest();
}

/**
 * Encrypt sensitive data (e.g., Aadhaar, PAN)
 * Returns: encryptedData:iv:authTag (base64 encoded)
 */
export function encryptField(plaintext: string): string {
  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(12); // 96-bit IV for GCM
    const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, key, iv);

    let encrypted = cipher.update(plaintext, "utf8", "hex");
    encrypted += cipher.final("hex");

    const authTag = cipher.getAuthTag();

    // Combine iv:encrypted:authTag and encode as base64
    const combined = Buffer.concat([iv, Buffer.from(encrypted, "hex"), authTag]);
    return combined.toString("base64");
  } catch (error) {
    console.error("Encryption error:", error);
    throw new Error("Failed to encrypt field");
  }
}

/**
 * Decrypt sensitive data
 * Input: encryptedData:iv:authTag (base64 encoded)
 */
export function decryptField(encrypted: string): string {
  try {
    const key = getEncryptionKey();
    const combined = Buffer.from(encrypted, "base64");

    // Extract iv, ciphertext, and authTag
    const iv = combined.slice(0, 12); // First 12 bytes
    const authTag = combined.slice(-16); // Last 16 bytes
    const ciphertext = combined.slice(12, -16); // Middle portion

    const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(ciphertext.toString("hex"), "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  } catch (error) {
    console.error("Decryption error:", error);
    throw new Error("Failed to decrypt field");
  }
}

/**
 * Hash password using bcrypt (for authentication)
 */
export async function hashPassword(password: string): Promise<string> {
  const bcrypt = await import("bcrypt");
  return bcrypt.hash(password, 10);
}

/**
 * Verify password against hash
 */
export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  const bcrypt = await import("bcrypt");
  return bcrypt.compare(password, hash);
}

/**
 * Generate a random secure password
 */
export function generateSecurePassword(length: number = 12): string {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
  let password = "";
  const randomValues = crypto.randomBytes(length);

  for (let i = 0; i < length; i++) {
    password += chars[randomValues[i] % chars.length];
  }

  return password;
}

export default {
  encryptField,
  decryptField,
  hashPassword,
  verifyPassword,
  generateSecurePassword,
};
