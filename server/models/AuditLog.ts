import { Schema, model, Document } from "mongoose";

export interface IAuditLog extends Document {
  userId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  clinicId: string;
  description: string;
  status: "success" | "failure";
  ipAddress?: string;
  userAgent?: string;
  changes?: Record<string, any>; // before/after for edits
  timestamp: Date;
  targetUserId?: string; // For admin actions on other users
  details?: Record<string, any>; // Additional context
}

const auditLogSchema = new Schema<IAuditLog>(
  {
    userId: { type: String, required: true, index: true },
    action: {
      type: String,
      required: true,
      enum: [
        "login",
        "logout",
        "login_failed",
        "password_change",
        "password_reset",
        "password_reset_requested",
        "otp_sent",
        "otp_verified",
        "biometric_registered",
        "biometric_login",
        "account_locked",
        "account_unlocked",
        "user_created",
        "user_edited",
        "user_deactivated",
        "role_assigned",
        "role_created",
        "role_edited",
        "role_deleted",
        "permission_assigned",
        "create_patient",
        "edit_patient",
        "view_patient",
        "delete_patient",
        "start_consultation",
        "end_consultation",
        "create_prescription",
        "edit_prescription",
        "view_prescription",
        "generate_pdf",
        "send_whatsapp",
        "create_billing",
        "mark_payment",
        "view_billing",
        "create_followup",
        "send_followup",
        "edit_permissions",
        "edit_letterhead",
        "export_data",
      ],
    },
    resourceType: { type: String, required: true }, // patient, consultation, prescription, billing, etc.
    resourceId: { type: String, required: true, index: true },
    clinicId: { type: String, required: true, index: true },
    description: { type: String, required: true },
    status: {
      type: String,
      enum: ["success", "failure"],
      default: "success",
    },
    ipAddress: { type: String },
    userAgent: { type: String },
    changes: { type: Schema.Types.Mixed },
    targetUserId: { type: String, default: null },
    details: { type: Schema.Types.Mixed },
    timestamp: { type: Date, default: Date.now, index: true },
  },
  {
    timestamps: false,
  }
);

// Indexes for audit queries
auditLogSchema.index({ clinicId: 1, timestamp: -1 });
auditLogSchema.index({ userId: 1, timestamp: -1 });
auditLogSchema.index({ action: 1, clinicId: 1 });
auditLogSchema.index({ resourceId: 1, timestamp: -1 });

export const AuditLog = model<IAuditLog>("AuditLog", auditLogSchema);
