import React, { useRef, useState } from "react";
import { Upload, X, CheckCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface DocumentUploaderProps {
  label: string;
  onFileSelect: (file: File) => void;
  accept?: string;
  maxSize?: number; // in MB
  required?: boolean;
  disabled?: boolean;
  existingFile?: File | null;
}

export function DocumentUploader({
  label,
  onFileSelect,
  accept = ".pdf,.jpg,.jpeg,.png",
  maxSize = 5, // 5MB default
  required = false,
  disabled = false,
  existingFile = null,
}: DocumentUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(existingFile || null);
  const [error, setError] = useState<string>("");
  const [uploading, setUploading] = useState(false);

  const handleClick = () => {
    if (!disabled) {
      inputRef.current?.click();
    }
  };

  const validateFile = (selectedFile: File): boolean => {
    setError("");

    // Check file size
    const fileSizeMB = selectedFile.size / (1024 * 1024);
    if (fileSizeMB > maxSize) {
      setError(`File size exceeds ${maxSize}MB limit`);
      return false;
    }

    // Check file type
    const validTypes = accept.split(",").map((type) => type.trim());
    const fileExtension = "." + selectedFile.name.split(".").pop()?.toLowerCase();
    const isMimeValid = validTypes.includes(
      selectedFile.type || fileExtension
    );

    if (!isMimeValid && !validTypes.includes(fileExtension)) {
      setError("Invalid file type. Please upload a supported format.");
      return false;
    }

    return true;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];

    if (!selectedFile) {
      return;
    }

    if (validateFile(selectedFile)) {
      setFile(selectedFile);
      setError("");
      onFileSelect(selectedFile);
      toast.success(`${label} uploaded successfully`);
    } else {
      toast.error(error || "Failed to upload file");
    }
  };

  const handleClear = () => {
    setFile(null);
    setError("");
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">
        {label} {required && <span className="text-red-600">*</span>}
      </label>

      {file ? (
        <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-lg">
          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-green-900">
              {file.name}
            </p>
            <p className="text-xs text-green-700">
              {(file.size / 1024).toFixed(2)} KB
            </p>
          </div>
          <button
            type="button"
            onClick={handleClear}
            disabled={disabled || uploading}
            className="text-green-600 hover:text-green-700 disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={handleClick}
          disabled={disabled || uploading}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Upload className="w-5 h-5 text-gray-600" />
          <div className="text-left">
            <p className="text-sm font-medium text-gray-700">
              Click to upload or drag and drop
            </p>
            <p className="text-xs text-gray-600">
              Supported formats: {accept.replace(/\./g, "")}. Max size: {maxSize}MB
            </p>
          </div>
        </button>
      )}

      {error && (
        <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-red-700">{error}</p>
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleFileChange}
        disabled={disabled || uploading}
        className="hidden"
      />
    </div>
  );
}
