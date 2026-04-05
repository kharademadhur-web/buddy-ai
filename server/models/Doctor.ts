import mongoose, { Schema, Document } from "mongoose";

export type KYCStatus = "pending" | "approved" | "rejected";

export interface IDoctor extends Document {
  _id: string;
  userId: string; // ref: User
  clinicId: string; // ref: Clinic
  
  // Personal Info
  name: string;
  email: string;
  phone: string;
  address: string;
  
  // Professional Info
  licenseNumber: string;
  licenseValidTill: Date;
  registrationNumber: string;
  specialization?: string;
  
  // KYC Documents
  aadhaar: string;
  pan: string;
  photoUrl?: string;
  signatureUrl?: string;
  
  // KYC Verification
  kycStatus: KYCStatus;
  verifiedBy?: string; // ref: User (admin who verified)
  verificationNotes?: string;
  verifiedAt?: Date;
  
  // Account Status
  isActive: boolean;
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
}

const DoctorSchema = new Schema<IDoctor>(
  {
    userId: {
      type: String,
      ref: "User",
      required: true,
      unique: true,
    },
    clinicId: {
      type: String,
      ref: "Clinic",
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    address: {
      type: String,
      required: true,
      trim: true,
    },
    licenseNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    licenseValidTill: {
      type: Date,
      required: true,
    },
    registrationNumber: {
      type: String,
      required: true,
      trim: true,
    },
    specialization: {
      type: String,
      default: null,
      trim: true,
    },
    aadhaar: {
      type: String,
      required: true,
      trim: true,
    },
    pan: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    photoUrl: {
      type: String,
      default: null,
    },
    signatureUrl: {
      type: String,
      default: null,
    },
    kycStatus: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    verifiedBy: {
      type: String,
      ref: "User",
      default: null,
    },
    verificationNotes: {
      type: String,
      default: null,
    },
    verifiedAt: {
      type: Date,
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
DoctorSchema.index({ userId: 1 });
DoctorSchema.index({ clinicId: 1 });
DoctorSchema.index({ licenseNumber: 1 });
DoctorSchema.index({ kycStatus: 1 });
DoctorSchema.index({ createdAt: -1 });

export const Doctor = mongoose.model<IDoctor>("Doctor", DoctorSchema);
