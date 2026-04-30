import { useState, useEffect, useCallback } from "react";
import ReportUploadCard from "./ReportUploadCard";
import ReportList from "./ReportList";
import ReportViewerModal from "./ReportViewerModal";
import { DiagnosticReport } from "@/context/ClinicContext";
import { toast } from "sonner";
import { apiFetch, apiErrorMessage } from "@/lib/api-base";
import { FileText } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface ReportsTabProps {
  patientId: string;
  patientName: string;
  clinicId: string;
  /** Increment to refetch the document list (e.g. after uploading from the queue). */
  reloadKey?: number;
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

export default function ReportsTab({ patientId, patientName, clinicId, reloadKey = 0 }: ReportsTabProps) {
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
      const j = await res.json().catch(() => ({}));
      // The API returns errors as { error: { message, code, status } }; using
      // `j.error` directly stringified an object as "[object Object]" in the
      // toast. apiErrorMessage handles both string and object shapes.
      if (!res.ok) throw new Error(apiErrorMessage(j) || "Failed to load documents");
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
  }, [load, reloadKey]);

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
    <div className="space-y-6 animate-fade-in">
      <ReportUploadCard patientId={patientId} onUpload={handleUpload} />

      {loading ? (
        <div className="rounded-2xl border border-border bg-card p-4">
          <Skeleton className="mb-3 h-5 w-40" />
          <Skeleton className="h-16 rounded-2xl" />
        </div>
      ) : reports.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
          <FileText className="mx-auto mb-3 h-10 w-10 text-primary/40" />
          <p className="font-semibold text-text-primary">No reports uploaded yet</p>
          <p className="text-sm text-text-secondary">Diagnostic documents for {patientName} will appear here.</p>
        </div>
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
