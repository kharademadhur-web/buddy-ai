import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAdminAuth } from "@/context/AdminAuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Loader2, Stethoscope, Monitor } from "lucide-react";
import { IS_MOBILE_BUILD } from "@/config/buildTarget";

const ADMIN_ROLES = ["super-admin", "clinic-admin"] as const;
type AdminRole = (typeof ADMIN_ROLES)[number];

function getDefaultRouteForRole(role: string | undefined): string {
  switch (role) {
    case "doctor":
    case "independent":
      return "/doctor-dashboard";
    case "receptionist":
      return "/reception-dashboard";
    case "clinic-admin":
      return "/admin-dashboard/overview";
    case "super-admin":
      return "/admin-dashboard/overview";
    default:
      return "/portal/login";
  }
}

export default function PortalLogin() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isLoading, error, clearError } = useAdminAuth();
  const [adminRoleBlocked, setAdminRoleBlocked] = useState<AdminRole | null>(null);

  const [formData, setFormData] = useState({
    user_id: "",
    password: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    clearError();
    setAdminRoleBlocked(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.user_id || !formData.password) return;

    try {
      const loggedIn = await login(formData.user_id, formData.password);
      const role = loggedIn.role as string;

      // On mobile build, block admin roles with a helpful message
      if (IS_MOBILE_BUILD && ADMIN_ROLES.includes(role as AdminRole)) {
        setAdminRoleBlocked(role as AdminRole);
        return;
      }

      const from = (location.state?.from?.pathname as string | undefined) || undefined;
      navigate(from || getDefaultRouteForRole(role), { replace: true });
    } catch {
      // error handled in context
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-100 p-4 safe-area-inset">
      <div className="w-full max-w-md">
        {/* App header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-3">
            <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl p-4 shadow-lg">
              <Stethoscope className="w-10 h-10 text-white" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-1">
            {IS_MOBILE_BUILD ? "SmartClinic" : "Clinic Portal"}
          </h1>
          <p className="text-gray-500 text-sm">
            {IS_MOBILE_BUILD ? "Doctor & Receptionist Login" : "Login for Doctor / Reception / Admin"}
          </p>
        </div>

        <Card className="shadow-lg">
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl">Sign in</CardTitle>
            <CardDescription>
              Use the User ID issued during onboarding.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Admin blocked on mobile */}
            {adminRoleBlocked && IS_MOBILE_BUILD && (
              <Alert className="border-amber-300 bg-amber-50">
                <Monitor className="h-4 w-4 text-amber-700" />
                <AlertDescription className="text-amber-900 text-sm">
                  <p className="font-semibold mb-1">Admin portal is web-only</p>
                  <p>
                    The <span className="font-semibold">{adminRoleBlocked}</span> portal is not available on the mobile
                    app. Please open a browser on your computer and go to your clinic's admin URL to access admin
                    features.
                  </p>
                </AlertDescription>
              </Alert>
            )}

            {error && !adminRoleBlocked && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="user_id">User ID</Label>
                <Input
                  id="user_id"
                  name="user_id"
                  type="text"
                  autoComplete="username"
                  placeholder="User ID"
                  value={formData.user_id}
                  onChange={handleChange}
                  disabled={isLoading}
                  className="h-12 font-mono text-base"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  value={formData.password}
                  onChange={handleChange}
                  disabled={isLoading}
                  className="h-12 text-base"
                />
              </div>

              <Button
                type="submit"
                className="w-full h-12 text-base active:scale-95 transition-transform"
                disabled={isLoading || !formData.user_id || !formData.password}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Logging in...
                  </>
                ) : (
                  "Login"
                )}
              </Button>
            </form>

            {/* Mobile info note */}
            {IS_MOBILE_BUILD && (
              <p className="text-xs text-center text-gray-400 pt-2">
                This app is for Doctors and Receptionists only.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
