import { RequestHandler } from "express";
import {
  generateClinicCode,
  generateUserIdUnique,
  incrementUserIdCounter,
} from "../services/user-id-generator.service";
import {
  generateCredentials,
  logCredentialGeneration,
} from "../services/credential-generator.service";
import { getSupabaseClient } from "../config/supabase";
import { asyncHandler, ValidationError } from "../middleware/error-handler.middleware";

/**
 * Create a new clinic
 */
export const createClinic: RequestHandler = asyncHandler(async (req, res) => {
  const supabase = getSupabaseClient();
  const { name, address, phone, email } = req.body;

  // Validate required fields
  if (!name || !address || !phone || !email) {
    throw new ValidationError("Missing required fields: name, address, phone, email");
  }

  // Check if clinic email already exists
  const { data: existingClinic } = await supabase
    .from("clinics")
    .select("id")
    .eq("email", email)
    .single();

  if (existingClinic) {
    throw new ValidationError("Clinic with this email already exists");
  }

  // Generate clinic code
  const clinicCode = await generateClinicCode(name);

  // Create clinic
  const { data: clinic, error } = await supabase
    .from("clinics")
    .insert({
      name,
      address,
      phone,
      email,
      clinic_code: clinicCode,
      status: "active",
    })
    .select()
    .single();

  if (error || !clinic) {
    throw error || new ValidationError("Failed to create clinic");
  }

  // Log the action
  await supabase.from("audit_logs").insert({
    action: "clinic_created",
    resource_type: "clinic",
    resource_id: clinic.id,
    created_at: new Date().toISOString(),
  });

  res.status(201).json({
    success: true,
    message: "Clinic created successfully",
    data: {
      id: clinic.id,
      name: clinic.name,
      clinic_code: clinic.clinic_code,
      email: clinic.email,
    },
  });
});

/**
 * Add a doctor to a clinic
 */
export const addDoctor: RequestHandler = asyncHandler(async (req, res) => {
  const supabase = getSupabaseClient();
  const {
    clinic_id,
    name,
    phone,
    email,
    license_number,
    aadhaar_url,
    pan_url,
    signature_url,
  } = req.body;

  // Validate required fields
  if (!clinic_id || !name || !email || !license_number) {
    throw new ValidationError("Missing required fields: clinic_id, name, email, license_number");
  }

  // Verify clinic exists and get clinic code
  const { data: clinic, error: clinicError } = await supabase
    .from("clinics")
    .select("clinic_code")
    .eq("id", clinic_id)
    .single();

  if (clinicError || !clinic) {
    throw new ValidationError("Clinic not found");
  }

  // Check if user with this email already exists
  const { data: existingUser } = await supabase
    .from("users")
    .select("id")
    .eq("email", email)
    .single();

  if (existingUser) {
    throw new ValidationError("User with this email already exists");
  }

  // Generate unique user ID
  const user_id = await generateUserIdUnique(clinic.clinic_code, "doctor");

  // Generate credentials
  const credentials = await generateCredentials(user_id);

  // Create user
  const { data: user, error: userError } = await supabase
    .from("users")
    .insert({
      name,
      phone,
      email,
      role: "doctor",
      clinic_id,
      user_id,
      password_hash: credentials.password_hash,
      is_active: true,
      login_attempts: 0,
    })
    .select()
    .single();

  if (userError || !user) {
    throw userError || new ValidationError("Failed to create user");
  }

  // Create doctor profile
  const { data: doctor, error: doctorError } = await supabase
    .from("doctors")
    .insert({
      user_id: user.id,
      license_number,
      aadhaar_encrypted: null,
      pan_encrypted: null,
      signature_url,
    })
    .select()
    .single();

  if (doctorError || !doctor) {
    console.error("Doctor profile creation error:", doctorError);
  }

  // Increment counter for next user
  await incrementUserIdCounter(clinic.clinic_code, "doctor");

  // Log the action
  await logCredentialGeneration(user.id, "created");

  res.status(201).json({
    success: true,
    message: "Doctor added successfully",
    data: {
      id: user.id,
      user_id: user.user_id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      temporary_password: credentials.password,
      role: "doctor",
    },
  });
});

/**
 * Add a receptionist to a clinic
 */
export const addReceptionist: RequestHandler = asyncHandler(async (req, res) => {
  const supabase = getSupabaseClient();
  const { clinic_id, name, phone, email } = req.body;

  // Validate required fields
  if (!clinic_id || !name || !email) {
    throw new ValidationError("Missing required fields: clinic_id, name, email");
  }

  // Verify clinic exists and get clinic code
  const { data: clinic, error: clinicError } = await supabase
    .from("clinics")
    .select("clinic_code")
    .eq("id", clinic_id)
    .single();

  if (clinicError || !clinic) {
    throw new ValidationError("Clinic not found");
  }

  // Check if user with this email already exists
  const { data: existingUser } = await supabase
    .from("users")
    .select("id")
    .eq("email", email)
    .single();

  if (existingUser) {
    throw new ValidationError("User with this email already exists");
  }

  // Generate unique user ID
  const user_id = await generateUserIdUnique(clinic.clinic_code, "receptionist");

  // Generate credentials
  const credentials = await generateCredentials(user_id);

  // Create user
  const { data: user, error: userError } = await supabase
    .from("users")
    .insert({
      name,
      phone,
      email,
      role: "receptionist",
      clinic_id,
      user_id,
      password_hash: credentials.password_hash,
      is_active: true,
      login_attempts: 0,
    })
    .select()
    .single();

  if (userError || !user) {
    throw userError || new ValidationError("Failed to create user");
  }

  // Create receptionist profile
  const { error: receptionistError } = await supabase
    .from("receptionists")
    .insert({
      user_id: user.id,
    });

  if (receptionistError) {
    console.error("Receptionist profile creation error:", receptionistError);
  }

  // Increment counter for next user
  await incrementUserIdCounter(clinic.clinic_code, "receptionist");

  // Log the action
  await logCredentialGeneration(user.id, "created");

  res.status(201).json({
    success: true,
    message: "Receptionist added successfully",
    data: {
      id: user.id,
      user_id: user.user_id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      temporary_password: credentials.password,
      role: "receptionist",
    },
  });
});

/**
 * Get onboarding status for a clinic
 */
export const getOnboardingStatus: RequestHandler = asyncHandler(async (req, res) => {
  const supabase = getSupabaseClient();
  const { clinic_id } = req.params;

  // Get clinic
  const { data: clinic, error: clinicError } = await supabase
    .from("clinics")
    .select("*")
    .eq("id", clinic_id)
    .single();

  if (clinicError || !clinic) {
    throw new ValidationError("Clinic not found");
  }

  // Get user counts
  const { data: doctors } = await supabase
    .from("users")
    .select("id", { count: "exact" })
    .eq("clinic_id", clinic_id)
    .eq("role", "doctor");

  const { data: receptionists } = await supabase
    .from("users")
    .select("id", { count: "exact" })
    .eq("clinic_id", clinic_id)
    .eq("role", "receptionist");

  res.json({
    success: true,
    data: {
      clinic: {
        id: clinic.id,
        name: clinic.name,
        email: clinic.email,
        clinic_code: clinic.clinic_code,
      },
      doctors_count: doctors?.length || 0,
      receptionists_count: receptionists?.length || 0,
      status: clinic.status,
    },
  });
});
