import jwt from "jsonwebtoken";
import { User, IUser } from "../models/User";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production";
const JWT_EXPIRY = "7d";
const REFRESH_TOKEN_EXPIRY = "30d";

export interface TokenPayload {
  userId: string;
  contact: string;
  role?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

/**
 * Generate JWT access token
 */
export function generateAccessToken(user: IUser): string {
  const payload: TokenPayload = {
    userId: user._id.toString(),
    contact: user.contact,
    role: user.role || undefined,
  };

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRY,
  });
}

/**
 * Generate refresh token
 */
export function generateRefreshToken(user: IUser): string {
  const payload: TokenPayload = {
    userId: user._id.toString(),
    contact: user.contact,
  };

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: REFRESH_TOKEN_EXPIRY,
  });
}

/**
 * Generate both access and refresh tokens
 */
export function generateTokens(user: IUser): AuthTokens {
  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  // Calculate expiry time (in seconds)
  const expiresIn = 7 * 24 * 60 * 60; // 7 days

  return {
    accessToken,
    refreshToken,
    expiresIn,
  };
}

/**
 * Verify and decode JWT token
 */
export function verifyToken(token: string): TokenPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as TokenPayload;
    return decoded;
  } catch (error) {
    console.error("Token verification error:", error);
    return null;
  }
}

/**
 * Verify refresh token and generate new access token
 */
export async function refreshAccessToken(
  refreshToken: string
): Promise<string | null> {
  try {
    const payload = verifyToken(refreshToken);
    if (!payload) {
      return null;
    }

    const user = await User.findById(payload.userId);
    if (!user) {
      return null;
    }

    // Check if user is still active
    if (user.status !== "active") {
      return null;
    }

    return generateAccessToken(user);
  } catch (error) {
    console.error("Token refresh error:", error);
    return null;
  }
}

/**
 * Update user's last login
 */
export async function updateLastLogin(userId: string): Promise<void> {
  try {
    await User.findByIdAndUpdate(userId, {
      lastLogin: new Date(),
    });
  } catch (error) {
    console.error("Error updating last login:", error);
  }
}

/**
 * Get user by ID
 */
export async function getUserById(userId: string): Promise<IUser | null> {
  try {
    return await User.findById(userId);
  } catch (error) {
    console.error("Error getting user:", error);
    return null;
  }
}

/**
 * Get user by contact
 */
export async function getUserByContact(contact: string): Promise<IUser | null> {
  try {
    return await User.findOne({ contact });
  } catch (error) {
    console.error("Error getting user by contact:", error);
    return null;
  }
}

/**
 * Update user role and clinic/doctor associations
 */
export async function updateUserRole(
  userId: string,
  role: "super-admin" | "clinic" | "doctor",
  clinicId?: string,
  doctorId?: string
): Promise<IUser | null> {
  try {
    const user = await User.findByIdAndUpdate(
      userId,
      {
        role,
        clinicId: clinicId || null,
        doctorId: doctorId || null,
        status: "active",
      },
      { new: true }
    );

    return user;
  } catch (error) {
    console.error("Error updating user role:", error);
    return null;
  }
}

/**
 * Suspend user account
 */
export async function suspendUser(userId: string): Promise<boolean> {
  try {
    const result = await User.findByIdAndUpdate(userId, {
      status: "suspended",
    });
    return !!result;
  } catch (error) {
    console.error("Error suspending user:", error);
    return false;
  }
}

/**
 * Activate user account
 */
export async function activateUser(userId: string): Promise<boolean> {
  try {
    const result = await User.findByIdAndUpdate(userId, {
      status: "active",
    });
    return !!result;
  } catch (error) {
    console.error("Error activating user:", error);
    return false;
  }
}

export interface AuthResponse {
  user: Partial<IUser>;
  tokens: AuthTokens;
}

/**
 * Prepare auth response for client
 */
export function prepareAuthResponse(user: IUser): AuthResponse {
  const tokens = generateTokens(user);

  return {
    user: {
      _id: user._id,
      contact: user.contact,
      contactType: user.contactType,
      name: user.name,
      role: user.role,
      isVerified: user.isVerified,
    },
    tokens,
  };
}
