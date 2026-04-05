import mongoose, { Schema, Document } from "mongoose";

export interface IRefreshSession extends Document {
  _id: string;
  userId: string;
  refreshToken: string; // Hashed refresh token
  deviceId: string; // SHA-256 hash of device fingerprint
  deviceInfo: {
    browser?: string;
    os?: string;
    userAgent?: string;
  };
  ipAddress: string;
  lastUsedAt: Date;
  expiresAt: Date; // 30 days from creation
  isRotated: boolean; // Track if token has been rotated
  createdAt: Date;
  updatedAt: Date;
}

const RefreshSessionSchema = new Schema<IRefreshSession>(
  {
    userId: {
      type: String,
      required: true,
      ref: "User",
      index: true,
    },
    refreshToken: {
      type: String,
      required: true,
    },
    deviceId: {
      type: String,
      required: true,
      index: true,
    },
    deviceInfo: {
      browser: String,
      os: String,
      userAgent: String,
    },
    ipAddress: {
      type: String,
      required: true,
    },
    lastUsedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
      expires: 0, // MongoDB TTL index: automatically delete expired sessions
    },
    isRotated: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for user + device lookups
RefreshSessionSchema.index({ userId: 1, deviceId: 1 });

// Index for cleanup queries
RefreshSessionSchema.index({ expiresAt: 1 });

// Index for token lookup
RefreshSessionSchema.index({ refreshToken: 1 });

export const RefreshSession = mongoose.model<IRefreshSession>(
  "RefreshSession",
  RefreshSessionSchema
);
