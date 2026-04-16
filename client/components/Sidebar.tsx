import { useNavigate, useLocation } from "react-router-dom";
import {
  Menu,
  LayoutDashboard,
  Users,
  User,
  FileText,
  BarChart3,
  Settings,
  LogOut,
  Stethoscope,
  ChevronDown,
  Plus,
  Calendar,
  CreditCard,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api-base";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useAdminAuth } from "@/context/AdminAuthContext";

interface SidebarProps {
  role: "doctor" | "reception" | "solo-doctor" | "admin";
  /** Checked-in / waiting count for Queue nav badge (doctor & reception) */
  queueCount?: number;
}

/** Nested routes under /doctor-dashboard and /reception-dashboard */
function portalStaffNavActive(itemPath: string, pathname: string): boolean {
  const p = pathname.replace(/\/$/, "") || "/";
  const item = itemPath.replace(/\/$/, "");
  const homePaths = ["/doctor-dashboard", "/reception-dashboard"];
  if (homePaths.includes(item)) {
    return p === item;
  }
  return p === item;
}

/** Hash routes like /solo-dashboard#settings — match pathname + hash for active styling */
function portalNavActive(itemPath: string, pathname: string, hash: string): boolean {
  if (!itemPath.includes("#")) {
    return pathname === itemPath && !(hash || "").replace(/^#/, "");
  }
  const [base, frag] = itemPath.split("#");
  if (pathname !== base) return false;
  const h = (hash || "").replace(/^#/, "").toLowerCase();
  return h === (frag || "").toLowerCase();
}

export default function Sidebar({ role, queueCount }: SidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const adminAuth = useAdminAuth();
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    userManagement: false,
  });
  const [sheetOpen, setSheetOpen] = useState(false);
  const [portalClinic, setPortalClinic] = useState<{ name?: string; clinic_code?: string | null }>({});

  useEffect(() => {
    if (role === "admin") return;
    const cid = adminAuth.user?.clinic_id;
    if (!cid) return;
    void apiFetch(`/api/staff/clinic/letterhead-active?clinicId=${encodeURIComponent(cid)}`)
      .then((r) => r.json())
      .then((j) => {
        if (j.success && j.clinic) {
          setPortalClinic({
            name: j.clinic.name,
            clinic_code: j.clinic.clinic_code ?? null,
          });
        }
      })
      .catch(() => {});
  }, [role, adminAuth.user?.clinic_id]);

  const menuItems = {
    doctor: [
      { icon: LayoutDashboard, label: "Dashboard", path: "/doctor-dashboard" },
      { icon: Users, label: "Queue", path: "/doctor-dashboard/queue" },
      { icon: FileText, label: "Reports", path: "/doctor-dashboard/reports" },
      { icon: FileText, label: "Prescriptions", path: "/doctor-dashboard/prescriptions" },
      { icon: BarChart3, label: "Analytics", path: "/doctor-dashboard/analytics" },
      { icon: User, label: "Profile", path: "/profile/basic" },
      { icon: Settings, label: "Settings", path: "/doctor-dashboard/settings" },
    ],
    reception: [
      { icon: LayoutDashboard, label: "Dashboard", path: "/reception-dashboard" },
      { icon: Users, label: "Queue", path: "/reception-dashboard/queue" },
      { icon: FileText, label: "Prescriptions", path: "/reception-dashboard/intake" },
      { icon: User, label: "Profile", path: "/profile/basic" },
      { icon: Settings, label: "Settings", path: "/reception-dashboard/settings" },
    ],
    "solo-doctor": [
      { icon: LayoutDashboard, label: "Dashboard", path: "/solo-dashboard" },
      { icon: User, label: "Profile", path: "/profile/basic" },
      { icon: Settings, label: "Settings", path: "/solo-dashboard#settings" },
    ],
  };

  const adminMenuItems = useMemo(() => {
    if (adminAuth.user?.role === "clinic-admin") {
      return [
        { icon: LayoutDashboard, label: "Dashboard", path: "/admin-dashboard/overview" },
        { icon: BarChart3, label: "Analytics", path: "/admin-dashboard/analytics" },
        { icon: Calendar, label: "Daily summary", path: "/admin-dashboard/daily-summary" },
        { icon: Users, label: "My clinic", path: "/admin-dashboard/clinics" },
        { icon: CreditCard, label: "Billing", path: "/admin-dashboard/billing" },
        { icon: Users, label: "Users", path: "/admin-dashboard/users" },
        { icon: Settings, label: "Device Approvals", path: "/admin-dashboard/device-approvals" },
        { icon: User, label: "Profile", path: "/profile/basic" },
        { icon: Settings, label: "Settings", path: "/admin-dashboard/settings" },
      ];
    }
    return [
      { icon: LayoutDashboard, label: "Dashboard", path: "/admin-dashboard/overview" },
      { icon: BarChart3, label: "Analytics", path: "/admin-dashboard/analytics" },
      { icon: Users, label: "Clinics", path: "/admin-dashboard/clinics" },
      { icon: CreditCard, label: "Billing", path: "/admin-dashboard/billing" },
      { icon: FileText, label: "KYC Review", path: "/admin-dashboard/kyc" },
      { icon: Settings, label: "Device Approvals", path: "/admin-dashboard/device-approvals" },
      {
        icon: Users,
        label: "User Management",
        path: "#user-management",
        isSection: true,
        submenu: [
          { icon: Plus, label: "Onboard Clinic", path: "/admin-dashboard/onboarding" },
        ],
      },
      { icon: Users, label: "Users", path: "/admin-dashboard/users" },
      { icon: User, label: "Profile", path: "/profile/basic" },
      { icon: Settings, label: "Settings", path: "/admin-dashboard/settings" },
    ];
  }, [adminAuth.user?.role]);

  const items = role === "admin" ? adminMenuItems : menuItems[role];
  const useMinimalPortalHeader = role === "doctor" || role === "reception";

  const handleLogout = () => {
    adminAuth.logout();
    navigate(role === "admin" ? "/admin/login" : "/portal/login");
  };

  const navItemActive = (itemPath: string) => {
    if (role === "admin") return location.pathname === itemPath;
    if (role === "doctor" || role === "reception") {
      return portalStaffNavActive(itemPath, location.pathname);
    }
    if (role === "solo-doctor") {
      return portalNavActive(itemPath, location.pathname, location.hash);
    }
    return location.pathname === itemPath;
  };

  const navigatePortalPath = (path: string) => {
    if (path.includes("#")) {
      const [base, frag] = path.split("#");
      navigate(frag ? `${base}#${frag}` : base);
    } else {
      navigate(path);
    }
  };

  const toggleSection = (sectionId: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [sectionId]: !prev[sectionId],
    }));
  };

  return (
    <>
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 flex h-14 items-center justify-between border-b border-gray-200 bg-white px-3">
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger asChild>
            <Button type="button" variant="outline" size="icon" aria-label="Open menu">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[min(100vw,280px)] p-0 flex flex-col">
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg p-2">
                  <Stethoscope className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="font-bold text-gray-900">SmartClinic</h1>
                  <p className="text-xs text-gray-500 capitalize">{role.replace("-", " ")}</p>
                  {!useMinimalPortalHeader && portalClinic.name ? (
                    <p className="text-xs text-gray-700 mt-1 font-medium truncate max-w-[200px]" title={portalClinic.name}>
                      {portalClinic.name}
                    </p>
                  ) : null}
                  {!useMinimalPortalHeader && (adminAuth.user?.clinic_code || portalClinic.clinic_code) ? (
                    <p className="text-[10px] text-gray-500 mt-0.5">
                      Clinic ID:{" "}
                      <span className="font-mono">{adminAuth.user?.clinic_code || portalClinic.clinic_code}</span>
                    </p>
                  ) : null}
                  {!useMinimalPortalHeader && adminAuth.user?.user_id ? (
                    <p className="text-[10px] text-gray-500">
                      Your ID: <span className="font-mono">{adminAuth.user.user_id}</span>
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
            <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
              {items.map((item: any) => {
                const Icon = item.icon;
                const isActive = navItemActive(item.path);
                const isExpanded = expandedSections[item.label?.toLowerCase().replace(/\s+/g, "")];
                if (item.isSection) {
                  const sectionId = item.label?.toLowerCase().replace(/\s+/g, "");
                  return (
                    <div key={item.label}>
                      <button
                        type="button"
                        onClick={() => toggleSection(sectionId)}
                        className={cn(
                          "w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all text-left",
                          isExpanded ? "bg-blue-50" : "text-gray-700 hover:bg-gray-100"
                        )}
                      >
                        <Icon className="w-5 h-5 flex-shrink-0" />
                        <span className="flex-1">{item.label}</span>
                        <ChevronDown className={cn("w-4 h-4 transition-transform", isExpanded ? "rotate-180" : "")} />
                      </button>
                      {isExpanded && item.submenu && (
                        <div className="ml-6 mt-1 space-y-1">
                          {item.submenu.map((subitem: any) => {
                            const SubIcon = subitem.icon;
                            const isSubActive = location.pathname === subitem.path;
                            return (
                              <button
                                type="button"
                                key={subitem.path}
                                onClick={() => {
                                  navigate(subitem.path);
                                  setSheetOpen(false);
                                }}
                                className={cn(
                                  "w-full flex items-center gap-3 px-4 py-2 rounded-lg transition-all text-left text-sm",
                                  isSubActive ? "bg-blue-100 text-blue-700 font-semibold" : "text-gray-600 hover:bg-gray-100"
                                )}
                              >
                                <SubIcon className="w-4 h-4 flex-shrink-0" />
                                <span>{subitem.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                }
                return (
                  <button
                    type="button"
                    key={item.path}
                    onClick={() => {
                      navigatePortalPath(item.path);
                      setSheetOpen(false);
                    }}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all text-left",
                      isActive ? "bg-blue-100 text-blue-700 font-semibold" : "text-gray-700 hover:bg-gray-100"
                    )}
                  >
                    <Icon className="w-5 h-5 flex-shrink-0" />
                    <span className="flex items-center gap-2 flex-1">
                      {item.label}
                      {item.label === "Queue" && typeof queueCount === "number" && queueCount > 0 ? (
                        <span className="ml-auto text-xs font-bold bg-blue-600 text-white px-2 py-0.5 rounded-full min-w-[1.5rem] text-center">
                          {queueCount > 99 ? "99+" : queueCount}
                        </span>
                      ) : null}
                    </span>
                  </button>
                );
              })}
            </nav>
            <div className="p-4 border-t border-gray-200">
              <button
                type="button"
                onClick={() => {
                  setSheetOpen(false);
                  handleLogout();
                }}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-all font-semibold"
              >
                <LogOut className="w-5 h-5" />
                Logout
              </button>
            </div>
          </SheetContent>
        </Sheet>
        <span className="font-semibold text-gray-900 truncate">SmartClinic</span>
        <span className="w-10" aria-hidden />
      </div>
    <aside className="hidden md:flex w-64 shrink-0 bg-white border-r border-gray-200 flex flex-col h-screen sticky top-0">
      {/* Logo */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg p-2">
            <Stethoscope className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-gray-900">SmartClinic</h1>
            <p className="text-xs text-gray-500 capitalize">{role.replace("-", " ")}</p>
            {role !== "admin" && !useMinimalPortalHeader && portalClinic.name ? (
              <p className="text-xs text-gray-700 mt-1 font-medium truncate" title={portalClinic.name}>
                {portalClinic.name}
              </p>
            ) : null}
            {role !== "admin" && !useMinimalPortalHeader && (adminAuth.user?.clinic_code || portalClinic.clinic_code) ? (
              <p className="text-[10px] text-gray-500 mt-0.5">
                Clinic ID:{" "}
                <span className="font-mono">{adminAuth.user?.clinic_code || portalClinic.clinic_code}</span>
              </p>
            ) : null}
            {role !== "admin" && !useMinimalPortalHeader && adminAuth.user?.user_id ? (
              <p className="text-[10px] text-gray-500">
                Your ID: <span className="font-mono">{adminAuth.user.user_id}</span>
              </p>
            ) : null}
          </div>
        </div>
      </div>

      {/* Menu Items */}
      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        {items.map((item: any) => {
          const Icon = item.icon;
          const isActive = navItemActive(item.path);
          const isExpanded = expandedSections[item.label?.toLowerCase().replace(/\s+/g, "")];

          if (item.isSection) {
            const sectionId = item.label?.toLowerCase().replace(/\s+/g, "");
            return (
              <div key={item.label}>
                {/* Section Header */}
                <button
                  onClick={() => toggleSection(sectionId)}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all text-left",
                    isExpanded ? "bg-blue-50" : "text-gray-700 hover:bg-gray-100"
                  )}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  <span className="flex-1">{item.label}</span>
                  <ChevronDown
                    className={cn(
                      "w-4 h-4 transition-transform",
                      isExpanded ? "rotate-180" : ""
                    )}
                  />
                </button>

                {/* Submenu Items */}
                {isExpanded && item.submenu && (
                  <div className="ml-6 mt-1 space-y-1">
                    {item.submenu.map((subitem: any) => {
                      const SubIcon = subitem.icon;
                      const isSubActive = location.pathname === subitem.path;

                      return (
                        <button
                          key={subitem.path}
                          onClick={() => navigate(subitem.path)}
                          className={cn(
                            "w-full flex items-center gap-3 px-4 py-2 rounded-lg transition-all text-left text-sm",
                            isSubActive
                              ? "bg-blue-100 text-blue-700 font-semibold"
                              : "text-gray-600 hover:bg-gray-100"
                          )}
                        >
                          <SubIcon className="w-4 h-4 flex-shrink-0" />
                          <span>{subitem.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }

          return (
            <button
              key={item.path}
              type="button"
              onClick={() => navigatePortalPath(item.path)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all text-left",
                isActive
                  ? "bg-blue-100 text-blue-700 font-semibold"
                  : "text-gray-700 hover:bg-gray-100"
              )}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              <span className="flex items-center gap-2 flex-1">
                {item.label}
                {item.label === "Queue" && typeof queueCount === "number" && queueCount > 0 ? (
                  <span className="ml-auto text-xs font-bold bg-blue-600 text-white px-2 py-0.5 rounded-full min-w-[1.5rem] text-center">
                    {queueCount > 99 ? "99+" : queueCount}
                  </span>
                ) : null}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Logout Button */}
      <div className="p-4 border-t border-gray-200">
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-all font-semibold"
        >
          <LogOut className="w-5 h-5" />
          Logout
        </button>
      </div>
    </aside>
    </>
  );
}
