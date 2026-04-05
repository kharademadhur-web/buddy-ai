import { Schema, model, Document } from "mongoose";

export interface IBilling extends Document {
  consultationId: string;
  patientId: string;
  clinicId: string;
  consultationFee: number;
  extraCharges?: number;
  totalAmount: number;
  method?: "cash" | "card" | "upi" | "qr" | "check";
  status: "pending" | "paid" | "cancelled";
  paidAt?: Date;
  invoiceUrl?: string; // S3 path to generated invoice PDF
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const billingSchema = new Schema<IBilling>(
  {
    consultationId: { type: String, required: true, index: true },
    patientId: { type: String, required: true, index: true },
    clinicId: { type: String, required: true, index: true },
    consultationFee: { type: Number, required: true, default: 500 },
    extraCharges: { type: Number, default: 0 },
    totalAmount: { type: Number, required: true },
    method: {
      type: String,
      enum: ["cash", "card", "upi", "qr", "check"],
    },
    status: {
      type: String,
      enum: ["pending", "paid", "cancelled"],
      default: "pending",
    },
    paidAt: { type: Date },
    invoiceUrl: { type: String },
    notes: { type: String },
  },
  {
    timestamps: true,
  }
);

// Compound indexes
billingSchema.index({ clinicId: 1, createdAt: -1 });
billingSchema.index({ status: 1, clinicId: 1 });
billingSchema.index({ patientId: 1, createdAt: -1 });
billingSchema.index({ clinicId: 1, paidAt: -1 });

export const Billing = model<IBilling>("Billing", billingSchema);
