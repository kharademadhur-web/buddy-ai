import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAdminAuth } from "@/context/AdminAuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, AlertCircle, BarChart3, Building2, ShieldCheck, Stethoscope } from "lucide-react";

export default function AdminLogin() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isLoading, error, clearError } = useAdminAuth();

  const [formData, setFormData] = useState({
    user_id: "",
    password: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    clearError();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.user_id || !formData.password) {
      return;
    }

    try {
      const loggedIn = await login(formData.user_id, formData.password);

      const from = (location.state?.from?.pathname as string) || undefined;
      const fallback =
        loggedIn.role === "super-admin"
          ? "/admin-dashboard/overview"
          : loggedIn.role === "clinic-admin"
            ? "/admin-dashboard/overview"
            : loggedIn.role === "doctor" || loggedIn.role === "independent"
              ? "/doctor-dashboard"
              : loggedIn.role === "receptionist"
                ? "/reception-dashboard"
                : "/admin-dashboard/overview";
      navigate(from || fallback, { replace: true });
    } catch (err) {
      // Error is handled by context
      console.error("Login error:", err);
    }
  };

  return (
    <div className="min-h-screen bg-surface lg:grid lg:grid-cols-[1fr_0.95fr]">
      <section className="relative overflow-hidden bg-gradient-to-br from-text-primary via-primary-dark to-primary p-8 text-white lg:flex lg:min-h-screen lg:flex-col lg:justify-between lg:p-12">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_20%,rgba(244,162,97,0.35),transparent_32%)]" />
        <div className="relative">
          <div className="mb-10 flex items-center gap-3">
            <div className="rounded-2xl bg-white/15 p-3 backdrop-blur">
              <Stethoscope className="h-8 w-8" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-white">SmartClinic Admin</h1>
              <p className="text-sm text-white/70">Platform command center</p>
            </div>
          </div>
          <h2 className="max-w-xl text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
            Premium control for modern clinics.
          </h2>
          <p className="mt-4 max-w-lg text-white/75">
            Manage clinics, staff approvals, billing, subscriptions, and operational health from a single web console.
          </p>
        </div>
        <div className="relative mt-8 grid gap-3 sm:grid-cols-3 lg:mt-0">
          {[
            { icon: Building2, label: "Clinics" },
            { icon: BarChart3, label: "Revenue" },
            { icon: ShieldCheck, label: "Approvals" },
          ].map((item) => (
            <div key={item.label} className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur">
              <item.icon className="mb-3 h-5 w-5 text-accent" />
              <p className="text-sm font-semibold text-white">{item.label}</p>
            </div>
          ))}
        </div>
      </section>

      <main className="flex min-h-screen items-center justify-center p-4 sm:p-8">
        <Card className="w-full max-w-md border-0 shadow-2xl hover:translate-y-0">
          <CardHeader className="space-y-1">
            <CardTitle className="text-3xl">Welcome back</CardTitle>
            <CardDescription>Enter your credentials to access the admin panel.</CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Error Alert */}
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Login Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* User ID Input */}
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
                  className="font-mono"
                />
              </div>

              {/* Password Input */}
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
                />
              </div>

              {/* Submit Button */}
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

            {/* Helper Text */}
            <div className="border-t pt-4 text-center text-xs text-text-secondary">
              <p>Default credentials will be provided during onboarding</p>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
