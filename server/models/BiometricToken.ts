import mongoose, { Schema, Document } from "mongoose";

export interface IBiometricToken extends Document {
  _id: string;
  userId: string;
  deviceId: string; // SHA-256 hash of device fingerprint
  credential: string; // Encrypted biometric credential
  createdAt: Date;
  expiresAt: Date; // 6 months from creation
  lastUsed: Date;
}

const BiometricTokenSchema = new Schema<IBiometricToken>(
  {
    userId: {
      type: String,
      required: true,
      ref: "User",
      index: true,
    },
    deviceId: {
      type: String,
      required: true,
      index: true,
    },
    credential: {
      type: String,
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
      expires: 0, // MongoDB TTL index: automatically delete expired tokens
    },
    lastUsed: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for user + device lookups
BiometricTokenSchema.index({ userId: 1, deviceId: 1 }, { unique: true });

// Index for cleanup queries
BiometricTokenSchema.index({ expiresAt: 1 });

export const BiometricToken = mongoose.model<IBiometricToken>(
  "BiometricToken",
  BiometricTokenSchema
);
