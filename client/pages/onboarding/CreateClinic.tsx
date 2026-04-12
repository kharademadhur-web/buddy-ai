import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, Loader2, Upload, FileImage } from "lucide-react";

interface CreateClinicProps {
  onNext: (data: any) => void;
  isLoading?: boolean;
  error?: string;
}

export function CreateClinic({
  onNext,
  isLoading = false,
  error,
}: CreateClinicProps) {
  const [formData, setFormData] = useState({
    name: "",
    address: "",
    phone: "",
    email: "",
    letterheadFile: null as File | null,
    paymentQrFile: null as File | null,
  });

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [letterheadPreview, setLetterheadPreview] = useState<string | null>(null);

  const validateForm = () => {
    const errors: Record<string, string> = {};

    if (!formData.name.trim()) {
      errors.name = "Clinic name is required";
    }
    if (!formData.address.trim()) {
      errors.address = "Address is required";
    }
    if (!formData.phone.trim()) {
      errors.phone = "Phone number is required";
    } else if (!/^[0-9\-\+\(\)\s]+$/.test(formData.phone)) {
      errors.phone = "Invalid phone number format";
    }
    if (!formData.email.trim()) {
      errors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = "Invalid email format";
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (formErrors[name]) {
      setFormErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const handleLetterheadChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setFormData((prev) => ({ ...prev, letterheadFile: file }));
    if (file && file.type.startsWith("image/")) {
      const url = URL.createObjectURL(file);
      setLetterheadPreview(url);
    } else {
      setLetterheadPreview(null);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      onNext(formData);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Create Clinic</h2>
        <p className="text-gray-600 mt-2">
          Enter your clinic information to get started
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="w-5 h-5 text-red-600" />
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="name" className="text-sm font-medium">
            Clinic Name *
          </Label>
          <Input
            id="name"
            name="name"
            placeholder="Enter clinic name"
            value={formData.name}
            onChange={handleChange}
            disabled={isLoading}
            className={formErrors.name ? "border-red-500" : ""}
          />
          {formErrors.name && (
            <p className="text-sm text-red-600 mt-1">{formErrors.name}</p>
          )}
        </div>

        <div>
          <Label htmlFor="email" className="text-sm font-medium">
            Email Address *
          </Label>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="clinic@example.com"
            value={formData.email}
            onChange={handleChange}
            disabled={isLoading}
            className={formErrors.email ? "border-red-500" : ""}
          />
          {formErrors.email && (
            <p className="text-sm text-red-600 mt-1">{formErrors.email}</p>
          )}
        </div>

        <div>
          <Label htmlFor="phone" className="text-sm font-medium">
            Phone Number *
          </Label>
          <Input
            id="phone"
            name="phone"
            placeholder="+91 XXXXX XXXXX"
            value={formData.phone}
            onChange={handleChange}
            disabled={isLoading}
            className={formErrors.phone ? "border-red-500" : ""}
          />
          {formErrors.phone && (
            <p className="text-sm text-red-600 mt-1">{formErrors.phone}</p>
          )}
        </div>

        <div>
          <Label htmlFor="address" className="text-sm font-medium">
            Clinic Address *
          </Label>
          <Input
            id="address"
            name="address"
            placeholder="Enter clinic address"
            value={formData.address}
            onChange={handleChange}
            disabled={isLoading}
            className={formErrors.address ? "border-red-500" : ""}
          />
          {formErrors.address && (
            <p className="text-sm text-red-600 mt-1">{formErrors.address}</p>
          )}
        </div>

        {/* Letterhead Upload */}
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <FileImage className="w-5 h-5 text-blue-600" />
            <p className="text-sm font-semibold text-gray-800">Clinic Letterhead</p>
          </div>
          <p className="text-xs text-gray-600">
            Upload your clinic's printed letterhead (JPG/PNG). This will appear as the background on every
            patient prescription the receptionist fills and the doctor views.
          </p>

          <label
            htmlFor="letterheadFile"
            className={`flex items-center gap-3 cursor-pointer rounded-lg border-2 border-dashed p-4 transition-colors ${
              formData.letterheadFile
                ? "border-green-400 bg-green-50"
                : "border-blue-300 hover:border-blue-400 bg-white"
            }`}
          >
            <Upload className={`w-5 h-5 ${formData.letterheadFile ? "text-green-600" : "text-blue-500"}`} />
            <div className="flex-1 min-w-0">
              {formData.letterheadFile ? (
                <p className="text-sm font-medium text-green-700 truncate">{formData.letterheadFile.name}</p>
              ) : (
                <p className="text-sm text-gray-500">Click to upload letterhead image (JPG/PNG)</p>
              )}
            </div>
            <Input
              id="letterheadFile"
              type="file"
              accept=".jpg,.jpeg,.png"
              onChange={handleLetterheadChange}
              disabled={isLoading}
              className="sr-only"
            />
          </label>

          {letterheadPreview && (
            <div className="rounded-lg overflow-hidden border border-gray-200 max-h-48">
              <img
                src={letterheadPreview}
                alt="Letterhead preview"
                className="w-full object-contain max-h-48"
              />
            </div>
          )}
          <p className="text-xs text-gray-500">Optional — can be added later from clinic settings.</p>
        </div>

        <div className="rounded-lg border border-emerald-200 bg-emerald-50/80 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <FileImage className="w-5 h-5 text-emerald-700" />
            <p className="text-sm font-semibold text-gray-800">Business payment QR (UPI)</p>
          </div>
          <p className="text-xs text-gray-600">
            Upload your clinic&apos;s UPI QR for patient payments. It appears on the reception dashboard.
          </p>
          <label
            htmlFor="paymentQrFile"
            className={`flex items-center gap-3 cursor-pointer rounded-lg border-2 border-dashed p-4 transition-colors ${
              formData.paymentQrFile
                ? "border-emerald-400 bg-emerald-50"
                : "border-emerald-300 hover:border-emerald-400 bg-white"
            }`}
          >
            <Upload className={`w-5 h-5 ${formData.paymentQrFile ? "text-emerald-600" : "text-emerald-500"}`} />
            <div className="flex-1 min-w-0">
              {formData.paymentQrFile ? (
                <p className="text-sm font-medium text-emerald-800 truncate">{formData.paymentQrFile.name}</p>
              ) : (
                <p className="text-sm text-gray-500">Click to upload payment QR (JPG/PNG)</p>
              )}
            </div>
            <Input
              id="paymentQrFile"
              type="file"
              accept=".jpg,.jpeg,.png"
              onChange={(e) => {
                const file = e.target.files?.[0] ?? null;
                setFormData((prev) => ({ ...prev, paymentQrFile: file }));
              }}
              disabled={isLoading}
              className="sr-only"
            />
          </label>
          <p className="text-xs text-gray-500">Optional — can be added later from clinic detail.</p>
        </div>

        <Button
          type="submit"
          disabled={isLoading}
          className="w-full bg-blue-600 hover:bg-blue-700"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Creating...
            </>
          ) : (
            "Continue to Next Step"
          )}
        </Button>
      </form>
    </div>
  );
}
