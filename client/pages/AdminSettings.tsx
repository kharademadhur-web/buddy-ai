import { Bell, Settings, ShieldCheck, SlidersHorizontal } from "lucide-react";

export default function AdminSettings() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-sm sm:p-12">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
          <Settings className="h-8 w-8 text-primary" />
        </div>
        <h2 className="mb-2 text-2xl font-bold text-text-primary">Admin Settings</h2>
        <p className="text-text-secondary">
          Manage system-wide settings, configuration, and preferences.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {[
          { icon: SlidersHorizontal, title: "System Configuration", tint: "bg-info/10 text-info" },
          { icon: Bell, title: "Notification Settings", tint: "bg-success/10 text-success" },
          { icon: ShieldCheck, title: "User Permissions", tint: "bg-role-receptionist/10 text-role-receptionist" },
        ].map((item) => (
          <div key={item.title} className="rounded-2xl border border-border bg-card p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg">
            <div className={`mb-4 inline-flex rounded-2xl p-3 ${item.tint}`}>
              <item.icon className="h-5 w-5" />
            </div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-accent">Coming Soon</p>
            <p className="text-sm font-semibold text-text-primary">{item.title}</p>
            <p className="mt-2 text-sm text-text-secondary">Reserved for future configuration without changing current workflows.</p>
          </div>
        ))}
      </div>
    </div>
  );
}
