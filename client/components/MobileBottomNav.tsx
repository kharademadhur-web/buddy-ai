/**
 * Bottom navigation bar shown on mobile (<768px) for Doctor and Receptionist portals.
 * Tablet and desktop show the full sidebar instead.
 */
import { useNavigate, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { LayoutDashboard, Users, FileText, User, Settings } from "lucide-react";

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
  { icon: Settings, label: "More", path: "/doctor-dashboard/settings" },
];

const RECEPTION_ITEMS: BottomNavItem[] = [
  { icon: LayoutDashboard, label: "Home", path: "/reception-dashboard" },
  { icon: Users, label: "Queue", path: "/reception-dashboard/queue" },
  { icon: FileText, label: "Intake", path: "/reception-dashboard/intake" },
  { icon: User, label: "Profile", path: "/profile/basic" },
  { icon: Settings, label: "More", path: "/reception-dashboard/settings" },
];

export default function MobileBottomNav({ role, queueCount, keyboardVisible }: MobileBottomNavProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const items = role === "doctor" ? DOCTOR_ITEMS : RECEPTION_ITEMS;

  if (keyboardVisible) return null;

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 flex items-stretch border-t border-border bg-card/95 shadow-[0_-12px_30px_rgba(26,26,46,0.08)] backdrop-blur md:hidden"
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
              "relative flex min-h-[60px] flex-1 flex-col items-center justify-center gap-0.5 py-2 transition-all active:scale-95",
              isActive ? "text-primary" : "text-text-muted"
            )}
            aria-label={item.label}
            aria-current={isActive ? "page" : undefined}
          >
            <span className="relative">
              <Icon className="h-5 w-5" strokeWidth={isActive ? 2.7 : 2} fill={isActive ? "currentColor" : "none"} />
              {isQueue && typeof queueCount === "number" && queueCount > 0 && (
                <span className="absolute -right-2 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-error text-[10px] font-bold leading-none text-white">
                  {queueCount > 9 ? "9+" : queueCount}
                </span>
              )}
            </span>
            <span className={cn("text-[10px] font-semibold leading-none", isActive ? "text-primary" : "text-text-muted")}>
              {item.label}
            </span>
            {isActive ? <span className="absolute bottom-0 h-0.5 w-8 rounded-full bg-accent" /> : null}
          </button>
        );
      })}
    </nav>
  );
}
