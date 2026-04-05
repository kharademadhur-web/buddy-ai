import { useNavigate, useLocation } from "react-router-dom";
import {
  Menu,
  LayoutDashboard,
  Users,
  FileText,
  BarChart3,
  Settings,
  LogOut,
  Stethoscope,
  ChevronDown,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useAdminAuth } from "@/context/AdminAuthContext";

interface SidebarProps {
  role: "doctor" | "reception" | "solo-doctor" | "admin";
}

export default function Sidebar({ role }: SidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const adminAuth = useAdminAuth();
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    userManagement: false,
  });
  const [sheetOpen, setSheetOpen] = useState(false);

  const menuItems = {
    doctor: [
      { icon: LayoutDashboard, label: "Dashboard", path: "/doctor-dashboard" },
      { icon: Users, label: "Queue", path: "/doctor-dashboard#queue" },
      { icon: FileText, label: "Prescriptions", path: "/doctor-dashboard#rx" },
      { icon: BarChart3, label: "Analytics", path: "/doctor-dashboard#analytics" },
      { icon: Settings, label: "Settings", path: "/doctor-dashboard#settings" },
    ],
    reception: [
      { icon: LayoutDashboard, label: "Dashboard", path: "/reception-dashboard" },
      { icon: Users, label: "Queue", path: "/reception-dashboard#queue" },
      { icon: FileText, label: "Prescriptions", path: "/reception-dashboard#rx" },
      { icon: Settings, label: "Settings", path: "/reception-dashboard#settings" },
    ],
    "solo-doctor": [
      { icon: LayoutDashboard, label: "Dashboard", path: "/solo-dashboard" },
      { icon: Settings, label: "Settings", path: "/solo-dashboard#settings" },
    ],
    admin: [
      { icon: LayoutDashboard, label: "Dashboard", path: "/admin-dashboard/overview" },
      { icon: Users, label: "Clinics", path: "/admin-dashboard/clinics" },
      { icon: FileText, label: "KYC Review", path: "/admin-dashboard/kyc" },
      { icon: Settings, label: "Device Approvals", path: "/admin-dashboard/device-approvals" },
      {
        icon: Users,
        label: "User Management",
        path: "#user-management",
        isSection: true,
        submenu: [
          { icon: Plus, label: "Onboard Clinic", path: "/admin-dashboard/onboarding" },
        ]
      },
      { icon: Users, label: "Users", path: "/admin-dashboard/users" },
      { icon: BarChart3, label: "Analytics", path: "/admin-dashboard/analytics" },
      { icon: Settings, label: "Settings", path: "/admin-dashboard/settings" },
    ],
  };

  const items = menuItems[role];

  const handleLogout = () => {
    adminAuth.logout();
    navigate(role === "admin" ? "/admin/login" : "/portal/login");
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
                </div>
              </div>
            </div>
            <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
              {items.map((item: any) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
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
                      navigate(item.path);
                      setSheetOpen(false);
                    }}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all text-left",
                      isActive ? "bg-blue-100 text-blue-700 font-semibold" : "text-gray-700 hover:bg-gray-100"
                    )}
                  >
                    <Icon className="w-5 h-5 flex-shrink-0" />
                    <span>{item.label}</span>
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
          </div>
        </div>
      </div>

      {/* Menu Items */}
      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        {items.map((item: any) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
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
              onClick={() => navigate(item.path)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all text-left",
                isActive
                  ? "bg-blue-100 text-blue-700 font-semibold"
                  : "text-gray-700 hover:bg-gray-100"
              )}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              <span>{item.label}</span>
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
