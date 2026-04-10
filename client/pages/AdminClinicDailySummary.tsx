import { useCallback, useEffect, useState } from "react";
import { Loader2, IndianRupee, CalendarCheck } from "lucide-react";
import { useAdminAuth } from "@/context/AdminAuthContext";
import { apiFetch, apiErrorMessage, errorMessageFromUnknown } from "@/lib/api-base";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function AdminClinicDailySummary() {
  const { user } = useAdminAuth();
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalCollected, setTotalCollected] = useState(0);
  const [completedToday, setCompletedToday] = useState(0);

  const load = useCallback(async () => {
    if (!user || user.role !== "clinic-admin") return;
    try {
      setLoading(true);
      setError(null);
      const qs = new URLSearchParams({ date });
      const res = await apiFetch(`/api/billing/summary?${qs.toString()}`);
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(apiErrorMessage(json));
      }
      const s = json.summary as { totalCollected?: number; completedToday?: number };
      setTotalCollected(Number(s.totalCollected ?? 0));
      setCompletedToday(Number(s.completedToday ?? 0));
    } catch (e) {
      setError(errorMessageFromUnknown(e, "Failed to load summary"));
    } finally {
      setLoading(false);
    }
  }, [date, user]);

  useEffect(() => {
    if (!user || user.role !== "clinic-admin") return;
    load();
  }, [user, load]);

  if (!user) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (user.role !== "clinic-admin") {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        Sign in as a clinic admin to see collections and visit counts for your clinic.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Daily summary</h2>
        <p className="mt-1 text-gray-600">
          Patient bill collections and completed visits for your clinic (from billing data).
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-2">
          <Label htmlFor="summary-date">Date</Label>
          <Input
            id="summary-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-[200px]"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex min-h-[24vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Collected (paid bills)</CardTitle>
              <CardDescription>{date}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-3xl font-bold text-gray-900">
                  ₹{totalCollected.toLocaleString("en-IN")}
                </div>
                <IndianRupee className="h-8 w-8 text-emerald-500 opacity-40" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Completed visits</CardTitle>
              <CardDescription>Appointments marked completed that day</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-3xl font-bold text-gray-900">{completedToday}</div>
                <CalendarCheck className="h-8 w-8 text-blue-500 opacity-40" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
