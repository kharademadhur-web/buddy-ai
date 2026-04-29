import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, X, CheckCheck, Loader2, AlertCircle, CheckCircle2, Pill, Calendar, User, Clock } from "lucide-react";
import { apiFetch, apiUrl } from "@/lib/api-base";
import { useAdminAuth } from "@/context/AdminAuthContext";
import { cn } from "@/lib/utils";

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
        const n = JSON.parse(e.data) as Notification;
        setNotifications((prev) => [{ ...n, is_read: false }, ...prev]);
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
        className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5 text-gray-600" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full">
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
            "fixed z-50 bg-white shadow-2xl border border-gray-200 flex flex-col",
            // Tablet+: top-right panel
            "sm:absolute sm:right-0 sm:top-10 sm:w-80 sm:max-h-[520px] sm:rounded-xl",
            // Mobile: bottom sheet
            "bottom-0 left-0 right-0 max-h-[75vh] rounded-t-2xl sm:rounded-xl",
          )}>
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900 text-sm">Notifications</h3>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={() => void markAllRead()}
                    className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    Mark all read
                  </button>
                )}
                <button type="button" onClick={() => setOpen(false)} className="p-1 hover:bg-gray-100 rounded">
                  <X className="w-4 h-4 text-gray-500" />
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-100">
              {(["all", "unread"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  className={cn(
                    "flex-1 text-xs font-medium py-2 transition-colors",
                    tab === t
                      ? "border-b-2 border-blue-500 text-blue-600"
                      : "text-gray-500 hover:text-gray-700"
                  )}
                >
                  {t === "all" ? "All" : `Unread${unreadCount > 0 ? ` (${unreadCount})` : ""}`}
                </button>
              ))}
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto overscroll-contain">
              {loading ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                </div>
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-gray-400">
                  <Bell className="w-8 h-8 mb-2 opacity-30" />
                  <p className="text-sm">{tab === "unread" ? "No unread notifications" : "No notifications yet"}</p>
                </div>
              ) : (
                <ul>
                  {filtered.map((n) => (
                    <li
                      key={n.id}
                      onClick={() => !n.is_read && void markRead(n.id)}
                      className={cn(
                        "flex gap-3 px-4 py-3 border-b border-gray-50 cursor-pointer hover:bg-gray-50 transition-colors",
                        !n.is_read && "bg-blue-50/40"
                      )}
                    >
                      <div className="mt-0.5">
                        <NotificationIcon type={n.type} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={cn("text-xs font-semibold text-gray-900 leading-tight", !n.is_read && "font-bold")}>
                          {n.title}
                        </p>
                        <p className="text-xs text-gray-600 mt-0.5 leading-relaxed line-clamp-2">{n.message}</p>
                        <div className="flex items-center gap-1 mt-1">
                          <Clock className="w-3 h-3 text-gray-400" />
                          <span className="text-[10px] text-gray-400">{timeAgo(n.created_at)}</span>
                          {!n.is_read && <span className="ml-1 w-1.5 h-1.5 rounded-full bg-blue-500 inline-block" />}
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
