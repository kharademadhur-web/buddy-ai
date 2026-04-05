import mongoose, { Schema, Document } from "mongoose";

export type SubscriptionStatus = "active" | "expired" | "suspended";
export type PlanType = "monthly" | "yearly";

export interface ISubscription extends Document {
  _id: string;
  clinicId: string; // ref: Clinic
  planType: PlanType;
  startDate: Date;
  endDate: Date;
  status: SubscriptionStatus;
  nextBillingDate: Date;
  autoPayEnabled: boolean;
  remindersSent: number;
  createdAt: Date;
  updatedAt: Date;
}

const SubscriptionSchema = new Schema<ISubscription>(
  {
    clinicId: {
      type: String,
      ref: "Clinic",
      required: true,
      unique: true,
    },
    planType: {
      type: String,
      enum: ["monthly", "yearly"],
      required: true,
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ["active", "expired", "suspended"],
      default: "active",
    },
    nextBillingDate: {
      type: Date,
      required: true,
    },
    autoPayEnabled: {
      type: Boolean,
      default: false,
    },
    remindersSent: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
SubscriptionSchema.index({ clinicId: 1 });
SubscriptionSchema.index({ status: 1 });
SubscriptionSchema.index({ endDate: 1 });
SubscriptionSchema.index({ nextBillingDate: 1 });

export const Subscription = mongoose.model<ISubscription>(
  "Subscription",
  SubscriptionSchema
);
