import { useEffect, useState } from "react";
import { CheckCircle2, Clock, Loader2, X, AlertTriangle, Users, Pill, DollarSign } from "lucide-react";
import { apiFetch, apiErrorMessage, errorMessageFromUnknown } from "@/lib/api-base";
import { useAdminAuth } from "@/context/AdminAuthContext";
import { useDoctorPortal } from "@/context/DoctorPortalContext";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type ConsultationRow = {
  id: string;
  workflow_status: string;
  appointments?: {
    check_in_time: string;
    patients?: { name?: string; phone?: string | null } | null;
  } | null;
};

type SummaryCard = {
  totalSeen: number;
  totalPending: number;
  totalPrescriptions: number;
  revenue: number;
  date: string;
};

type Props = {
  className?: string;
};

export default function CloseDayButton({ className }: Props) {
  const { tokens, user } = useAdminAuth();
  const { clinicId } = useDoctorPortal();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [consultations, setConsultations] = useState<ConsultationRow[]>([]);
  const [closing, setClosing] = useState(false);
  const [summary, setSummary] = useState<SummaryCard | null>(null);

  const authHeader = () => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${tokens?.accessToken || sessionStorage.getItem("admin_access_token") || ""}`,
  });

  const today = new Date().toISOString().slice(0, 10);

  const fetchToday = async () => {
    if (!clinicId) return;
    setLoading(true);
    try {
      const res = await apiFetch(
        `/api/consultations/today-summary?clinicId=${encodeURIComponent(clinicId)}&date=${today}`,
        { headers: authHeader() }
      );
      const data = await res.json();
      if (data.success) setConsultations(data.consultations || []);
    } catch (e) {
      toast.error(errorMessageFromUnknown(e, "Could not load today's consultations"));
    } finally {
      setLoading(false);
    }
  };

  const handleOpen = () => {
    setOpen(true);
    setSummary(null);
    void fetchToday();
  };

  const completed = consultations.filter(
    (c) => c.workflow_status === "completed" || c.workflow_status === "prescription_generated"
  );
  const pending = consultations.filter(
    (c) => !["completed", "prescription_generated", "day_closed"].includes(c.workflow_status)
  );

  const handleCloseDay = async () => {
    if (!clinicId) return;
    setClosing(true);
    try {
      const res = await apiFetch("/api/consultations/close-day", {
        method: "POST",
        headers: authHeader(),
        body: JSON.stringify({
          clinicId,
          date: today,
          completedIds: completed.map((c) => c.id),
          pendingIds: pending.map((c) => c.id),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(apiErrorMessage(data) || "Close day failed");
      setSummary(data.summary);
      toast.success("Day closed successfully!");
    } catch (e) {
      toast.error(errorMessageFromUnknown(e, "Could not close the day"));
    } finally {
      setClosing(false);
    }
  };

  const patientName = (c: ConsultationRow) =>
    c.appointments?.patients?.name || "Unknown Patient";

  const checkInTime = (c: ConsultationRow) => {
    const t = c.appointments?.check_in_time;
    if (!t) return "—";
    return new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const statusBadge = (status: string) => {
    const isOk = ["completed", "prescription_generated"].includes(status);
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full",
          isOk ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"
        )}
      >
        {isOk ? <CheckCircle2 className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
        {status.replace(/_/g, " ")}
      </span>
    );
  };

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className={cn(
          "flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-xl font-semibold text-sm shadow transition-all active:scale-95",
          className
        )}
      >
        <Clock className="w-4 h-4" />
        Close Day
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div>
                <h2 className="text-base font-bold text-gray-900">Close Day — {today}</h2>
                <p className="text-xs text-gray-500 mt-0.5">Review and finalize all consultations</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="p-1.5 rounded-lg hover:bg-gray-100">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            {summary ? (
              /* ── After closing: Summary card ── */
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                <div className="text-center py-3">
                  <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-2" />
                  <p className="font-semibold text-gray-900">Day Closed Successfully</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <SummaryCard icon={<Users className="w-5 h-5 text-blue-500" />} label="Patients Seen" value={String(summary.totalSeen)} />
                  <SummaryCard icon={<AlertTriangle className="w-5 h-5 text-amber-500" />} label="Pending" value={String(summary.totalPending)} />
                  <SummaryCard icon={<Pill className="w-5 h-5 text-green-500" />} label="Prescriptions" value={String(summary.totalPrescriptions)} />
                  <SummaryCard icon={<DollarSign className="w-5 h-5 text-emerald-500" />} label="Revenue" value={`₹${summary.revenue.toLocaleString("en-IN")}`} />
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="w-full mt-2 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium text-sm"
                >
                  Done
                </button>
              </div>
            ) : (
              <>
                {/* ── Before closing: Consultations list ── */}
                <div className="flex-1 overflow-y-auto p-5">
                  {loading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                    </div>
                  ) : consultations.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-8">No active consultations today.</p>
                  ) : (
                    <div className="space-y-3">
                      {completed.length > 0 && (
                        <div>
                          <p className="text-xs font-bold uppercase tracking-wide text-green-700 mb-2">
                            Completed ({completed.length})
                          </p>
                          <div className="space-y-2">
                            {completed.map((c) => (
                              <div key={c.id} className="flex items-center justify-between p-3 bg-green-50 border border-green-100 rounded-lg">
                                <div>
                                  <p className="text-sm font-medium text-gray-900">{patientName(c)}</p>
                                  <p className="text-xs text-gray-500">{checkInTime(c)}</p>
                                </div>
                                {statusBadge(c.workflow_status)}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {pending.length > 0 && (
                        <div>
                          <p className="text-xs font-bold uppercase tracking-wide text-amber-700 mb-2">
                            Incomplete ({pending.length})
                          </p>
                          <div className="space-y-2">
                            {pending.map((c) => (
                              <div key={c.id} className="flex items-center justify-between p-3 bg-amber-50 border border-amber-100 rounded-lg">
                                <div>
                                  <p className="text-sm font-medium text-gray-900">{patientName(c)}</p>
                                  <p className="text-xs text-gray-500">{checkInTime(c)}</p>
                                </div>
                                {statusBadge(c.workflow_status)}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="px-5 pb-5 border-t border-gray-100 pt-4 space-y-2">
                  <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
                    <span>✅ {completed.length} completed</span>
                    <span>⚠️ {pending.length} pending</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleCloseDay()}
                    disabled={closing || (completed.length === 0 && pending.length === 0)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-purple-600 hover:bg-purple-700 disabled:opacity-60 text-white rounded-xl font-semibold text-sm transition-colors"
                  >
                    {closing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    Confirm &amp; Close Day
                  </button>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="w-full px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-xl text-sm font-medium"
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function SummaryCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
      {icon}
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-base font-bold text-gray-900">{value}</p>
      </div>
    </div>
  );
}
