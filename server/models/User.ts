import mongoose, { Schema, Document } from "mongoose";

export type UserRole = "super-admin" | "clinic" | "doctor";
export type AccountStatus = "pending" | "active" | "suspended" | "rejected";

export interface IUser extends Document {
  _id: string;
  contact: string; // phone or email
  contactType: "phone" | "email";
  name?: string;
  role?: UserRole;
  clinicId?: string;
  doctorId?: string;

  // Verification
  isVerified: boolean;
  verifiedAt?: Date;

  // Password Authentication
  passwordHash?: string;
  temporaryPassword?: string;
  passwordChangedAt?: Date;
  lastPasswordReset?: Date;

  // Account Security
  status: AccountStatus;
  lastLogin?: Date;
  loginAttempts: number;
  lockoutUntil?: Date;
  biometricEnabled: boolean;

  // New fields for onboarding
  userIdUnique?: string; // e.g., CITY-MED-DOC-10001
  isActive: boolean; // Admin can toggle access
  deviceApprovals?: string[]; // Array of DeviceApprovalRequest IDs

  // Device binding
  approvedDeviceId?: string; // Device fingerprint/ID for device-bound login

  // Metadata
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    contact: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    contactType: {
      type: String,
      enum: ["phone", "email"],
      required: true,
    },
    name: {
      type: String,
      default: null,
    },
    role: {
      type: String,
      enum: ["super-admin", "clinic", "doctor"],
      default: null,
    },
    clinicId: {
      type: String,
      ref: "Clinic",
      default: null,
    },
    doctorId: {
      type: String,
      ref: "Doctor",
      default: null,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    verifiedAt: {
      type: Date,
      default: null,
    },
    passwordHash: {
      type: String,
      default: null,
    },
    temporaryPassword: {
      type: String,
      default: null,
    },
    passwordChangedAt: {
      type: Date,
      default: null,
    },
    lastPasswordReset: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: ["pending", "active", "suspended", "rejected"],
      default: "pending",
    },
    lastLogin: {
      type: Date,
      default: null,
    },
    loginAttempts: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    lockoutUntil: {
      type: Date,
      default: null,
    },
    biometricEnabled: {
      type: Boolean,
      default: false,
    },
    userIdUnique: {
      type: String,
      unique: true,
      sparse: true,
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    deviceApprovals: [
      {
        type: String,
        ref: "DeviceApprovalRequest",
      },
    ],
    approvedDeviceId: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Index for faster queries
UserSchema.index({ contact: 1 });
UserSchema.index({ role: 1 });
UserSchema.index({ clinicId: 1 });
UserSchema.index({ createdAt: -1 });
UserSchema.index({ lockoutUntil: 1 });
UserSchema.index({ loginAttempts: 1 });
UserSchema.index({ userIdUnique: 1 });
UserSchema.index({ isActive: 1 });
UserSchema.index({ approvedDeviceId: 1 });

export const User = mongoose.model<IUser>("User", UserSchema);
