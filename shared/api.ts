/**
 * Shared code between client and server
 * Useful to share types between client and server
 * and/or small pure JS functions that can be used on both client and server
 */

/**
 * Example response type for /api/demo
 */
export interface DemoResponse {
  message: string;
}

// ================================================================
// Doctor + Receptionist workflow shared API types
// ================================================================

export type StaffRole = "doctor" | "receptionist" | "independent";

export type AppointmentStatus =
  | "scheduled"
  | "checked_in"
  | "in_consultation"
  | "completed"
  | "cancelled"
  | "no_show";

export type PaymentStatus = "pending" | "paid" | "failed" | "cancelled";
export type PaymentMethod = "cash" | "upi" | "card" | "other";

export interface PatientDTO {
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
}

export interface AppointmentDTO {
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
}

export type ConsultationWorkflowStatus =
  | "draft_rx"
  | "submitted_awaiting_payment"
  | "paid"
  | "cancelled";

export interface ConsultationDTO {
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
  workflow_status?: ConsultationWorkflowStatus | null;
  structured_prescription?: Record<string, unknown> | null;
  handwriting_strokes?: unknown;
  payment_notified_at?: string | null;
}

export interface PrescriptionItemDTO {
  id: string;
  prescription_id: string;
  name: string;
  dosage: string | null;
  frequency: string | null;
  duration: string | null;
  quantity: number | null;
  instructions: string | null;
  created_at: string;
}

export interface PrescriptionDTO {
  id: string;
  clinic_id: string;
  consultation_id: string;
  patient_id: string;
  doctor_user_id: string;
  follow_up_date: string | null;
  notes: string | null;
  created_at: string;
  items?: PrescriptionItemDTO[];
}

export interface BillDTO {
  id: string;
  clinic_id: string;
  appointment_id: string;
  patient_id: string;
  created_by: string | null;
  consultation_fee: string;
  medicine_cost: string;
  total_amount: string;
  payment_status: PaymentStatus;
  payment_method: PaymentMethod | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
}

// Requests / responses
export interface CreatePatientRequest {
  clinicId: string;
  name: string;
  phone: string;
  email?: string;
  dateOfBirth?: string; // YYYY-MM-DD
  gender?: "male" | "female" | "other";
  medicalHistory?: string;
  allergies?: string;
  emergencyContact?: string;
}

export interface CreatePatientResponse {
  success: true;
  patient: PatientDTO;
}

export interface CreateAppointmentRequest {
  clinicId: string;
  patientId: string;
  doctorUserId: string;
  appointmentTime: string; // ISO
  chiefComplaint?: string;
}

export interface CreateAppointmentResponse {
  success: true;
  appointment: AppointmentDTO;
}

export interface CheckInAppointmentRequest {
  chiefComplaint?: string;
  vitals?: Record<string, unknown>;
  intakeHistory?: Record<string, unknown>;
}

export interface CheckInAppointmentResponse {
  success: true;
  appointment: AppointmentDTO;
}

export interface CompleteConsultationRequest {
  clinicId: string;
  appointmentId: string;
  patientId: string;
  diagnosis?: string;
  treatmentPlan?: string;
  notes?: string;
  handwritingStrokes?: unknown;
  aiTranscript?: string;
  aiSummary?: string;
  recordingConsent?: boolean;
  prescription?: {
    notes?: string;
    followUpDate?: string; // YYYY-MM-DD
    items: Array<{
      name: string;
      dosage?: string;
      frequency?: string;
      duration?: string;
      quantity?: number;
      instructions?: string;
    }>;
  };
}

export interface CompleteConsultationResponse {
  success: true;
  consultation: ConsultationDTO;
  prescription: PrescriptionDTO;
}

export interface CreateBillRequest {
  clinicId: string;
  appointmentId: string;
  patientId: string;
  consultationFee: number;
  medicineCost: number;
}

export interface CreateBillResponse {
  success: true;
  bill: BillDTO;
}

export interface PayBillRequest {
  paymentMethod: PaymentMethod;
}

export interface PayBillResponse {
  success: true;
  bill: BillDTO;
}

export type RealtimeEventType =
  | "appointment.created"
  | "appointment.checked_in"
  | "appointment.in_consultation"
  | "appointment.completed"
  | "consultation.completed"
  | "bill.created"
  | "bill.paid"
  | "payment.success";

export interface RealtimeEvent<T = unknown> {
  type: RealtimeEventType;
  clinicId: string;
  at: string; // ISO
  payload: T;
}
