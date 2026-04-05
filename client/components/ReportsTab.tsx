import { useState, useEffect, useCallback } from "react";
import ReportUploadCard from "./ReportUploadCard";
import ReportList from "./ReportList";
import ReportViewerModal from "./ReportViewerModal";
import { DiagnosticReport } from "@/context/ClinicContext";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-base";

interface ReportsTabProps {
  patientId: string;
  patientName: string;
  clinicId: string;
}

function mapDocType(t: string): DiagnosticReport["type"] {
  const allowed: DiagnosticReport["type"][] = [
    "xray",
    "mri",
    "ecg",
    "sonography",
    "blood-test",
    "other",
  ];
  return (allowed.includes(t as DiagnosticReport["type"]) ? t : "other") as DiagnosticReport["type"];
}

export default function ReportsTab({ patientId, patientName, clinicId }: ReportsTabProps) {
  const [reports, setReports] = useState<DiagnosticReport[]>([]);
  const [viewingReport, setViewingReport] = useState<DiagnosticReport | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({
        patientId,
        clinicId,
      });
      const res = await apiFetch(`/api/uploads/documents?${qs.toString()}`);
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Failed to load documents");
      const list: DiagnosticReport[] = (j.documents || []).map((d: Record<string, unknown>) => ({
        id: String(d.id),
        patientId,
        patientName,
        type: mapDocType(String(d.document_type || "other")),
        fileName: String(d.file_name || "file"),
        fileUrl: String(d.signedUrl || ""),
        fileSize: Number(d.size_bytes || 0),
        mimeType: String(d.content_type || "application/octet-stream"),
        createdAt: new Date(String(d.created_at || Date.now())),
        uploadedBy: "Staff",
      }));
      setReports(list);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load reports");
      setReports([]);
    } finally {
      setLoading(false);
    }
  }, [patientId, patientName, clinicId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleUpload = (_data: {
    type: string;
    fileName: string;
    fileSize: number;
    fileUrl: string;
    mimeType: string;
  }) => {
    void load();
    toast.success("Report uploaded successfully!");
  };

  const handleDelete = (_reportId: string) => {
    toast.message("Remove files from the admin documents list in Supabase if needed.");
  };

  return (
    <div className="space-y-6">
      <ReportUploadCard patientId={patientId} onUpload={handleUpload} />

      {loading ? (
        <p className="text-sm text-gray-500">Loading reports…</p>
      ) : (
        <ReportList
          reports={reports}
          onView={setViewingReport}
          onDelete={handleDelete}
        />
      )}

      <ReportViewerModal report={viewingReport} onClose={() => setViewingReport(null)} />
    </div>
  );
}
