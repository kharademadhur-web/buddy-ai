import { useState, useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAdminAuth } from "@/context/AdminAuthContext";
import { ChangePasswordModal } from "../components/ChangePasswordModal";
import { Button } from "../components/ui/button";
import { useToast } from "../hooks/use-toast";
import { apiUrl } from "../lib/api-base";
import { Activity, ShieldCheck, UserCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Profile page
 * Shows user info, security settings, and login history
 */
export function Profile() {
  const { user } = useAdminAuth();
  const { section } = useParams<{ section?: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const validSections = useMemo(() => ["basic", "security", "activity"] as const, []);
  const safeSection = useMemo(() => {
    const candidate = (section || "basic").toLowerCase();
    return validSections.includes(candidate as (typeof validSections)[number]) ? candidate : "basic";
  }, [section, validSections]);
  const activeTab = useMemo<"basic" | "security" | "activity">(() => {
    if (safeSection === "security") return "security";
    if (safeSection === "activity") return "activity";
    return "basic";
  }, [safeSection]);
  const sectionTitle = useMemo(() => {
    if (activeTab === "security") return "Security";
    if (activeTab === "activity") return "Activity";
    return "Basic";
  }, [activeTab]);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [sessions, setSessions] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (section && section.toLowerCase() !== safeSection) {
      navigate(`/profile/${safeSection}`, { replace: true });
    }
  }, [section, safeSection, navigate]);

  useEffect(() => {
    if (activeTab === "security") {
      fetchSessions();
    } else if (activeTab === "activity") {
      fetchAuditLogs();
    }
  }, [activeTab]);

  const fetchSessions = async () => {
    if (!user?.id) return;
    setIsLoading(true);
    try {
      const response = await fetch(apiUrl(`/api/users/${encodeURIComponent(user.id)}/sessions`));
      if (response.ok) {
        const data = await response.json();
        setSessions(data.data || []);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch sessions",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAuditLogs = async () => {
    if (!user?.id) return;
    setIsLoading(true);
    try {
      const response = await fetch(apiUrl(`/api/users/${encodeURIComponent(user.id)}/audit-logs`));
      if (response.ok) {
        const data = await response.json();
        setAuditLogs(data.data || []);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch activity logs",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogoutDevice = async (deviceId: string) => {
    if (!user?.id) return;
    try {
      const response = await fetch(apiUrl(`/api/users/${encodeURIComponent(user.id)}/sessions/logout`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId }),
      });

      if (response.ok) {
        toast({ title: "Success", description: "Logged out from device" });
        fetchSessions();
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to logout from device",
        variant: "destructive",
      });
    }
  };

  const handleLogoutAllDevices = async () => {
    if (!user?.id) return;
    try {
      const response = await fetch(apiUrl(`/api/users/${encodeURIComponent(user.id)}/sessions/logout-all`), {
        method: "POST",
      });

      if (response.ok) {
        toast({ title: "Success", description: "Logged out from all devices" });
        fetchSessions();
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to logout from all devices",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-surface p-4 animate-fade-in">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8 rounded-2xl border border-border bg-card p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-accent">Profile / {sectionTitle}</p>
          <h1 className="mt-1 text-3xl font-bold text-text-primary">Profile</h1>
          <p className="mt-1 text-sm text-text-secondary">Manage account identity, password, sessions, and activity.</p>
        </div>

        {/* Tabs */}
        <div className="mb-6 flex gap-2 rounded-2xl bg-card p-1 shadow-sm">
          {validSections.map((tab) => (
            <button
              key={tab}
              onClick={() => navigate(`/profile/${tab}`)}
              className={`rounded-xl px-4 py-2 font-semibold transition-all ${
                activeTab === tab
                  ? "bg-primary text-white shadow-sm"
                  : "text-text-secondary hover:bg-primary/5 hover:text-primary"
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* Basic Info Tab */}
        {activeTab === "basic" && (
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <div className="mb-5 flex items-center gap-3">
              <div className="rounded-2xl bg-primary/10 p-3"><UserCircle className="h-6 w-6 text-primary" /></div>
              <h2 className="text-xl font-semibold text-text-primary">Basic Information</h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl bg-surface p-4">
                <label className="text-sm font-medium text-text-secondary">Name</label>
                <p className="mt-1 text-lg font-semibold text-text-primary">{user?.name || "N/A"}</p>
              </div>
              <div className="rounded-2xl bg-surface p-4">
                <label className="text-sm font-medium text-text-secondary">Contact</label>
                <p className="mt-1 text-lg font-semibold text-text-primary">{user?.phone || user?.email || "N/A"}</p>
              </div>
              <div className="rounded-2xl bg-surface p-4">
                <label className="text-sm font-medium text-text-secondary">Role</label>
                <p className="mt-1 text-lg font-semibold text-text-primary capitalize">{user?.role || "N/A"}</p>
              </div>
            </div>
          </div>
        )}

        {/* Security Tab */}
        {activeTab === "security" && (
          <div className="space-y-6">
            {/* Password */}
            <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
              <div className="mb-4 flex items-center gap-3">
                <div className="rounded-2xl bg-success/10 p-3"><ShieldCheck className="h-5 w-5 text-success" /></div>
                <h2 className="text-xl font-semibold text-text-primary">Password</h2>
              </div>
              <p className="mb-4 text-text-secondary">
                Change your password regularly to keep your account secure
              </p>
              <Button
                onClick={() => setChangePasswordOpen(true)}
              >
                Change Password
              </Button>
            </div>

            {/* Active Sessions */}
            <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
              <h2 className="mb-4 text-xl font-semibold text-text-primary">Active Sessions</h2>
              {isLoading ? (
                <div className="space-y-3"><Skeleton className="h-16 rounded-2xl" /><Skeleton className="h-16 rounded-2xl" /></div>
              ) : sessions.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-border bg-surface p-6 text-center text-text-secondary">No active sessions</p>
              ) : (
                <div className="space-y-4">
                  {sessions.map((session) => (
                    <div
                      key={session._id}
                      className="flex items-start justify-between rounded-2xl border border-border bg-surface p-4"
                    >
                      <div>
                        <p className="font-medium text-text-primary">
                          {session.deviceInfo?.userAgent?.includes("Chrome")
                            ? "Chrome Browser"
                            : "Device"}
                        </p>
                        <p className="text-sm text-text-secondary">
                          Last used:{" "}
                          {new Date(session.lastUsedAt).toLocaleString()}
                        </p>
                        <p className="text-sm text-text-secondary">
                          IP: {session.ipAddress}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleLogoutDevice(session.deviceId)}
                      >
                        Logout
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              {sessions.length > 0 && (
                <Button
                  variant="outline"
                  className="mt-4 border-error/30 text-error hover:bg-error/10"
                  onClick={handleLogoutAllDevices}
                >
                  Logout All Devices
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Activity Tab */}
        {activeTab === "activity" && (
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-3">
              <div className="rounded-2xl bg-info/10 p-3"><Activity className="h-5 w-5 text-info" /></div>
              <h2 className="text-xl font-semibold text-text-primary">Login History</h2>
            </div>
            {isLoading ? (
              <div className="space-y-3"><Skeleton className="h-14 rounded-2xl" /><Skeleton className="h-14 rounded-2xl" /></div>
            ) : auditLogs.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-border bg-surface p-6 text-center text-text-secondary">No activity yet</p>
            ) : (
              <div className="space-y-2">
                {auditLogs.slice(0, 10).map((log) => (
                  <div
                    key={log._id}
                    className="flex justify-between rounded-2xl border border-border bg-surface p-4"
                  >
                    <div>
                      <p className="font-medium text-text-primary capitalize">
                        {log.action.replace(/_/g, " ")}
                      </p>
                      <p className="text-sm text-text-secondary">
                        {new Date(log.timestamp).toLocaleString()}
                      </p>
                    </div>
                    <span
                      className={`text-sm font-medium ${
                        log.status === "success"
                          ? "text-success"
                          : "text-error"
                      }`}
                    >
                      {log.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Change Password Modal */}
      <ChangePasswordModal
        isOpen={changePasswordOpen}
        onClose={() => setChangePasswordOpen(false)}
      />
    </div>
  );
}
