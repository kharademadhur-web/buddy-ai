export type AppointmentStatus =
  | "scheduled"
  | "checked_in"
  | "in_consultation"
  | "completed"
  | "cancelled"
  | "no_show";

export type AppointmentDTO = {
  id: string;
  clinic_id: string;
  patient_id: string;
  doctor_user_id: string;
  receptionist_user_id: string | null;
  appointment_time: string;
  status: AppointmentStatus;
  chief_complaint: string | null;
  checked_in_by: string | null;
  checked_in_time: string | null;
  vitals: Record<string, unknown> | null;
  intake_history: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

export type PatientDTO = {
  id: string;
  clinic_id: string;
  name: string;
  phone: string;
  email: string | null;
  date_of_birth: string | null;
  gender: "male" | "female" | "other" | null;
  medical_history: string | null;
  allergies: string | null;
  emergency_contact: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type ConsultationDTO = {
  id: string;
  clinic_id: string;
  appointment_id: string;
  patient_id: string;
  doctor_user_id: string;
  diagnosis: string | null;
  treatment_plan: string | null;
  notes: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

