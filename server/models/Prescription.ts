import { Schema, model, Document } from "mongoose";

export interface IPrescription extends Document {
  consultationId: string;
  patientId: string;
  doctorId: string;
  clinicId: string;
  summary: string;
  medicines: Array<{
    name: string;
    dosage: string;
    frequency: string;
    duration: string;
    notes?: string;
  }>;
  advice?: string;
  followUpDate?: Date;
  diagnosis?: string;
  investigations?: string;
  pdfUrl?: string; // S3 path to generated PDF
  status: "draft" | "finalized" | "sent" | "printed";
  createdAt: Date;
  updatedAt: Date;
}

const medicineSchema = new Schema(
  {
    name: { type: String, required: true },
    dosage: { type: String, required: true },
    frequency: { type: String, required: true },
    duration: { type: String, required: true },
    notes: { type: String },
  },
  { _id: false }
);

const prescriptionSchema = new Schema<IPrescription>(
  {
    consultationId: { type: String, required: true, index: true },
    patientId: { type: String, required: true, index: true },
    doctorId: { type: String, required: true, index: true },
    clinicId: { type: String, required: true, index: true },
    summary: { type: String, required: true },
    medicines: { type: [medicineSchema], default: [] },
    advice: { type: String },
    followUpDate: { type: Date },
    diagnosis: { type: String },
    investigations: { type: String },
    pdfUrl: { type: String },
    status: {
      type: String,
      enum: ["draft", "finalized", "sent", "printed"],
      default: "draft",
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes
prescriptionSchema.index({ patientId: 1, createdAt: -1 });
prescriptionSchema.index({ clinicId: 1, createdAt: -1 });
prescriptionSchema.index({ consultationId: 1 });
prescriptionSchema.index({ status: 1, clinicId: 1 });

export const Prescription = model<IPrescription>(
  "Prescription",
  prescriptionSchema
);
