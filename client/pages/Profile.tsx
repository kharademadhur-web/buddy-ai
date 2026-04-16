import { useState, useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAdminAuth } from "@/context/AdminAuthContext";
import { ChangePasswordModal } from "../components/ChangePasswordModal";
import { Button } from "../components/ui/button";
import { useToast } from "../hooks/use-toast";

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
      const response = await fetch(`/api/users/${encodeURIComponent(user.id)}/sessions`);
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
      const response = await fetch(`/api/users/${encodeURIComponent(user.id)}/audit-logs`);
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
      const response = await fetch(`/api/users/${encodeURIComponent(user.id)}/sessions/logout`, {
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
      const response = await fetch(`/api/users/${encodeURIComponent(user.id)}/sessions/logout-all`, {
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
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <p className="text-xs uppercase tracking-wide text-gray-500">Profile / {sectionTitle}</p>
          <h1 className="text-3xl font-bold text-gray-900 mt-1">Profile</h1>
        </div>

        {/* Tabs */}
        <div className="flex gap-0 mb-6 border-b border-gray-200">
          {validSections.map((tab) => (
            <button
              key={tab}
              onClick={() => navigate(`/profile/${tab}`)}
              className={`px-4 py-2 font-medium border-b-2 -mb-px ${
                activeTab === tab
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-600 hover:text-gray-900"
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* Basic Info Tab */}
        {activeTab === "basic" && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Basic Information</h2>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-600">Name</label>
                <p className="text-lg text-gray-900">{user?.name || "N/A"}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">Contact</label>
                <p className="text-lg text-gray-900">{user?.phone || user?.email || "N/A"}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">Role</label>
                <p className="text-lg text-gray-900 capitalize">{user?.role || "N/A"}</p>
              </div>
            </div>
          </div>
        )}

        {/* Security Tab */}
        {activeTab === "security" && (
          <div className="space-y-6">
            {/* Password */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">Password</h2>
              <p className="text-gray-600 mb-4">
                Change your password regularly to keep your account secure
              </p>
              <Button
                onClick={() => setChangePasswordOpen(true)}
                className="bg-blue-600 hover:bg-blue-700"
              >
                Change Password
              </Button>
            </div>

            {/* Active Sessions */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">Active Sessions</h2>
              {isLoading ? (
                <p className="text-gray-600">Loading...</p>
              ) : sessions.length === 0 ? (
                <p className="text-gray-600">No active sessions</p>
              ) : (
                <div className="space-y-4">
                  {sessions.map((session) => (
                    <div
                      key={session._id}
                      className="border border-gray-200 rounded p-4 flex justify-between items-start"
                    >
                      <div>
                        <p className="font-medium text-gray-900">
                          {session.deviceInfo?.userAgent?.includes("Chrome")
                            ? "Chrome Browser"
                            : "Device"}
                        </p>
                        <p className="text-sm text-gray-600">
                          Last used:{" "}
                          {new Date(session.lastUsedAt).toLocaleString()}
                        </p>
                        <p className="text-sm text-gray-600">
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
                  className="mt-4 text-red-600 border-red-200 hover:bg-red-50"
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
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Login History</h2>
            {isLoading ? (
              <p className="text-gray-600">Loading...</p>
            ) : auditLogs.length === 0 ? (
              <p className="text-gray-600">No activity yet</p>
            ) : (
              <div className="space-y-2">
                {auditLogs.slice(0, 10).map((log) => (
                  <div
                    key={log._id}
                    className="border-b border-gray-200 py-3 flex justify-between"
                  >
                    <div>
                      <p className="font-medium text-gray-900 capitalize">
                        {log.action.replace(/_/g, " ")}
                      </p>
                      <p className="text-sm text-gray-600">
                        {new Date(log.timestamp).toLocaleString()}
                      </p>
                    </div>
                    <span
                      className={`text-sm font-medium ${
                        log.status === "success"
                          ? "text-green-600"
                          : "text-red-600"
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
