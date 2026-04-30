import { Link } from "react-router-dom";
import { useDoctorPortal } from "@/context/DoctorPortalContext";
import { Users, ArrowRight, Stethoscope, Clock, FileText, CalendarCheck } from "lucide-react";
import CloseDayButton from "@/components/CloseDayButton";

export default function DoctorOverviewPage() {
  const { user, clinicId, queue, loading, error, rows } = useDoctorPortal();

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6 sm:mb-8">
        <div className="flex flex-col gap-2">
          {user?.name ? (
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-text-primary">Good morning, Dr. {user.name}</h1>
          ) : (
            <h1 className="text-3xl font-bold text-text-primary">Doctor Dashboard</h1>
          )}
          <p className="text-sm sm:text-base text-text-secondary">{new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}</p>
        </div>
        {clinicId ? <CloseDayButton /> : null}
      </div>

      {!clinicId && (
        <div className="mb-4 rounded-2xl border border-warning/20 bg-warning/10 p-4 text-sm text-text-primary">
          No clinic is assigned to this account. Ask your admin to link this user to a clinic in{" "}
          <span className="font-semibold">Admin → Users</span> so the queue and patients load.
        </div>
      )}

      {clinicId && !loading && !error && queue.length === 0 && (
        <div className="mb-4 rounded-2xl border border-info/20 bg-info/10 p-4 text-sm text-text-primary">
          No patients in the queue yet. When reception checks in a patient for this clinic, they will appear in the
          queue.
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-2xl border border-error/20 bg-error/10 p-4 text-sm text-error">{error}</div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Today's patients", value: rows.length, icon: Users, color: "text-primary" },
          { label: "Completed", value: queue.filter((q: any) => q.status === "completed").length, icon: CalendarCheck, color: "text-success" },
          { label: "Pending", value: queue.filter((q: any) => q.status !== "completed").length, icon: Clock, color: "text-warning" },
          { label: "Avg time", value: "18m", icon: Stethoscope, color: "text-info" },
        ].map((kpi) => (
          <div key={kpi.label} className="rounded-2xl border border-border bg-card p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-text-secondary">{kpi.label}</p>
                <p className="mt-2 animate-count-up text-3xl font-bold text-text-primary">{kpi.value}</p>
              </div>
              <div className="rounded-2xl bg-primary/10 p-3">
                <kpi.icon className={`h-6 w-6 ${kpi.color}`} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-text-secondary">Quick actions</p>
              <p className="mt-2 text-xl font-bold text-text-primary">Start the next consultation</p>
            </div>
            <Users className="h-10 w-10 text-primary opacity-20" />
          </div>
          <Link
            to="/doctor-dashboard/queue"
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-white transition-all hover:bg-accent-dark active:scale-95"
          >
            Start Queue
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-primary/10 p-3">
              <FileText className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-text-primary">Today&apos;s workflow</p>
              <p className="mt-1 text-sm text-text-secondary">
                Select a patient from the queue to start a consultation, write prescriptions, and complete the visit.
                Recent prescription history and account settings live on their own pages in the sidebar.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
