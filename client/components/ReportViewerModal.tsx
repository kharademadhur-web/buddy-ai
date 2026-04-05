import { useState } from "react";
import { X, ZoomIn, ZoomOut, Download } from "lucide-react";
import { DiagnosticReport } from "@/context/ClinicContext";

interface ReportViewerModalProps {
  report: DiagnosticReport | null;
  onClose: () => void;
}

export default function ReportViewerModal({
  report,
  onClose,
}: ReportViewerModalProps) {
  const [zoom, setZoom] = useState(100);

  if (!report) return null;

  const isImage = report.mimeType.startsWith("image/");
  const isPdf = report.mimeType === "application/pdf";

  const handleDownload = () => {
    // In real app, download from server
    const link = document.createElement("a");
    link.href = report.fileUrl;
    link.download = report.fileName;
    link.click();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-96 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
          <div>
            <h3 className="font-semibold text-gray-900">{report.fileName}</h3>
            <p className="text-xs text-gray-600 mt-1">
              Uploaded on {new Date(report.createdAt).toLocaleDateString()} by{" "}
              {report.uploadedBy}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto bg-gray-100 flex items-center justify-center">
          {isImage && (
            <div className="space-y-4 w-full h-full flex flex-col items-center justify-center p-4">
              <img
                src={report.fileUrl}
                alt={report.fileName}
                style={{ maxWidth: `${zoom}%` }}
                className="max-h-full object-contain transition-all"
              />
              {/* Zoom Controls */}
              <div className="flex gap-2">
                <button
                  onClick={() => setZoom(Math.max(50, zoom - 10))}
                  className="p-2 bg-white hover:bg-gray-200 rounded-lg transition-colors"
                >
                  <ZoomOut className="w-5 h-5 text-gray-700" />
                </button>
                <span className="px-4 py-2 bg-white text-gray-700 rounded-lg font-semibold min-w-20 text-center">
                  {zoom}%
                </span>
                <button
                  onClick={() => setZoom(Math.min(200, zoom + 10))}
                  className="p-2 bg-white hover:bg-gray-200 rounded-lg transition-colors"
                >
                  <ZoomIn className="w-5 h-5 text-gray-700" />
                </button>
              </div>
            </div>
          )}

          {isPdf && (
            <div className="text-center space-y-4">
              <div className="text-6xl">📄</div>
              <p className="text-gray-600 font-semibold">PDF Document</p>
              <p className="text-sm text-gray-500">
                Click download to view in PDF viewer
              </p>
            </div>
          )}

          {!isImage && !isPdf && (
            <div className="text-center space-y-4">
              <div className="text-6xl">📎</div>
              <p className="text-gray-600 font-semibold">File Preview</p>
              <p className="text-sm text-gray-500">
                This file type cannot be previewed
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors font-semibold"
          >
            Close
          </button>
          <button
            onClick={handleDownload}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-semibold flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Download
          </button>
        </div>
      </div>
    </div>
  );
}
