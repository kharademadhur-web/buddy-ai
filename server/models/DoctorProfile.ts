import mongoose, { Schema, Document } from "mongoose";

export type KYCStatus = "pending" | "approved" | "rejected";

export interface IDoctorProfile extends Document {
  _id: string;
  userId: string; // ref: User
  clinicId: string; // ref: Clinic
  licenseNumber: string;
  registrationNumber?: string;
  specialization?: string;
  address: string;
  
  // KYC Documents
  panDocumentUrl?: string;
  aadhaarDocumentUrl?: string;
  signatureUrl?: string;
  
  // KYC Status
  kycStatus: KYCStatus;
  kycApprovedBy?: string; // ref: User (admin)
  kycApprovedAt?: Date;
  kycRejectionReason?: string;
  
  // Status
  isActive: boolean;
  
  createdAt: Date;
  updatedAt: Date;
}

const DoctorProfileSchema = new Schema<IDoctorProfile>(
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
    licenseNumber: {
      type: String,
      required: true,
      trim: true,
    },
    registrationNumber: {
      type: String,
      default: null,
      trim: true,
    },
    specialization: {
      type: String,
      default: null,
      trim: true,
    },
    address: {
      type: String,
      required: true,
      trim: true,
    },
    panDocumentUrl: {
      type: String,
      default: null,
    },
    aadhaarDocumentUrl: {
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
    kycApprovedBy: {
      type: String,
      ref: "User",
      default: null,
    },
    kycApprovedAt: {
      type: Date,
      default: null,
    },
    kycRejectionReason: {
      type: String,
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
DoctorProfileSchema.index({ userId: 1 });
DoctorProfileSchema.index({ clinicId: 1 });
DoctorProfileSchema.index({ kycStatus: 1 });
DoctorProfileSchema.index({ isActive: 1 });
DoctorProfileSchema.index({ createdAt: -1 });

export const DoctorProfile = mongoose.model<IDoctorProfile>(
  "DoctorProfile",
  DoctorProfileSchema
);
