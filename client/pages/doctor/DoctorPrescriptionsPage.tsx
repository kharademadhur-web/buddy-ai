import { useDoctorPortal } from "@/context/DoctorPortalContext";
import { FileText, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function DoctorPrescriptionsPage() {
  const { clinicId, recentConsultations, recentLoading } = useDoctorPortal();

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col gap-2 mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">Prescriptions</h1>
        <p className="text-sm text-gray-500">Recent completed visits and medicines</p>
      </div>

      {clinicId ? (
        <Card className="border-gray-200 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-600" />
              Recent prescriptions
            </CardTitle>
            <CardDescription>
              Medicines and notes from completed consultations (by patient).
            </CardDescription>
          </CardHeader>
          <CardContent>
            {recentLoading ? (
              <div className="flex items-center gap-2 text-sm text-gray-500 py-6">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading history…
              </div>
            ) : recentConsultations.length === 0 ? (
              <p className="text-sm text-gray-500 py-4">
                No completed consultations yet. When you finish a visit with medicines or notes, they will appear here.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-gray-100">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                      <th className="px-3 py-2 whitespace-nowrap">Date</th>
                      <th className="px-3 py-2 whitespace-nowrap">Patient</th>
                      <th className="px-3 py-2 whitespace-nowrap">Phone</th>
                      <th className="px-3 py-2 min-w-[200px]">Medicines</th>
                      <th className="px-3 py-2 min-w-[120px]">Notes / diagnosis</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {recentConsultations.map((c) => {
                      const dt = c.createdAt ? new Date(c.createdAt) : null;
                      const medSummary = c.prescription?.items?.length
                        ? c.prescription.items
                            .map((it) => [it.name, it.dosage, it.frequency].filter(Boolean).join(" · "))
                            .join("; ")
                        : "—";
                      const extra = c.diagnosis || c.notes || c.prescription?.notes || "—";
                      return (
                        <tr key={c.consultationId} className="bg-white hover:bg-gray-50/80">
                          <td className="px-3 py-2 whitespace-nowrap text-gray-700">
                            {dt && !Number.isNaN(dt.getTime()) ? dt.toLocaleString() : "—"}
                          </td>
                          <td className="px-3 py-2 font-medium text-gray-900">{c.patient?.name ?? "—"}</td>
                          <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{c.patient?.phone ?? "—"}</td>
                          <td className="px-3 py-2 text-gray-800">{medSummary}</td>
                          <td className="px-3 py-2 text-gray-600 max-w-md truncate" title={extra}>
                            {extra}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <p className="text-sm text-gray-500">No clinic assigned.</p>
      )}
    </div>
  );
}
