import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AdminAuthProvider } from "./context/AdminAuthContext";
import { AdminProtectedRoute } from "./components/ProtectedRoute";
import { ClinicProvider } from "./context/ClinicContext";

import AdminDashboard from "./pages/AdminDashboard";
import NotFound from "./pages/NotFound";
import { Profile } from "./pages/Profile";

// New admin pages
import AdminLogin from "./pages/AdminLogin";
import PortalLogin from "./pages/PortalLogin";
import DoctorDashboard from "./pages/DoctorDashboard";
import ReceptionDashboard from "./pages/ReceptionDashboard";

const queryClient = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <AdminAuthProvider>
          <ClinicProvider>
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<Navigate to="/portal/login" replace />} />

                {/* Shared portal login for clinic users */}
                <Route path="/portal/login" element={<PortalLogin />} />

                {/* Staff dashboards (protected) */}
                <Route
                  path="/doctor-dashboard/*"
                  element={
                    <AdminProtectedRoute
                      requiredRole={["doctor", "independent"]}
                      redirectTo="/portal/login"
                    >
                      <DoctorDashboard />
                    </AdminProtectedRoute>
                  }
                />
                <Route
                  path="/reception-dashboard/*"
                  element={
                    <AdminProtectedRoute
                      requiredRole={["receptionist"]}
                      redirectTo="/portal/login"
                    >
                      <ReceptionDashboard />
                    </AdminProtectedRoute>
                  }
                />

                {/* Admin Auth */}
                <Route path="/admin/login" element={<AdminLogin />} />

                {/* Admin Portal (protected) - super-admin + clinic-admin (API-scoped) */}
                <Route
                  path="/admin-dashboard/*"
                  element={
                    <AdminProtectedRoute requiredRole={["super-admin", "clinic-admin"]}>
                      <AdminDashboard />
                    </AdminProtectedRoute>
                  }
                />

                <Route
                  path="/profile"
                  element={
                    <AdminProtectedRoute redirectTo="/portal/login">
                      <Navigate to="/profile/basic" replace />
                    </AdminProtectedRoute>
                  }
                />
                <Route
                  path="/profile/:section"
                  element={
                    <AdminProtectedRoute redirectTo="/portal/login">
                      <Profile />
                    </AdminProtectedRoute>
                  }
                />

                {/* Backwards-compat redirect */}
                <Route
                  path="/admin"
                  element={<Navigate to="/admin/login" replace />}
                />

                {/* Catch-all Route */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </ClinicProvider>
        </AdminAuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}
