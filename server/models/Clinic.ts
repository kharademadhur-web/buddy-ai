import mongoose, { Schema, Document } from "mongoose";

export type ClinicStatus = "pending" | "active" | "suspended" | "inactive";

export interface IClinic extends Document {
  _id: string;
  name: string;
  email: string;
  phone: string;
  location: string;
  address: string;
  registrationNumber?: string;
  adminId: string; // ref: User
  status: ClinicStatus;
  subscriptionId?: string; // ref: Subscription
  isActive: boolean;
  suspensionReason?: string;

  // New fields for onboarding and access control
  clinicCode?: string; // e.g., CITY-MED
  inactiveUsersCount: number; // Count of inactive users (doctors/receptionists)
  readOnlyMode: boolean; // Admin can toggle access
  readOnlyReason?: string; // Reason for read-only mode
  paymentStatus: "paid" | "pending" | "overdue";
  lastPaymentDate?: Date;

  createdAt: Date;
  updatedAt: Date;
}

const ClinicSchema = new Schema<IClinic>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    location: {
      type: String,
      required: true,
      trim: true,
    },
    address: {
      type: String,
      required: true,
      trim: true,
    },
    registrationNumber: {
      type: String,
      default: null,
      trim: true,
    },
    adminId: {
      type: String,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "active", "suspended", "inactive"],
      default: "pending",
    },
    subscriptionId: {
      type: String,
      ref: "Subscription",
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    suspensionReason: {
      type: String,
      default: null,
    },
    clinicCode: {
      type: String,
      unique: true,
      sparse: true,
      default: null,
    },
    inactiveUsersCount: {
      type: Number,
      default: 0,
    },
    readOnlyMode: {
      type: Boolean,
      default: false,
    },
    readOnlyReason: {
      type: String,
      default: null,
    },
    paymentStatus: {
      type: String,
      enum: ["paid", "pending", "overdue"],
      default: "pending",
    },
    lastPaymentDate: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
ClinicSchema.index({ adminId: 1 });
ClinicSchema.index({ email: 1 });
ClinicSchema.index({ status: 1 });
ClinicSchema.index({ location: 1 });
ClinicSchema.index({ createdAt: -1 });
ClinicSchema.index({ clinicCode: 1 });
ClinicSchema.index({ readOnlyMode: 1 });
ClinicSchema.index({ paymentStatus: 1 });

export const Clinic = mongoose.model<IClinic>("Clinic", ClinicSchema);
