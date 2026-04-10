import { Routes, Route, Navigate, Outlet } from "react-router-dom";
import Sidebar from "@/components/Sidebar";
import AdminDashboardSuperAdmin from "./AdminDashboardSuperAdmin";
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
import { useAdminAuth } from "@/context/AdminAuthContext";

function AdminDashboardLayout() {
  const { user } = useAdminAuth();
  const portalTitle =
    user?.role === "clinic-admin" ? "Clinic admin portal" : "Super admin portal";

  return (
    <div className="flex min-h-screen flex-col md:flex-row bg-gray-50">
      {/* Sidebar */}
      <Sidebar role="admin" />

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto min-h-0 w-full min-w-0 pt-14 md:pt-0"><div className="p-4 sm:p-6 lg:p-8"><h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4 sm:mb-8">{portalTitle}</h1>

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

        {/* Overview */}
        <Route path="overview" element={<AdminDashboardSuperAdmin />} />

        <Route path="analytics" element={<AdminAnalytics />} />

        <Route path="daily-summary" element={<AdminClinicDailySummary />} />

        {/* Clinics */}
        <Route path="clinics" element={<AdminClinics />} />
        <Route path="clinic/:clinicId" element={<ClinicDetail />} />

        {/* Users */}
        <Route path="users" element={<AdminUsers />} />

        {/* Onboarding */}
        <Route path="onboarding" element={<AdminOnboarding />} />

        {/* KYC Review */}
        <Route path="kyc" element={<AdminKycReview />} />

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

