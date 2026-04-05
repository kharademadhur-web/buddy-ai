import { Schema, model, Document } from "mongoose";

export interface IPatient extends Document {
  clinicId: string;
  name: string;
  phone: string;
  email?: string;
  dateOfBirth?: Date;
  gender?: "male" | "female" | "other";
  problem: string;
  medicalHistory?: string;
  allergies?: string;
  emergencyContact?: string;
  registeredAt: Date;
  lastVisit?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const patientSchema = new Schema<IPatient>(
  {
    clinicId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    phone: { type: String, required: true, index: true },
    email: { type: String, sparse: true },
    dateOfBirth: { type: Date },
    gender: { type: String, enum: ["male", "female", "other"] },
    problem: { type: String, required: true },
    medicalHistory: { type: String },
    allergies: { type: String },
    emergencyContact: { type: String },
    registeredAt: { type: Date, default: Date.now },
    lastVisit: { type: Date },
  },
  {
    timestamps: true,
  }
);

// Compound index for quick lookup by clinic and phone
patientSchema.index({ clinicId: 1, phone: 1 });
// Index for clinic patient list
patientSchema.index({ clinicId: 1, registeredAt: -1 });

export const Patient = model<IPatient>("Patient", patientSchema);
