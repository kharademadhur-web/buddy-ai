import mongoose, { Schema, Document } from "mongoose";

export type KYCStatus = "pending" | "approved" | "rejected";

export interface IReceptionistProfile extends Document {
  _id: string;
  userId: string; // ref: User
  clinicId: string; // ref: Clinic
  
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

const ReceptionistProfileSchema = new Schema<IReceptionistProfile>(
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
ReceptionistProfileSchema.index({ userId: 1 });
ReceptionistProfileSchema.index({ clinicId: 1 });
ReceptionistProfileSchema.index({ kycStatus: 1 });
ReceptionistProfileSchema.index({ isActive: 1 });
ReceptionistProfileSchema.index({ createdAt: -1 });

export const ReceptionistProfile = mongoose.model<IReceptionistProfile>(
  "ReceptionistProfile",
  ReceptionistProfileSchema
);
