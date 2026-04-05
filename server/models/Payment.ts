import mongoose, { Schema, Document } from "mongoose";

export type PaymentMethod = "card" | "upi" | "cash";
export type PaymentStatus = "paid" | "pending" | "overdue" | "failed";

export interface IPayment extends Document {
  _id: string;
  clinicId: string; // ref: Clinic
  amount: number;
  method: PaymentMethod;
  status: PaymentStatus;
  
  // Razorpay Integration
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  razorpaySignature?: string;
  
  // Invoice
  invoiceUrl?: string;
  invoiceNumber?: string;
  
  // Metadata
  description?: string;
  transactionDate: Date;
  createdAt: Date;
  updatedAt: Date;
}

const PaymentSchema = new Schema<IPayment>(
  {
    clinicId: {
      type: String,
      ref: "Clinic",
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    method: {
      type: String,
      enum: ["card", "upi", "cash"],
      required: true,
    },
    status: {
      type: String,
      enum: ["paid", "pending", "overdue", "failed"],
      default: "pending",
    },
    razorpayOrderId: {
      type: String,
      default: null,
      trim: true,
    },
    razorpayPaymentId: {
      type: String,
      default: null,
      trim: true,
    },
    razorpaySignature: {
      type: String,
      default: null,
      trim: true,
    },
    invoiceUrl: {
      type: String,
      default: null,
    },
    invoiceNumber: {
      type: String,
      default: null,
      trim: true,
    },
    description: {
      type: String,
      default: null,
      trim: true,
    },
    transactionDate: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
PaymentSchema.index({ clinicId: 1 });
PaymentSchema.index({ status: 1 });
PaymentSchema.index({ transactionDate: -1 });
PaymentSchema.index({ razorpayPaymentId: 1 });

export const Payment = mongoose.model<IPayment>("Payment", PaymentSchema);
