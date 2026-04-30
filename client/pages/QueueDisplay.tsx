import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api-base";
import { Clock, Users } from "lucide-react";

type QueueAppt = {
  id: string;
  status: string;
  appointment_time?: string | null;
  token_number?: number | string | null;
  patients?: { name?: string | null } | null;
};

export default function QueueDisplay() {
  const params = new URLSearchParams(window.location.search);
  const clinicId = params.get("clinicId") || "";
  const [current, setCurrent] = useState<QueueAppt | null>(null);
  const [next, setNext] = useState<QueueAppt[]>([]);
  const [updatedAt, setUpdatedAt] = useState("");

  const load = async () => {
    if (!clinicId) return;
    const res = await apiFetch(`/api/queue/public-display?clinicId=${encodeURIComponent(clinicId)}`);
    const data = await res.json();
    if (data.success) {
      setCurrent(data.current || null);
      setNext(data.next || []);
      setUpdatedAt(data.updatedAt || new Date().toISOString());
    }
  };

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 30_000);
    return () => clearInterval(t);
  }, [clinicId]);

  const time = useMemo(
    () => (updatedAt ? new Date(updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""),
    [updatedAt]
  );

  const displayName = (a: QueueAppt | null) => a?.patients?.name || "Waiting";
  const token = (a: QueueAppt | null) => (a?.token_number ? `#${a.token_number}` : "");

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-950 via-blue-900 to-slate-900 text-white p-6 sm:p-10">
      <div className="mx-auto max-w-5xl">
        <div className="flex items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-4xl sm:text-6xl font-black tracking-tight">Queue Display</h1>
            <p className="text-blue-200 mt-2 text-lg">Please wait for your token to be called.</p>
          </div>
          <div className="flex items-center gap-2 text-blue-100 text-lg">
            <Clock className="w-6 h-6" />
            {time}
          </div>
        </div>

        {!clinicId ? (
          <div className="rounded-3xl bg-white/10 border border-white/20 p-8 text-2xl">
            Missing clinicId. Use <code>/queue-display?clinicId=...</code>
          </div>
        ) : (
          <div className="grid gap-6">
            <section className="rounded-3xl bg-white text-slate-950 p-8 shadow-2xl">
              <p className="text-sm font-bold uppercase tracking-widest text-blue-700 mb-3">Now Consulting</p>
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-5xl sm:text-7xl font-black">{displayName(current)}</p>
                  <p className="mt-3 text-3xl font-bold text-blue-700">{token(current)}</p>
                </div>
                <Users className="hidden sm:block w-20 h-20 text-blue-100" />
              </div>
            </section>

            <section className="rounded-3xl bg-white/10 border border-white/20 p-6">
              <p className="text-sm font-bold uppercase tracking-widest text-blue-200 mb-4">Next Patients</p>
              <div className="grid sm:grid-cols-3 gap-4">
                {next.length ? (
                  next.map((a, i) => (
                    <div key={a.id} className="rounded-2xl bg-white/10 p-5 border border-white/10">
                      <p className="text-blue-200 text-sm font-semibold">Next {i + 1}</p>
                      <p className="text-2xl font-bold mt-1">{displayName(a)}</p>
                      <p className="text-xl text-blue-100 mt-1">{token(a)}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-blue-100 text-xl">No patients waiting.</p>
                )}
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
