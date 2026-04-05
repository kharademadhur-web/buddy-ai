import { Outlet, useLocation, Link } from "react-router-dom";
import {
  Calendar,
  Users,
  Plus,
  Pill,
  Settings as SettingsIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function AppLayout() {
  const location = useLocation();

  const navItems = [
    { path: "/", label: "Dashboard", icon: Calendar },
    { path: "/patients", label: "Patients", icon: Users },
    { path: "/consultation", label: "Consult", icon: Plus, special: true },
    { path: "/prescriptions", label: "Rx", icon: Pill },
    { path: "/settings", label: "Settings", icon: SettingsIcon },
  ];

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Main Content */}
      <div className="flex-1 overflow-auto pb-20">
        <Outlet />
      </div>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-border shadow-lg">
        <div className="flex items-center justify-around h-20">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;

            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex flex-col items-center justify-center w-full h-full transition-all relative",
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {item.special ? (
                  <>
                    <div
                      className={cn(
                        "p-3 rounded-full transition-all",
                        isActive
                          ? "bg-primary text-primary-foreground shadow-lg scale-110"
                          : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                      )}
                    >
                      <Icon className="w-6 h-6" />
                    </div>
                    <span className="text-xs font-medium mt-0.5">
                      {item.label}
                    </span>
                  </>
                ) : (
                  <>
                    <Icon className="w-6 h-6" />
                    <span className="text-xs font-medium mt-1">
                      {item.label}
                    </span>
                    {isActive && (
                      <div className="absolute bottom-0 w-8 h-1 bg-primary rounded-full" />
                    )}
                  </>
                )}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
