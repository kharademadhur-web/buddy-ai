import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAdminAuth } from "@/context/AdminAuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Loader2 } from "lucide-react";

function getDefaultRouteForRole(role: string | undefined): string {
  switch (role) {
    case "doctor":
    case "independent":
      return "/doctor-dashboard";
    case "receptionist":
      return "/reception-dashboard";
    case "clinic-admin":
      // Clinic admin has no separate web console; reception flows match day-to-day ops.
      return "/reception-dashboard";
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

  const [formData, setFormData] = useState({
    user_id: "",
    password: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    clearError();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.user_id || !formData.password) return;

    try {
      const loggedIn = await login(formData.user_id, formData.password);
      const from = (location.state?.from?.pathname as string | undefined) || undefined;
      navigate(from || getDefaultRouteForRole(loggedIn.role), { replace: true });
    } catch {
      // handled in context
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-100 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Clinic Portal</h1>
          <p className="text-gray-600">Login for Doctor / Reception / Admin</p>
        </div>

        <Card className="shadow-lg">
          <CardHeader className="space-y-1">
            <CardTitle>Sign in</CardTitle>
            <CardDescription>Use the User ID issued during onboarding</CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {error && (
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
                  placeholder="e.g., MUM001-DOC-10234"
                  value={formData.user_id}
                  onChange={handleChange}
                  disabled={isLoading}
                  className="font-mono"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  placeholder="Enter your password"
                  value={formData.password}
                  onChange={handleChange}
                  disabled={isLoading}
                />
              </div>

              <Button
                type="submit"
                className="w-full"
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
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

