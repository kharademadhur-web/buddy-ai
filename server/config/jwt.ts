import jwt from "jsonwebtoken";

// Validate JWT secrets are set and secure
function getJWTSecret(): string {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error(
      "FATAL: JWT_SECRET environment variable is not set. " +
      "Generate a secure secret using: node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\""
    );
  }

  if (secret.includes("change-in-production") || secret === "your-secret-key-change-in-production") {
    throw new Error(
      "FATAL: JWT_SECRET contains unsafe default value. " +
      "Set a secure random secret in environment variables."
    );
  }

  if (secret.length < 32) {
    console.warn("WARNING: JWT_SECRET is shorter than 32 bytes. Recommended: 32+ bytes.");
  }

  return secret;
}

function getJWTRefreshSecret(): string {
  const secret = process.env.JWT_REFRESH_SECRET;

  if (!secret) {
    throw new Error(
      "FATAL: JWT_REFRESH_SECRET environment variable is not set. " +
      "Generate a secure secret using: node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\""
    );
  }

  if (secret.includes("change-in-production") || secret === "your-refresh-secret-change-in-production") {
    throw new Error(
      "FATAL: JWT_REFRESH_SECRET contains unsafe default value. " +
      "Set a secure random secret in environment variables."
    );
  }

  if (secret.length < 32) {
    console.warn("WARNING: JWT_REFRESH_SECRET is shorter than 32 bytes. Recommended: 32+ bytes.");
  }

  return secret;
}

const JWT_SECRET = getJWTSecret();
const JWT_REFRESH_SECRET = getJWTRefreshSecret();
const ACCESS_TOKEN_EXPIRY = "15m"; // 15 minutes
const REFRESH_TOKEN_EXPIRY = "7d"; // 7 days

export interface JWTPayload {
  userId: string;
  user_id: string; // Custom user ID like MUM001-DOC-10234
  name: string;
  role: "doctor" | "receptionist" | "independent" | "super-admin" | "clinic-admin";
  clinicId?: string;
  email?: string;
  phone?: string;
}

/**
 * Generate JWT access token
 */
export function generateAccessToken(payload: JWTPayload): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRY,
    algorithm: "HS256",
  });
}

/**
 * Generate JWT refresh token
 */
export function generateRefreshToken(payload: JWTPayload): string {
  return jwt.sign(payload, JWT_REFRESH_SECRET, {
    expiresIn: REFRESH_TOKEN_EXPIRY,
    algorithm: "HS256",
  });
}

/**
 * Generate both access and refresh tokens
 */
export function generateTokens(payload: JWTPayload) {
  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload);

  return {
    accessToken,
    refreshToken,
    expiresIn: 15 * 60, // 15 minutes in seconds
  };
}

/**
 * Verify and decode access token
 */
export function verifyAccessToken(token: string): JWTPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET, {
      algorithms: ["HS256"],
    }) as JWTPayload;
    return decoded;
  } catch (error) {
    console.error("Access token verification error:", error instanceof Error ? error.message : error);
    return null;
  }
}

/**
 * Verify and decode refresh token
 */
export function verifyRefreshToken(token: string): JWTPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_REFRESH_SECRET, {
      algorithms: ["HS256"],
    }) as JWTPayload;
    return decoded;
  } catch (error) {
    console.error("Refresh token verification error:", error instanceof Error ? error.message : error);
    return null;
  }
}

/**
 * Extract token from Authorization header
 */
export function extractTokenFromHeader(authHeader?: string): string | null {
  if (!authHeader) return null;

  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0].toLowerCase() !== "bearer") {
    return null;
  }

  return parts[1];
}

/**
 * Decode token without verification (for logging/debugging only)
 */
export function decodeToken(token: string): JWTPayload | null {
  try {
    return jwt.decode(token) as JWTPayload | null;
  } catch {
    return null;
  }
}

export default {
  generateAccessToken,
  generateRefreshToken,
  generateTokens,
  verifyAccessToken,
  verifyRefreshToken,
  extractTokenFromHeader,
  decodeToken,
};
