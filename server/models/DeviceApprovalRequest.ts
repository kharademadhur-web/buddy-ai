import mongoose, { Schema, Document } from "mongoose";

export type ApprovalStatus = "pending" | "approved" | "rejected";

export interface IDeviceApprovalRequest extends Document {
  _id: string;
  userId: string; // ref: User
  deviceId: string; // Device fingerprint/ID
  deviceInfo: {
    userAgent?: string;
    ipAddress?: string;
    timestamp: Date;
  };
  status: ApprovalStatus;
  approvedBy?: string; // ref: User (admin)
  approvedAt?: Date;
  rejectionReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const DeviceApprovalRequestSchema = new Schema<IDeviceApprovalRequest>(
  {
    userId: {
      type: String,
      ref: "User",
      required: true,
    },
    deviceId: {
      type: String,
      required: true,
    },
    deviceInfo: {
      userAgent: {
        type: String,
        default: null,
      },
      ipAddress: {
        type: String,
        default: null,
      },
      timestamp: {
        type: Date,
        required: true,
      },
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    approvedBy: {
      type: String,
      ref: "User",
      default: null,
    },
    approvedAt: {
      type: Date,
      default: null,
    },
    rejectionReason: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
DeviceApprovalRequestSchema.index({ userId: 1 });
DeviceApprovalRequestSchema.index({ deviceId: 1 });
DeviceApprovalRequestSchema.index({ status: 1 });
DeviceApprovalRequestSchema.index({ createdAt: -1 });
DeviceApprovalRequestSchema.index({ userId: 1, deviceId: 1 });

export const DeviceApprovalRequest = mongoose.model<IDeviceApprovalRequest>(
  "DeviceApprovalRequest",
  DeviceApprovalRequestSchema
);
