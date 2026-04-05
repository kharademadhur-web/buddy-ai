import { Schema, model, Document } from "mongoose";

export interface IMedicine {
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
  notes?: string;
}

export interface IConsultation extends Document {
  patientId: string;
  doctorId: string;
  clinicId: string;
  startTime: Date;
  endTime?: Date;
  duration?: number; // in minutes
  problem: string;
  symptoms?: string;
  observations?: string;
  diagnosis?: string;
  audioUrl?: string; // S3 path to recording
  transcript?: string; // Speech-to-text output
  summary?: string; // AI-generated summary
  medicines: IMedicine[];
  advice?: string;
  followUpDate?: Date;
  charges: number;
  status: "scheduled" | "in_progress" | "completed" | "cancelled";
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

const consultationSchema = new Schema<IConsultation>(
  {
    patientId: { type: String, required: true, index: true },
    doctorId: { type: String, required: true, index: true },
    clinicId: { type: String, required: true, index: true },
    startTime: { type: Date, default: Date.now },
    endTime: { type: Date },
    duration: { type: Number }, // minutes
    problem: { type: String, required: true },
    symptoms: { type: String },
    observations: { type: String },
    diagnosis: { type: String },
    audioUrl: { type: String },
    transcript: { type: String },
    summary: { type: String },
    medicines: { type: [medicineSchema], default: [] },
    advice: { type: String },
    followUpDate: { type: Date },
    charges: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["scheduled", "in_progress", "completed", "cancelled"],
      default: "scheduled",
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for quick lookup
consultationSchema.index({ clinicId: 1, doctorId: 1, startTime: -1 });
consultationSchema.index({ patientId: 1, createdAt: -1 });
consultationSchema.index({ clinicId: 1, createdAt: -1 });
consultationSchema.index({ status: 1, clinicId: 1 });

export const Consultation = model<IConsultation>(
  "Consultation",
  consultationSchema
);
