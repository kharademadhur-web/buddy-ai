import { useEffect, useRef } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import Sidebar from "@/components/Sidebar";
import MobileBottomNav from "@/components/MobileBottomNav";
import DoctorAvailabilityBar from "@/components/DoctorAvailabilityBar";
import { useDoctorPortal } from "@/context/DoctorPortalContext";
import { useKeyboardVisible } from "@/hooks/useKeyboardVisible";

function DoctorHashRedirect() {
  const { hash, pathname } = useLocation();
  const navigate = useNavigate();
  const base = "/doctor-dashboard";

  useEffect(() => {
    const raw = hash.replace(/^#/, "").toLowerCase();
    if (!raw) return;
    const map: Record<string, string> = {
      queue: `${base}/queue`,
      rx: `${base}/prescriptions`,
      prescription: `${base}/prescriptions`,
      analytics: `${base}/analytics`,
      reports: `${base}/queue#visit-reports`,
      "visit-reports": `${base}/queue#visit-reports`,
      settings: `${base}/settings`,
    };
    const target = map[raw];
    const normalized = pathname.replace(/\/$/, "") || "/";
    if (target && normalized === base) {
      navigate(target, { replace: true });
    }
  }, [hash, pathname, navigate]);

  return null;
}

export default function DoctorPortalLayout() {
  const { rows } = useDoctorPortal();
  const { pathname } = useLocation();
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const keyboardVisible = useKeyboardVisible();

  useEffect(() => {
    if (!scrollContainerRef.current) return;
    scrollContainerRef.current.scrollTo({ top: 0, behavior: "auto" });
  }, [pathname]);

  return (
    <div className="flex min-h-screen flex-col md:flex-row bg-gray-50">
      <DoctorHashRedirect />

      {/* Sidebar: hidden on mobile, shown on tablet+ */}
      <Sidebar role="doctor" queueCount={rows.length} />

      {/* Main content area */}
      <div
        className="flex-1 flex flex-col overflow-hidden min-h-0 w-full min-w-0 pt-14 md:pt-0"
        style={{
          // Account for top status bar on Android
          paddingTop: `max(env(safe-area-inset-top), 56px)`,
        }}
      >
        <div className="hidden md:block">
          <DoctorAvailabilityBar />
        </div>
        <div className="md:hidden">
          <DoctorAvailabilityBar />
        </div>

        {/* Scrollable content — add bottom padding on mobile so bottom nav doesn't cover content */}
        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto min-h-0 pb-[env(safe-area-inset-bottom)]"
          style={{ paddingBottom: keyboardVisible ? 0 : "calc(64px + env(safe-area-inset-bottom))" }}
        >
          <Outlet />
        </div>
      </div>

      {/* Mobile bottom navigation */}
      <MobileBottomNav role="doctor" queueCount={rows.length} keyboardVisible={keyboardVisible} />
    </div>
  );
}
