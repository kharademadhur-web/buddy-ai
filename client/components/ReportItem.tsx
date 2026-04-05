import { Eye, Download, Trash2 } from "lucide-react";
import { DiagnosticReport } from "@/context/ClinicContext";
import { formatFileSize } from "@/lib/compressImage";

interface ReportItemProps {
  report: DiagnosticReport;
  badgeColor: string;
  typeLabel: string;
  onView: () => void;
  onDelete: () => void;
}

export default function ReportItem({
  report,
  badgeColor,
  typeLabel,
  onView,
  onDelete,
}: ReportItemProps) {
  const isImage = report.mimeType.startsWith("image/");

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all overflow-hidden">
      {/* Preview Area */}
      <div className="bg-gray-100 h-32 flex items-center justify-center relative overflow-hidden">
        {isImage && report.fileUrl ? (
          <img
            src={report.fileUrl}
            alt={report.fileName}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="text-4xl">📄</div>
        )}
        {/* Badge Overlay */}
        <div
          className={`absolute top-2 right-2 px-3 py-1 rounded-full text-xs font-semibold ${badgeColor}`}
        >
          {typeLabel}
        </div>
      </div>

      {/* Info Section */}
      <div className="p-4 space-y-3">
        {/* File Name */}
        <div>
          <p className="text-sm font-semibold text-gray-900 truncate">
            {report.fileName}
          </p>
          <p className="text-xs text-gray-600 mt-1">
            {formatFileSize(report.fileSize)}
          </p>
        </div>

        {/* Date & Uploader */}
        <div className="text-xs text-gray-500 space-y-1">
          <p>
            <span className="font-semibold">Uploaded:</span>{" "}
            {new Date(report.createdAt).toLocaleDateString()}
          </p>
          <p>
            <span className="font-semibold">By:</span> {report.uploadedBy}
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2 border-t border-gray-100">
          <button
            onClick={onView}
            className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg transition-colors text-sm font-semibold"
          >
            <Eye className="w-4 h-4" />
            View
          </button>
          <button
            onClick={onView}
            className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors text-sm font-semibold"
          >
            <Download className="w-4 h-4" />
            Download
          </button>
          <button
            onClick={onDelete}
            className="px-3 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
