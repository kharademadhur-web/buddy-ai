import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, X, CheckCheck, Loader2, AlertCircle, CheckCircle2, Pill, Calendar, User, Clock } from "lucide-react";
import { apiFetch, apiUrl } from "@/lib/api-base";
import { useAdminAuth } from "@/context/AdminAuthContext";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

type Notification = {
  id: string;
  type: string;
  title: string;
  message: string;
  data: Record<string, unknown>;
  is_read: boolean;
  created_at: string;
  read_at?: string | null;
};

function NotificationIcon({ type }: { type: string }) {
  const cls = "w-4 h-4 flex-shrink-0";
  if (type.includes("patient") || type.includes("queue")) return <User className={cn(cls, "text-blue-500")} />;
  if (type.includes("prescription") || type.includes("medicine")) return <Pill className={cn(cls, "text-green-500")} />;
  if (type.includes("follow")) return <Calendar className={cn(cls, "text-purple-500")} />;
  if (type.includes("day") || type.includes("close")) return <CheckCircle2 className={cn(cls, "text-emerald-500")} />;
  if (type.includes("subscription") || type.includes("billing")) return <AlertCircle className={cn(cls, "text-amber-500")} />;
  if (type.includes("device")) return <CheckCircle2 className={cn(cls, "text-teal-500")} />;
  return <Bell className={cn(cls, "text-gray-400")} />;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function NotificationCenter() {
  const { tokens } = useAdminAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<"all" | "unread">("all");
  const panelRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const authHeader = useCallback(() => {
    const t = tokens?.accessToken || sessionStorage.getItem("admin_access_token") || "";
    return t ? { Authorization: `Bearer ${t}` } : {};
  }, [tokens?.accessToken]);

  const fetchUnreadCount = useCallback(async () => {
    try {
      const res = await apiFetch("/api/notifications/unread-count", { headers: authHeader() });
      const data = await res.json();
      if (data.success) setUnreadCount(data.count ?? 0);
    } catch { /* silent */ }
  }, [authHeader]);

  const fetchNotifications = useCallback(async (unreadOnly = false) => {
    setLoading(true);
    try {
      const url = `/api/notifications?limit=30${unreadOnly ? "&unread=true" : ""}`;
      const res = await apiFetch(url, { headers: authHeader() });
      const data = await res.json();
      if (data.success) setNotifications(data.notifications ?? []);
    } catch { /* silent */ } finally {
      setLoading(false);
    }
  }, [authHeader]);

  const markRead = async (id: string) => {
    try {
      await apiFetch(`/api/notifications/${id}/read`, { method: "POST", headers: authHeader() });
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch { /* silent */ }
  };

  const openNotification = async (notification: Notification) => {
    if (!notification.is_read) await markRead(notification.id);
    const href = typeof notification.data?.href === "string" ? notification.data.href : null;
    if (href) {
      setOpen(false);
      navigate(href);
    }
  };

  const markAllRead = async () => {
    try {
      await apiFetch("/api/notifications/read-all", { method: "POST", headers: authHeader() });
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch { /* silent */ }
  };

  // SSE connection for real-time notifications
  useEffect(() => {
    const token = tokens?.accessToken || sessionStorage.getItem("admin_access_token") || "";
    if (!token) return;

    // Use URL with token since EventSource doesn't support custom headers
    const url = apiUrl(`/api/notifications/stream`);
    // We have to pass auth via query param since EventSource doesn't support headers
    const es = new EventSource(`${url}?token=${encodeURIComponent(token)}`);
    eventSourceRef.current = es;

    es.addEventListener("notification", (e) => {
      try {
        const raw = JSON.parse(e.data) as Notification & { createdAt?: string; isRead?: boolean };
        const n: Notification = {
          ...raw,
          id: raw.id || `live-${Date.now()}`,
          created_at: raw.created_at || raw.createdAt || new Date().toISOString(),
          is_read: raw.is_read ?? raw.isRead ?? false,
        };
        setNotifications((prev) => [n, ...prev]);
        setUnreadCount((c) => c + 1);
      } catch { /* silent */ }
    });

    es.onerror = () => {
      // SSE error — fall back to polling
      es.close();
    };

    return () => {
      es.close();
    };
  }, [tokens?.accessToken]);

  // Fallback polling every 30s
  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30_000);
    return () => clearInterval(interval);
  }, [fetchUnreadCount]);

  useEffect(() => {
    if (open) void fetchNotifications(tab === "unread");
  }, [open, tab, fetchNotifications]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Update SSE to support token in query param — patch the middleware
  // (The SSE route reads token from query if Authorization header not present)

  const filtered = tab === "unread" ? notifications.filter((n) => !n.is_read) : notifications;

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell button */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="relative rounded-xl p-2 transition-colors hover:bg-primary/10"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5 text-text-secondary" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-[18px] min-w-[18px] animate-pulse items-center justify-center rounded-full bg-error px-1 text-[10px] font-bold text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Panel — tablet: slide-in from right (320px), mobile: bottom sheet */}
      {open && (
        <>
          {/* Backdrop (mobile) */}
          <div className="fixed inset-0 bg-black/20 z-40 sm:hidden" onClick={() => setOpen(false)} />

          <div className={cn(
            "fixed z-50 flex flex-col border border-border bg-card shadow-2xl",
            // Tablet+: top-right panel
            "sm:absolute sm:right-0 sm:top-10 sm:max-h-[520px] sm:w-[360px] sm:rounded-2xl",
            // Mobile: bottom sheet
            "bottom-0 left-0 right-0 max-h-[75vh] rounded-t-2xl sm:rounded-2xl",
          )}>
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h3 className="text-sm font-semibold text-text-primary">Notifications</h3>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={() => void markAllRead()}
                    className="flex items-center gap-1 text-xs text-primary hover:text-primary-dark"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    Mark all read
                  </button>
                )}
                <button type="button" onClick={() => setOpen(false)} className="rounded-lg p-1 hover:bg-primary/10">
                  <X className="w-4 h-4 text-text-secondary" />
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-border">
              {(["all", "unread"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  className={cn(
                    "flex-1 text-xs font-medium py-2 transition-colors",
                    tab === t
                      ? "border-b-2 border-primary text-primary"
                      : "text-text-secondary hover:text-text-primary"
                  )}
                >
                  {t === "all" ? "All" : `Unread${unreadCount > 0 ? ` (${unreadCount})` : ""}`}
                </button>
              ))}
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto overscroll-contain">
              {loading ? (
                <div className="space-y-3 p-4">
                  <div className="h-14 rounded-2xl bg-muted animate-shimmer" />
                  <div className="h-14 rounded-2xl bg-muted animate-shimmer" />
                  <div className="h-14 rounded-2xl bg-muted animate-shimmer" />
                </div>
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-text-muted">
                  <Bell className="mb-2 h-8 w-8 opacity-30" />
                  <p className="text-sm">You're all caught up!</p>
                </div>
              ) : (
                <ul>
                  {filtered.map((n) => (
                    <li
                      key={n.id}
                      onClick={() => void openNotification(n)}
                      className={cn(
                        "flex cursor-pointer gap-3 border-b border-border/60 px-4 py-3 transition-colors hover:bg-primary/5",
                        !n.is_read && "bg-primary/5"
                      )}
                    >
                      <div className="mt-0.5">
                        <NotificationIcon type={n.type} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={cn("text-xs font-semibold text-text-primary leading-tight", !n.is_read && "font-bold")}>
                          {n.title}
                        </p>
                        <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-text-secondary">{n.message}</p>
                        <div className="flex items-center gap-1 mt-1">
                          <Clock className="h-3 w-3 text-text-muted" />
                          <span className="text-[10px] text-text-muted">{timeAgo(n.created_at)}</span>
                          {!n.is_read && <span className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-primary" />}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
