import { Routes, Route, Navigate } from "react-router-dom";
import { ReceptionPortalProvider } from "@/context/ReceptionPortalContext";
import ReceptionPortalLayout from "@/pages/reception/ReceptionPortalLayout";
import ReceptionOverviewPage from "@/pages/reception/ReceptionOverviewPage";
import ReceptionQueuePage from "@/pages/reception/ReceptionQueuePage";
import ReceptionIntakePage from "@/pages/reception/ReceptionIntakePage";
import ReceptionSettingsPage from "@/pages/reception/ReceptionSettingsPage";

export default function ReceptionDashboard() {
  return (
    <ReceptionPortalProvider>
      <Routes>
        <Route element={<ReceptionPortalLayout />}>
          <Route index element={<ReceptionOverviewPage />} />
          <Route path="queue" element={<ReceptionQueuePage />} />
          <Route path="intake" element={<ReceptionIntakePage />} />
          <Route path="settings" element={<ReceptionSettingsPage />} />
          <Route path="*" element={<Navigate to="/reception-dashboard" replace />} />
        </Route>
      </Routes>
    </ReceptionPortalProvider>
  );
}
