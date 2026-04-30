import { useAdminAuth } from "@/context/AdminAuthContext";
import { useReceptionPortal } from "@/context/ReceptionPortalContext";
import { Users, TrendingUp, IndianRupee, Clock } from "lucide-react";

export default function ReceptionOverviewPage() {
  const { user } = useAdminAuth();
  const { clinicId, queue, loading, summary, summaryLoading, paymentQrUrl, onlineDoctors, offlineDoctors, error } =
    useReceptionPortal();

  const completedToday = summary?.completedToday ?? 0;
  const totalCollected = summary?.totalCollected ?? 0;
  const kpiText = (isLoading: boolean, value: string | number) =>
    isLoading ? <span className="text-2xl text-text-muted">Loading...</span> : value;

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8 animate-fade-in">
      <div className="mb-4 sm:mb-8 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-text-primary">Today at your clinic</h1>
          {user?.name ? (
            <p className="mt-1 text-sm text-text-secondary">
              Signed in as <span className="font-medium text-text-primary">{user.name}</span>
              {user.user_id ? (
                <span className="ml-2 font-mono text-xs text-text-muted">{user.user_id}</span>
              ) : null}
            </p>
          ) : null}
          <p className="mt-1 text-sm text-text-muted">{new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}</p>
        </div>
      </div>

      {!clinicId && (
        <div className="mb-4 rounded-2xl border border-warning/20 bg-warning/10 p-4 text-sm text-text-primary">
          No clinic is assigned to this account. Contact your administrator to attach this user to a clinic.
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-2xl border border-error/20 bg-error/10 p-4 text-sm text-error">{error}</div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-text-secondary">Waiting</p>
              <p className="mt-2 animate-count-up text-3xl font-bold text-text-primary">{kpiText(loading, queue.length)}</p>
            </div>
            <Users className="h-12 w-12 text-role-receptionist opacity-20" />
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-text-secondary">Done</p>
              <p className="mt-2 animate-count-up text-3xl font-bold text-text-primary">{kpiText(summaryLoading, completedToday)}</p>
            </div>
            <TrendingUp className="h-12 w-12 text-success opacity-20" />
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-text-secondary">Revenue today</p>
              <p className="mt-2 animate-count-up text-3xl font-bold text-text-primary">
                {kpiText(summaryLoading, `₹${totalCollected}`)}
              </p>
            </div>
            <IndianRupee className="h-12 w-12 text-accent opacity-20" />
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-text-secondary">Checked in</p>
              <p className="mt-2 animate-count-up text-3xl font-bold text-text-primary">{kpiText(loading, queue.length + completedToday)}</p>
            </div>
            <Clock className="h-12 w-12 text-info opacity-20" />
          </div>
        </div>
      </div>

      <div className="flex flex-col items-center gap-6 rounded-2xl border border-border bg-card p-6 shadow-sm md:flex-row">
        <div className="text-center md:text-left flex-1">
          <h2 className="text-lg font-semibold text-text-primary">Payments & OTP</h2>
          <p className="mt-1 text-sm text-text-secondary">
            Clinic letterhead is uploaded in Admin (onboarding or clinic detail) and appears on the patient intake
            form. UPI / QR for collections. OTP contact:{" "}
            <a
              className="font-medium text-primary"
              href={`tel:+91${import.meta.env.VITE_OTP_PHONE || "9137295344"}`}
            >
              +91 {import.meta.env.VITE_OTP_PHONE || "9137295344"}
            </a>
          </p>
        </div>
        <div className="shrink-0">
          {paymentQrUrl ? (
            <img
              src={paymentQrUrl}
              alt="Clinic payment QR"
              className="h-40 w-40 rounded-2xl border border-border bg-white object-contain"
            />
          ) : (
            <div className="flex h-40 w-40 items-center justify-center rounded-2xl border border-dashed border-border bg-surface p-2 text-center text-xs text-text-muted">
              Upload clinic payment QR in Admin → clinic (onboarding or clinic detail).
            </div>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-text-primary">Doctor live status</h2>
        <p className="mt-1 text-sm text-text-secondary">
          Online means doctor is accepting patients and active in doctor portal.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-xs font-semibold uppercase text-emerald-700">Online</p>
            <p className="text-2xl font-bold text-emerald-900 mt-1">{onlineDoctors.length}</p>
            <div className="mt-2 space-y-1 text-sm text-emerald-900">
              {onlineDoctors.length > 0 ? (
                onlineDoctors.map((d) => <p key={d.id}>• {d.name}</p>)
              ) : (
                <p className="text-emerald-700">No doctors online right now.</p>
              )}
            </div>
          </div>
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-4">
            <p className="text-xs font-semibold uppercase text-rose-700">Offline</p>
            <p className="text-2xl font-bold text-rose-900 mt-1">{offlineDoctors.length}</p>
            <div className="mt-2 space-y-1 text-sm text-rose-900">
              {offlineDoctors.length > 0 ? (
                offlineDoctors.map((d) => <p key={d.id}>• {d.name}</p>)
              ) : (
                <p className="text-rose-700">All listed doctors are online.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
