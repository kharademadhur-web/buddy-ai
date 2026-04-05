import { DiagnosticReport } from "@/context/ClinicContext";
import ReportItem from "./ReportItem";
import { FileIcon } from "lucide-react";

interface ReportListProps {
  reports: DiagnosticReport[];
  onView: (report: DiagnosticReport) => void;
  onDelete: (reportId: string) => void;
}

export default function ReportList({ reports, onView, onDelete }: ReportListProps) {
  const getReportTypeBadgeColor = (
    type: DiagnosticReport["type"]
  ): string => {
    const colors: Record<DiagnosticReport["type"], string> = {
      xray: "bg-blue-100 text-blue-700",
      mri: "bg-purple-100 text-purple-700",
      ecg: "bg-green-100 text-green-700",
      sonography: "bg-orange-100 text-orange-700",
      "blood-test": "bg-red-100 text-red-700",
      other: "bg-gray-100 text-gray-700",
    };
    return colors[type] || colors.other;
  };

  const getReportTypeLabel = (type: DiagnosticReport["type"]): string => {
    const labels: Record<DiagnosticReport["type"], string> = {
      xray: "X-ray",
      mri: "MRI",
      ecg: "ECG",
      sonography: "Sonography",
      "blood-test": "Blood Test",
      other: "Other",
    };
    return labels[type] || "Document";
  };

  if (reports.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 text-center">
        <FileIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <p className="text-gray-500 font-semibold">No reports uploaded yet</p>
        <p className="text-sm text-gray-400 mt-2">
          Upload diagnostic reports to see them here
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-bold text-gray-900">Uploaded Reports</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {reports.map((report) => (
          <ReportItem
            key={report.id}
            report={report}
            badgeColor={getReportTypeBadgeColor(report.type)}
            typeLabel={getReportTypeLabel(report.type)}
            onView={() => onView(report)}
            onDelete={() => onDelete(report.id)}
          />
        ))}
      </div>
    </div>
  );
}
