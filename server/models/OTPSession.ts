import mongoose, { Schema, Document } from "mongoose";

export interface IOTPSession extends Document {
  _id: string;
  sessionId: string;
  contact: string; // phone or email
  contactType: "phone" | "email";
  otpHash: string; // hashed OTP (don't store plain text)
  attempts: number;
  maxAttempts: number;
  expiresAt: Date;
  verified: boolean;
  verifiedAt?: Date;
  createdAt: Date;
}

const OTPSessionSchema = new Schema<IOTPSession>(
  {
    sessionId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    contact: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    contactType: {
      type: String,
      enum: ["phone", "email"],
      required: true,
    },
    otpHash: {
      type: String,
      required: true,
    },
    attempts: {
      type: Number,
      default: 0,
    },
    maxAttempts: {
      type: Number,
      default: 5,
    },
    expiresAt: {
      type: Date,
      required: true,
      // Auto-delete expired documents after 5 minutes
      index: { expireAfterSeconds: 300 },
    },
    verified: {
      type: Boolean,
      default: false,
    },
    verifiedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Index for faster lookups
OTPSessionSchema.index({ sessionId: 1 });
OTPSessionSchema.index({ contact: 1 });
OTPSessionSchema.index({ expiresAt: 1 });

export const OTPSession = mongoose.model<IOTPSession>(
  "OTPSession",
  OTPSessionSchema
);
