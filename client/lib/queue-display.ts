import type { Patient } from "@/context/ClinicContext";

/** Uppercase labels aligned with ops / QA expectations (queue + active patient). */
export function queueStatusLabel(status: Patient["status"]): string {
  switch (status) {
    case "active":
      return "IN CONSULTATION";
    case "done":
      return "DONE";
    default:
      return "WAITING";
  }
}
