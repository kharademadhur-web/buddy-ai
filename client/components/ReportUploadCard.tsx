import { useState } from "react";
import { Upload, FileIcon, Image, X, Loader } from "lucide-react";
import {
  compressImage,
  formatFileSize,
  isValidFileSize,
  isValidFileType,
} from "@/lib/compressImage";
import { cn } from "@/lib/utils";
import { useAdminAuth } from "@/context/AdminAuthContext";
import { apiUrl } from "@/lib/api-base";

interface ReportUploadCardProps {
  patientId?: string;
  onUpload: (data: {
    type: string;
    fileName: string;
    fileSize: number;
    fileUrl: string;
    mimeType: string;
  }) => void;
  isLoading?: boolean;
}

export default function ReportUploadCard({
  patientId,
  onUpload,
  isLoading = false,
}: ReportUploadCardProps) {
  const { tokens } = useAdminAuth();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [reportType, setReportType] = useState("xray");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reportTypes = [
    { value: "xray", label: "X-ray", icon: "📷" },
    { value: "mri", label: "MRI", icon: "🧲" },
    { value: "ecg", label: "ECG", icon: "❤️" },
    { value: "sonography", label: "Sonography", icon: "🔊" },
    { value: "blood-test", label: "Blood Test", icon: "🩸" },
    { value: "other", label: "Other", icon: "📄" },
  ];

  const handleFileSelect = async (file: File) => {
    setError(null);

    // Validate file type
    if (!isValidFileType(file)) {
      setError("Invalid file type. Please upload an image (JPG, PNG, WebP) or PDF");
      return;
    }

    // Validate file size
    if (!isValidFileSize(file)) {
      setError("File is too large. Maximum size is 10MB");
      return;
    }

    setSelectedFile(file);

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreviewUrl(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setUploading(true);
    try {
      let fileUrl: string;
      let compressedFile = selectedFile;
      let mimeType = selectedFile.type;

      // Compress if image
      if (selectedFile.type.startsWith("image/")) {
        const compressedBlob = await compressImage(selectedFile);
        compressedFile = new File([compressedBlob], selectedFile.name, {
          type: "image/jpeg",
        });
        mimeType = "image/jpeg";
      }

      if (!tokens?.accessToken) {
        throw new Error("Not authenticated");
      }

      const form = new FormData();
      form.append("file", compressedFile, selectedFile.name);
      form.append("type", reportType);
      if (patientId) form.append("patientId", patientId);

      const response = await fetch(apiUrl("/api/uploads/report"), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokens.accessToken}`,
        },
        body: form,
      });

      const data = await response.json();
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || data?.message || "Upload failed");
      }

      fileUrl = data.document?.signedUrl;
      if (!fileUrl) throw new Error("Upload succeeded but no URL returned");

      onUpload({
        type: reportType,
        fileName: selectedFile.name,
        fileSize: compressedFile.size,
        fileUrl,
        mimeType,
      });

      // Reset form
      setSelectedFile(null);
      setPreviewUrl(null);
      setReportType("xray");
    } catch (err) {
      setError("Failed to upload file. Please try again.");
      console.error(err);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
      <h3 className="text-lg font-bold text-gray-900 mb-6">
        Upload Diagnostic Report
      </h3>

      <div className="space-y-4">
        {/* Report Type Selection */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-3">
            Report Type
          </label>
          <div className="grid grid-cols-3 gap-2">
            {reportTypes.map((type) => (
              <button
                key={type.value}
                onClick={() => setReportType(type.value)}
                className={cn(
                  "px-3 py-2 rounded-lg border-2 text-sm font-semibold transition-all flex items-center justify-center gap-1",
                  reportType === type.value
                    ? "border-blue-600 bg-blue-50 text-blue-700"
                    : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
                )}
              >
                <span>{type.icon}</span>
                <span className="hidden sm:inline">{type.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* File Upload Area */}
        <div
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          className={cn(
            "border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer",
            selectedFile
              ? "border-blue-400 bg-blue-50"
              : "border-gray-300 bg-gray-50 hover:border-gray-400"
          )}
        >
          {!selectedFile ? (
            <>
              <Upload className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-700 font-semibold mb-1">
                Click to upload or drag and drop
              </p>
              <p className="text-xs text-gray-600 mb-4">
                Supports: JPG, PNG, WebP, PDF (Max 10MB)
              </p>
              <input
                type="file"
                accept="image/*,.pdf"
                onChange={(e) => {
                  if (e.target.files?.[0]) {
                    handleFileSelect(e.target.files[0]);
                  }
                }}
                className="hidden"
                id="file-input"
              />
              <label
                htmlFor="file-input"
                className="inline-block px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors cursor-pointer"
              >
                Choose File
              </label>
            </>
          ) : (
            <div className="space-y-4">
              {/* File Preview */}
              <div>
                {previewUrl && selectedFile.type.startsWith("image/") && (
                  <img
                    src={previewUrl}
                    alt="Preview"
                    className="max-h-40 mx-auto rounded-lg"
                  />
                )}
                {!selectedFile.type.startsWith("image/") && (
                  <FileIcon className="w-12 h-12 text-gray-400 mx-auto" />
                )}
              </div>

              {/* File Info */}
              <div className="text-left space-y-2 bg-white rounded-lg p-4 border border-gray-200">
                <p className="font-semibold text-gray-900 text-sm break-words">
                  {selectedFile.name}
                </p>
                <p className="text-xs text-gray-600">
                  Size: {formatFileSize(selectedFile.size)}
                </p>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setSelectedFile(null);
                    setPreviewUrl(null);
                  }}
                  className="flex-1 px-4 py-2 border-2 border-gray-300 text-gray-700 rounded-lg font-semibold hover:border-gray-400 transition-colors flex items-center justify-center gap-2"
                >
                  <X className="w-4 h-4" />
                  Change
                </button>
                <button
                  onClick={() => {
                    const input = document.getElementById("file-input") as HTMLInputElement;
                    input?.click();
                  }}
                  className="flex-1 px-4 py-2 border-2 border-blue-600 text-blue-600 rounded-lg font-semibold hover:bg-blue-50 transition-colors"
                >
                  Browse
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Upload Button */}
        <button
          onClick={handleUpload}
          disabled={!selectedFile || uploading}
          className={cn(
            "w-full py-3 rounded-lg font-semibold transition-all flex items-center justify-center gap-2",
            selectedFile && !uploading
              ? "bg-blue-600 hover:bg-blue-700 text-white cursor-pointer"
              : "bg-gray-200 text-gray-500 cursor-not-allowed"
          )}
        >
          {uploading ? (
            <>
              <Loader className="w-5 h-5 animate-spin" />
              Uploading...
            </>
          ) : (
            <>
              <Upload className="w-5 h-5" />
              Upload Report
            </>
          )}
        </button>
      </div>
    </div>
  );
}
