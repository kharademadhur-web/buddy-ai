import { useEffect } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import Sidebar from "@/components/Sidebar";
import MobileBottomNav from "@/components/MobileBottomNav";
import { useReceptionPortal } from "@/context/ReceptionPortalContext";
import { useKeyboardVisible } from "@/hooks/useKeyboardVisible";

function ReceptionHashRedirect() {
  const { hash, pathname } = useLocation();
  const navigate = useNavigate();
  const base = "/reception-dashboard";

  useEffect(() => {
    const raw = hash.replace(/^#/, "").toLowerCase();
    if (!raw) return;
    const map: Record<string, string> = {
      queue: `${base}/queue`,
      rx: `${base}/intake`,
      prescription: `${base}/intake`,
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

export default function ReceptionPortalLayout() {
  const { queue } = useReceptionPortal();
  const keyboardVisible = useKeyboardVisible();

  return (
    <div className="flex min-h-screen flex-col md:flex-row bg-gray-50">
      <ReceptionHashRedirect />

      {/* Sidebar: hidden on mobile, shown on tablet+ */}
      <Sidebar role="reception" queueCount={queue.length} />

      {/* Main content */}
      <div
        className="flex-1 overflow-y-auto min-h-0 w-full min-w-0 pt-14 md:pt-0"
        style={{
          paddingTop: `max(env(safe-area-inset-top), 56px)`,
          paddingBottom: keyboardVisible ? 0 : "calc(64px + env(safe-area-inset-bottom))",
        }}
      >
        <Outlet />
      </div>

      {/* Mobile bottom navigation */}
      <MobileBottomNav role="reception" queueCount={queue.length} keyboardVisible={keyboardVisible} />
    </div>
  );
}
