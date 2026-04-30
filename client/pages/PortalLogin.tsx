import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAdminAuth } from "@/context/AdminAuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Loader2, Stethoscope, Monitor, ShieldCheck, Sparkles, Users } from "lucide-react";
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

      // On mobile build, only super-admin is web-only; clinic-admin remains available.
      if (IS_MOBILE_BUILD && role === "super-admin") {
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
    <div className="min-h-screen bg-surface safe-area-inset lg:grid lg:grid-cols-[1.05fr_0.95fr]">
      <section className="relative overflow-hidden bg-gradient-to-br from-primary-dark via-primary to-primary-light p-6 text-white lg:flex lg:min-h-screen lg:flex-col lg:justify-between lg:p-12">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(244,162,97,0.35),transparent_30%),radial-gradient(circle_at_80%_80%,rgba(255,255,255,0.18),transparent_30%)]" />
        <div className="relative">
          <div className="mb-8 flex items-center gap-3">
            <div className="rounded-2xl bg-white/15 p-3 shadow-lg backdrop-blur">
              <Stethoscope className="h-8 w-8" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-white">SmartClinic</h1>
              <p className="text-sm text-white/75">Buddy AI clinical workspace</p>
            </div>
          </div>
          <div className="max-w-xl">
            <p className="mb-3 inline-flex rounded-full bg-white/15 px-3 py-1 text-xs font-semibold backdrop-blur">
              Modern medical operations
            </p>
            <h2 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
              Smarter clinics. Healthier patients.
            </h2>
            <p className="mt-4 text-base text-white/80">
              Queue, consultation, billing, staff, and follow-ups in one calm, touch-friendly workspace.
            </p>
          </div>
        </div>
        <div className="relative mt-8 grid gap-3 sm:grid-cols-3 lg:mt-0">
          {[
            { icon: ShieldCheck, title: "Secure access" },
            { icon: Users, title: "Role-aware portals" },
            { icon: Sparkles, title: "AI-ready workflows" },
          ].map((item) => (
            <div key={item.title} className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur">
              <item.icon className="mb-3 h-5 w-5 text-accent" />
              <p className="text-sm font-semibold text-white">{item.title}</p>
            </div>
          ))}
        </div>
      </section>

      <main className="flex min-h-screen items-center justify-center p-4 sm:p-8">
        <Card className="w-full max-w-md border-0 shadow-2xl hover:translate-y-0">
          <CardHeader className="space-y-2">
            <CardTitle className="text-3xl">Welcome back</CardTitle>
            <CardDescription>Use the User ID issued during onboarding.</CardDescription>
            <div className="grid grid-cols-3 gap-2 rounded-2xl bg-surface p-1 text-xs font-semibold">
              {["Doctor", "Reception", "Admin"].map((role) => (
                <span key={role} className="rounded-xl bg-card px-3 py-2 text-center text-text-secondary shadow-sm">
                  {role}
                </span>
              ))}
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Admin blocked on mobile */}
            {(adminRoleBlocked || new URLSearchParams(location.search).get("blocked") === "super-admin") && IS_MOBILE_BUILD && (
              <Alert className="border-amber-300 bg-amber-50">
                <Monitor className="h-4 w-4 text-amber-700" />
                <AlertDescription className="text-amber-900 text-sm">
                  <p className="font-semibold mb-1">Super admin access is only available on the web platform</p>
                  <p>Please open the web admin portal on desktop to access the platform-wide super-admin view.</p>
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
                className="h-12 w-full bg-accent text-base hover:bg-accent-dark"
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
                Mobile includes Doctor, Receptionist, and Clinic Admin portals.
              </p>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
