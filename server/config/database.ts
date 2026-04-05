import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/clinic-saas";

export async function connectDatabase() {
  try {
    await mongoose.connect(MONGODB_URI, {
      retryWrites: true,
      w: "majority",
    });

    console.log("✅ MongoDB connected successfully");
    return mongoose.connection;
  } catch (error) {
    console.error("❌ MongoDB connection error:", error);
    process.exit(1);
  }
}

export function disconnectDatabase() {
  return mongoose.disconnect();
}

export default mongoose;
