import { Routes, Route, Navigate, Outlet } from "react-router-dom";
import Sidebar from "@/components/Sidebar";
import AdminDashboardSuperAdmin from "./AdminDashboardSuperAdmin";
import AdminClinicOverview from "./AdminClinicOverview";
import AdminAnalytics from "./AdminAnalytics";
import AdminClinicDailySummary from "./AdminClinicDailySummary";
import AdminClinics from "./AdminClinics";
import AdminUsers from "./AdminUsers";
import AdminSettings from "./AdminSettings";
import AdminProfile from "./AdminProfile";
import ClinicDetail from "./ClinicDetail";
import AdminOnboarding from "./AdminOnboarding";
import AdminKycReview from "./AdminKycReview";
import AdminDeviceApprovals from "./AdminDeviceApprovals";
import AdminClinicBilling from "./AdminClinicBilling";
import AdminStaffRequests from "./AdminStaffRequests";
import { useAdminAuth } from "@/context/AdminAuthContext";
import NotificationCenter from "@/components/NotificationCenter";
import { Search, UserCircle } from "lucide-react";

function AdminOverviewGate() {
  const { user } = useAdminAuth();
  if (user?.role === "clinic-admin") return <AdminClinicOverview />;
  return <AdminDashboardSuperAdmin />;
}

function SuperAdminOnly({ children }: { children: React.ReactNode }) {
  const { user } = useAdminAuth();
  if (user?.role !== "super-admin") {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-amber-900 text-sm">
        <p className="font-semibold">Access restricted</p>
        <p className="mt-1">This page is only available to platform administrators.</p>
      </div>
    );
  }
  return <>{children}</>;
}

function AdminDashboardLayout() {
  const { user } = useAdminAuth();
  const portalTitle =
    user?.role === "clinic-admin" ? "Clinic admin portal" : "Super admin portal";

  return (
    <div className="flex min-h-screen flex-col bg-surface md:flex-row">
      {/* Sidebar */}
      <Sidebar role="admin" />

      {/* Main Content */}
      <div className="min-h-0 w-full min-w-0 flex-1 overflow-y-auto pt-14 md:pt-0">
        <header className="sticky top-0 z-30 hidden h-16 items-center justify-between border-b border-border bg-card/90 px-6 backdrop-blur md:flex">
          <div>
            <h1 className="text-xl font-bold text-text-primary">{portalTitle}</h1>
            <p className="text-xs text-text-secondary">Premium operations workspace</p>
          </div>
          <div className="flex items-center gap-2">
            <button className="rounded-xl p-2 text-text-secondary transition-colors hover:bg-primary/10" type="button" aria-label="Search">
              <Search className="h-5 w-5" />
            </button>
            <NotificationCenter />
            <div className="flex items-center gap-2 rounded-2xl border border-border bg-surface px-3 py-2">
              <UserCircle className="h-5 w-5 text-primary" />
              <span className="hidden text-sm font-semibold text-text-primary lg:inline">{user?.name ?? "Admin"}</span>
            </div>
          </div>
        </header>
        <div className="p-4 sm:p-6 lg:p-8">

          {/* Routes */}
          <Outlet />
        </div>
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  return (
    <Routes>
      <Route element={<AdminDashboardLayout />}>
        {/* Default route - redirect to overview */}
        <Route index element={<Navigate to="/admin-dashboard/overview" replace />} />

        {/* Overview — clinic-admin vs super-admin */}
        <Route path="overview" element={<AdminOverviewGate />} />

        <Route path="analytics" element={<AdminAnalytics />} />

        <Route path="daily-summary" element={<AdminClinicDailySummary />} />

        {/* Clinics */}
        <Route path="clinics" element={<AdminClinics />} />
        <Route path="clinic/:clinicId" element={<ClinicDetail />} />

        {/* Billing (clinic-admin + super-admin) */}
        <Route path="billing" element={<AdminClinicBilling />} />

        {/* Staff slot approvals */}
        <Route
          path="staff-requests"
          element={
            <SuperAdminOnly>
              <AdminStaffRequests />
            </SuperAdminOnly>
          }
        />

        {/* Users */}
        <Route path="users" element={<AdminUsers />} />

        {/* Onboarding */}
        <Route
          path="onboarding"
          element={
            <SuperAdminOnly>
              <AdminOnboarding />
            </SuperAdminOnly>
          }
        />

        {/* KYC Review */}
        <Route
          path="kyc"
          element={
            <SuperAdminOnly>
              <AdminKycReview />
            </SuperAdminOnly>
          }
        />

        {/* Settings */}
        <Route path="settings" element={<AdminSettings />} />

        {/* Device Approvals */}
        <Route path="device-approvals" element={<AdminDeviceApprovals />} />

        {/* Profile */}
        <Route path="profile" element={<AdminProfile />} />
      </Route>
    </Routes>
  );
}

