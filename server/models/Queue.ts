import { Schema, model, Document } from "mongoose";

export interface IQueue extends Document {
  patientId: string;
  clinicId: string;
  status: "waiting" | "called" | "in_consultation" | "completed" | "left";
  position: number; // 1, 2, 3, etc.
  estimatedWaitTime?: number; // in minutes
  checkedInAt: Date;
  calledAt?: Date;
  consultationStartedAt?: Date;
  completedAt?: Date;
  leftAt?: Date;
  notes?: string;
  updatedAt: Date;
}

const queueSchema = new Schema<IQueue>(
  {
    patientId: { type: String, required: true, index: true },
    clinicId: { type: String, required: true, index: true },
    status: {
      type: String,
      enum: ["waiting", "called", "in_consultation", "completed", "left"],
      default: "waiting",
    },
    position: { type: Number, required: true, default: 1 },
    estimatedWaitTime: { type: Number }, // minutes
    checkedInAt: { type: Date, default: Date.now },
    calledAt: { type: Date },
    consultationStartedAt: { type: Date },
    completedAt: { type: Date },
    leftAt: { type: Date },
    notes: { type: String },
  },
  {
    timestamps: false,
  }
);

// Indexes for queue operations
queueSchema.index({ clinicId: 1, status: 1, position: 1 });
queueSchema.index({ clinicId: 1, checkedInAt: -1 });
queueSchema.index({ status: 1, clinicId: 1 });

export const Queue = model<IQueue>("Queue", queueSchema);
