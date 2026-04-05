import mongoose, { Schema, Document } from "mongoose";

export interface IRole extends Document {
  _id: string;
  name: string;
  description: string;
  permissions: string[];
  isSystem: boolean;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const RoleSchema = new Schema<IRole>(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    description: {
      type: String,
      default: "",
    },
    permissions: {
      type: [String],
      default: [],
    },
    isSystem: {
      type: Boolean,
      default: false,
    },
    createdBy: {
      type: String,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Index for role lookups
RoleSchema.index({ name: 1 });
RoleSchema.index({ isSystem: 1 });

export const Role = mongoose.model<IRole>("Role", RoleSchema);

// Seed system roles on first run
export async function seedSystemRoles() {
  try {
    const systemRoles = [
      {
        name: "Doctor",
        description: "Doctor role with clinical access",
        permissions: [
          "create_patient",
          "view_patient",
          "edit_patient",
          "create_consultation",
          "view_consultation",
          "create_prescription",
          "view_prescription",
        ],
        isSystem: true,
      },
      {
        name: "Receptionist",
        description: "Receptionist role with appointment and patient management",
        permissions: [
          "view_patient",
          "create_patient",
          "view_consultation",
          "create_followup",
          "view_billing",
        ],
        isSystem: true,
      },
      {
        name: "Independent Doctor",
        description: "Solo practice doctor role",
        permissions: [
          "create_patient",
          "view_patient",
          "edit_patient",
          "create_consultation",
          "view_consultation",
          "create_prescription",
          "view_prescription",
          "manage_billing",
          "view_billing",
        ],
        isSystem: true,
      },
    ];

    for (const roleData of systemRoles) {
      const exists = await Role.findOne({ name: roleData.name });
      if (!exists) {
        await Role.create(roleData);
      }
    }
  } catch (error) {
    console.error("Error seeding system roles:", error);
  }
}
