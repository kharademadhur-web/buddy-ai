import { useLocation, Routes, Route, Navigate, Outlet } from "react-router-dom";
import Sidebar from "@/components/Sidebar";
import LetterheadManager from "@/components/LetterheadManager";
import AdminDashboardSuperAdmin from "./AdminDashboardSuperAdmin";
import AdminClinics from "./AdminClinics";
import AdminUsers from "./AdminUsers";
import AdminAnalytics from "./AdminAnalytics";
import AdminSettings from "./AdminSettings";
import AdminProfile from "./AdminProfile";
import ClinicDetail from "./ClinicDetail";
import AdminOnboarding from "./AdminOnboarding";
import AdminKycReview from "./AdminKycReview";
import AdminDeviceApprovals from "./AdminDeviceApprovals";

function AdminDashboardLayout() {
  const location = useLocation();

  const isClinicDetailRoute = location.pathname.includes("/clinic/");

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <Sidebar role="admin" />

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">Super Admin Portal</h1>

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

        {/* Clinics */}
        <Route path="clinics" element={<AdminClinics />} />
        <Route path="clinic/:clinicId" element={<ClinicDetail />} />

        {/* Users */}
        <Route path="users" element={<AdminUsers />} />

        {/* Onboarding */}
        <Route path="onboarding" element={<AdminOnboarding />} />

        {/* KYC Review */}
        <Route path="kyc" element={<AdminKycReview />} />

        {/* Analytics */}
        <Route path="analytics" element={<AdminAnalytics />} />

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
