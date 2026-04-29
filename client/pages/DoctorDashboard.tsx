import { Routes, Route, Navigate } from "react-router-dom";
import { DoctorPortalProvider } from "@/context/DoctorPortalContext";
import DoctorPortalLayout from "@/pages/doctor/DoctorPortalLayout";
import DoctorOverviewPage from "@/pages/doctor/DoctorOverviewPage";
import DoctorQueuePage from "@/pages/doctor/DoctorQueuePage";
import DoctorConsultationPage from "@/pages/doctor/DoctorConsultationPage";
import DoctorPrescriptionsPage from "@/pages/doctor/DoctorPrescriptionsPage";
import DoctorReportsPage from "@/pages/doctor/DoctorReportsPage";
import DoctorAnalyticsPage from "@/pages/doctor/DoctorAnalyticsPage";
import DoctorSettingsPage from "@/pages/doctor/DoctorSettingsPage";
import FollowUpScheduler from "@/pages/FollowUpScheduler";

export default function DoctorDashboard() {
  return (
    <DoctorPortalProvider>
      <Routes>
        <Route element={<DoctorPortalLayout />}>
          <Route index element={<DoctorOverviewPage />} />
          <Route path="queue" element={<DoctorQueuePage />} />
          <Route path="queue/:appointmentId" element={<DoctorConsultationPage />} />
          <Route path="reports" element={<DoctorReportsPage />} />
          <Route path="prescriptions" element={<DoctorPrescriptionsPage />} />
          <Route path="follow-ups" element={<FollowUpScheduler />} />
          <Route path="analytics" element={<DoctorAnalyticsPage />} />
          <Route path="settings" element={<DoctorSettingsPage />} />
          <Route path="*" element={<Navigate to="/doctor-dashboard" replace />} />
        </Route>
      </Routes>
    </DoctorPortalProvider>
  );
}
