import { useEffect } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import Sidebar from "@/components/Sidebar";
import { useReceptionPortal } from "@/context/ReceptionPortalContext";

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

  return (
    <div className="flex min-h-screen flex-col md:flex-row bg-gray-50">
      <ReceptionHashRedirect />
      <Sidebar role="reception" queueCount={queue.length} />
      <div className="flex-1 overflow-y-auto min-h-0 w-full min-w-0 pt-14 md:pt-0">
        <Outlet />
      </div>
    </div>
  );
}
