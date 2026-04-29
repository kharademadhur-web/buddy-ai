/**
 * Bottom navigation bar shown on mobile (<768px) for Doctor and Receptionist portals.
 * Tablet and desktop show the full sidebar instead.
 */
import { useNavigate, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  FileText,
  Bell,
  User,
} from "lucide-react";

interface BottomNavItem {
  icon: React.ElementType;
  label: string;
  path: string;
}

interface MobileBottomNavProps {
  role: "doctor" | "reception";
  queueCount?: number;
  /** When keyboard is visible, bottom nav should hide */
  keyboardVisible?: boolean;
}

const DOCTOR_ITEMS: BottomNavItem[] = [
  { icon: LayoutDashboard, label: "Home", path: "/doctor-dashboard" },
  { icon: Users, label: "Queue", path: "/doctor-dashboard/queue" },
  { icon: FileText, label: "Rx", path: "/doctor-dashboard/prescriptions" },
  { icon: User, label: "Profile", path: "/profile/basic" },
];

const RECEPTION_ITEMS: BottomNavItem[] = [
  { icon: LayoutDashboard, label: "Home", path: "/reception-dashboard" },
  { icon: Users, label: "Queue", path: "/reception-dashboard/queue" },
  { icon: FileText, label: "Intake", path: "/reception-dashboard/intake" },
  { icon: User, label: "Profile", path: "/profile/basic" },
];

export default function MobileBottomNav({ role, queueCount, keyboardVisible }: MobileBottomNavProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const items = role === "doctor" ? DOCTOR_ITEMS : RECEPTION_ITEMS;

  if (keyboardVisible) return null;

  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-gray-200 flex items-stretch"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {items.map((item) => {
        const Icon = item.icon;
        const isActive =
          item.path === "/doctor-dashboard" || item.path === "/reception-dashboard"
            ? location.pathname === item.path
            : location.pathname.startsWith(item.path);

        const isQueue = item.label === "Queue";

        return (
          <button
            key={item.path}
            type="button"
            onClick={() => navigate(item.path)}
            className={cn(
              "flex-1 flex flex-col items-center justify-center gap-0.5 py-2 min-h-[56px] transition-colors active:scale-95 relative",
              isActive ? "text-blue-600" : "text-gray-500"
            )}
            aria-label={item.label}
            aria-current={isActive ? "page" : undefined}
          >
            <span className="relative">
              <Icon className="w-5 h-5" strokeWidth={isActive ? 2.5 : 2} />
              {isQueue && typeof queueCount === "number" && queueCount > 0 && (
                <span className="absolute -top-1.5 -right-2 bg-blue-600 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center leading-none">
                  {queueCount > 9 ? "9+" : queueCount}
                </span>
              )}
            </span>
            <span className={cn("text-[10px] font-medium leading-none", isActive ? "text-blue-600" : "text-gray-500")}>
              {item.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
