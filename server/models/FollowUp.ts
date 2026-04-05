import mongoose, { Schema, Document } from "mongoose";

export type FollowUpStatus = "pending" | "sent" | "completed" | "missed";

export interface IFollowUp extends Document {
  _id: string;
  patientId: string;
  doctorId: string;
  clinicId: string; // ref: Clinic
  
  scheduledDate: Date;
  reminderSent: boolean;
  sentAt?: Date;
  
  status: FollowUpStatus;
  notes?: string;
  
  // Notification
  notificationChannel?: "whatsapp" | "sms" | "email";
  notificationSentAt?: Date;
  
  createdAt: Date;
  updatedAt: Date;
}

const FollowUpSchema = new Schema<IFollowUp>(
  {
    patientId: {
      type: String,
      required: true,
    },
    doctorId: {
      type: String,
      required: true,
    },
    clinicId: {
      type: String,
      ref: "Clinic",
      required: true,
    },
    scheduledDate: {
      type: Date,
      required: true,
    },
    reminderSent: {
      type: Boolean,
      default: false,
    },
    sentAt: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: ["pending", "sent", "completed", "missed"],
      default: "pending",
    },
    notes: {
      type: String,
      default: null,
      trim: true,
    },
    notificationChannel: {
      type: String,
      enum: ["whatsapp", "sms", "email"],
      default: "whatsapp",
    },
    notificationSentAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
FollowUpSchema.index({ clinicId: 1 });
FollowUpSchema.index({ patientId: 1 });
FollowUpSchema.index({ doctorId: 1 });
FollowUpSchema.index({ scheduledDate: 1 });
FollowUpSchema.index({ status: 1 });
FollowUpSchema.index({ createdAt: -1 });

export const FollowUp = mongoose.model<IFollowUp>(
  "FollowUp",
  FollowUpSchema
);
