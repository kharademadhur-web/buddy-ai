import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-base";
import type { AppointmentDTO, PatientDTO } from "@shared/api";

export function ageFromDob(dob: string | null | undefined): number {
  if (!dob) return 0;
  const birth = new Date(dob);
  if (Number.isNaN(birth.getTime())) return 0;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return Math.max(0, age);
}

export function useQueueAndPatients(
  clinicId: string | null,
  options?: { doctorUserId?: string | null; pollMs?: number }
) {
  const [queue, setQueue] = useState<AppointmentDTO[]>([]);
  const [patientsById, setPatientsById] = useState<Record<string, PatientDTO>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const doctorUserId = options?.doctorUserId;
  const pollMs = options?.pollMs ?? 15000;

  const load = useCallback(async () => {
    if (!clinicId) return;
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ clinicId });
      if (doctorUserId) qs.set("doctorId", doctorUserId);
      const res = await apiFetch(`/api/queue?${qs.toString()}`);
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Failed to load queue");
      const list: AppointmentDTO[] = j.queue || [];
      setQueue(list);

      const pres = await apiFetch(`/api/patients?clinicId=${encodeURIComponent(clinicId)}&limit=50`);
      const pj = await pres.json();
      if (!pres.ok) throw new Error(pj.error || "Failed to load patients");
      const map: Record<string, PatientDTO> = {};
      for (const p of pj.patients || []) map[p.id] = p;
      setPatientsById(map);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, [clinicId, doctorUserId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const t = setInterval(() => void load(), pollMs);
    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(t);
      window.removeEventListener("focus", onFocus);
    };
  }, [load, pollMs]);

  return { queue, patientsById, loading, error, refetch: load };
}

export function useBillingSummary(clinicId: string | null, date?: string) {
  const [summary, setSummary] = useState<{
    totalCollected: number;
    completedToday: number;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!clinicId) return;
    setLoading(true);
    try {
      const qs = new URLSearchParams({ clinicId });
      if (date) qs.set("date", date);
      const res = await apiFetch(`/api/billing/summary?${qs.toString()}`);
      const j = await res.json();
      if (res.ok && j.success) setSummary(j.summary);
      else setSummary(null);
    } catch {
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [clinicId, date]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const t = setInterval(() => void load(), 20000);
    return () => clearInterval(t);
  }, [load]);

  return { summary, loading, refetch: load };
}
