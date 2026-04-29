import type { AppointmentDTO, PatientDTO } from "@shared/api";
import type { Patient } from "@/context/ClinicContext";
import { ageFromDob } from "@/hooks/useClinicWorkflow";

export function appointmentToPatient(
  appt: AppointmentDTO,
  patient: PatientDTO | undefined,
  token: number
): Patient {
  const status: Patient["status"] =
    appt.status === "in_consultation" ? "active" : "waiting";
  return {
    id: patient?.id || appt.patient_id,
    name: patient?.name || "Unknown patient",
    age: ageFromDob(patient?.date_of_birth ?? null),
    gender: patient?.gender ?? null,
    phone: patient?.phone || "",
    symptoms: appt.chief_complaint || "",
    token,
    status,
    createdAt: new Date(appt.created_at),
  };
}
