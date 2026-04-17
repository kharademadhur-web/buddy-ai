import { useEffect, useRef } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import Sidebar from "@/components/Sidebar";
import DoctorAvailabilityBar from "@/components/DoctorAvailabilityBar";
import { useDoctorPortal } from "@/context/DoctorPortalContext";

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
      reports: `${base}/reports`,
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

  useEffect(() => {
    if (!scrollContainerRef.current) return;
    scrollContainerRef.current.scrollTo({ top: 0, behavior: "auto" });
  }, [pathname]);

  return (
    <div className="flex min-h-screen flex-col md:flex-row bg-gray-50">
      <DoctorHashRedirect />
      <Sidebar role="doctor" queueCount={rows.length} />
      <div className="flex-1 flex flex-col overflow-hidden min-h-0 w-full min-w-0 pt-14 md:pt-0">
        <DoctorAvailabilityBar />
        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto min-h-0">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
