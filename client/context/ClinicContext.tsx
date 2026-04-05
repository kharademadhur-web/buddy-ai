import React, { createContext, useContext, useState } from "react";

export type UserRole = "doctor" | "reception" | "admin" | "solo-doctor";

export interface Letterhead {
  id: string;
  name: string;
  templateUrl: string;
  clinicName: string;
  clinicAddress: string;
  clinicPhone: string;
  doctorName?: string;
  registrationNumber?: string;
  specialization?: string;
  createdAt: Date;
  isDefault?: boolean;
}

/** UI model for queue / panels (backed by API data in dashboards). */
export interface Patient {
  id: string;
  name: string;
  age: number;
  phone: string;
  symptoms: string;
  token: number;
  status: "waiting" | "active" | "done";
  doctorAssigned?: string;
  feesPaid?: number;
  createdAt: Date;
}

export interface Medicine {
  id: string;
  name: string;
  dosage: string;
  duration: string;
  frequency: string;
}

export interface Prescription {
  id: string;
  patientId: string;
  patientName: string;
  doctorName: string;
  date: Date;
  notes: string;
  medicines: Medicine[];
  status: "draft" | "completed";
}

export interface DiagnosticReport {
  id: string;
  patientId: string;
  patientName: string;
  type: "xray" | "mri" | "ecg" | "sonography" | "blood-test" | "other";
  fileName: string;
  fileUrl: string;
  fileSize: number;
  mimeType: string;
  createdAt: Date;
  uploadedBy: string;
}

export interface Clinic {
  id: string;
  name: string;
  address: string;
  phone: string;
  doctorsAllowed: number;
  receptionAllowed: number;
  email?: string;
  readOnlyMode?: boolean;
  readOnlyReason?: string;
}

export interface User {
  id: string;
  name: string;
  role: UserRole;
  clinicId?: string;
  letterheadId?: string;
  registrationNumber?: string;
  specialization?: string;
  active: boolean;
}

interface ClinicContextType {
  currentUser: User | null;
  currentRole: UserRole | null;
  setCurrentUser: (user: User | null) => void;
  setCurrentRole: (role: UserRole) => void;

  letterheads: Letterhead[];
  addLetterhead: (letterhead: Omit<Letterhead, "id" | "createdAt">) => void;
  deleteLetterhead: (id: string) => void;
  assignLetterheadToDoctor: (doctorId: string, letterheadId: string) => void;
  getDoctorLetterhead: (doctorId: string) => Letterhead | null;
  updateLetterhead: (id: string, letterhead: Partial<Letterhead>) => void;

  clinics: Clinic[];
  doctors: User[];
}

const ClinicContext = createContext<ClinicContextType | undefined>(undefined);

export function ClinicProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentRole, setCurrentRole] = useState<UserRole | null>(null);
  const [letterheads, setLetterheads] = useState<Letterhead[]>([]);

  const addLetterhead = (letterheadData: Omit<Letterhead, "id" | "createdAt">) => {
    const newLetterhead: Letterhead = {
      ...letterheadData,
      id: Date.now().toString(),
      createdAt: new Date(),
    };
    setLetterheads((prev) => [...prev, newLetterhead]);
  };

  const assignLetterheadToDoctor = (_doctorId: string, _letterheadId: string) => {};

  const getDoctorLetterhead = (_doctorId: string): Letterhead | null => null;

  const updateLetterhead = (id: string, updates: Partial<Letterhead>) => {
    setLetterheads((prev) => prev.map((l) => (l.id === id ? { ...l, ...updates } : l)));
  };

  const deleteLetterhead = (id: string) => {
    setLetterheads((prev) => prev.filter((l) => l.id !== id));
  };

  const clinics: Clinic[] = [];
  const doctors: User[] = [];

  return (
    <ClinicContext.Provider
      value={{
        currentUser,
        currentRole,
        setCurrentUser,
        setCurrentRole,
        letterheads,
        addLetterhead,
        deleteLetterhead,
        assignLetterheadToDoctor,
        getDoctorLetterhead,
        updateLetterhead,
        clinics,
        doctors,
      }}
    >
      {children}
    </ClinicContext.Provider>
  );
}

export function useClinic() {
  const context = useContext(ClinicContext);
  if (!context) {
    throw new Error("useClinic must be used within ClinicProvider");
  }
  return context;
}
