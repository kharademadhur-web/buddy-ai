import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, Loader2, CheckCircle } from "lucide-react";

interface AddReceptionistProps {
  onNext: (data: any) => void;
  onBack: () => void;
  isLoading?: boolean;
  error?: string;
  primaryLabel?: string;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
}

export function AddReceptionist({
  onNext,
  onBack,
  isLoading = false,
  error,
  primaryLabel,
  secondaryActionLabel,
  onSecondaryAction,
}: AddReceptionistProps) {
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    panDocumentUrl: null as File | null,
    aadhaarDocumentUrl: null as File | null,
    signatureUrl: null as File | null,
  });

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const validateForm = () => {
    const errors: Record<string, string> = {};

    if (!formData.name.trim()) {
      errors.name = "Receptionist name is required";
    }
    if (!formData.phone.trim()) {
      errors.phone = "Phone number is required";
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
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    if (formErrors[name]) {
      setFormErrors((prev) => ({
        ...prev,
        [name]: "",
      }));
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, files } = e.target;
    if (files && files[0]) {
      setFormData((prev) => ({
        ...prev,
        [name]: files[0],
      }));
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
        <h2 className="text-2xl font-bold text-gray-900">Add Receptionist</h2>
        <p className="text-gray-600 mt-2">
          Final step - Enter receptionist information and upload documents
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="w-5 h-5 text-red-600" />
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="name" className="text-sm font-medium">
              Receptionist Name *
            </Label>
            <Input
              id="name"
              name="name"
              placeholder="Enter receptionist name"
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
              Email *
            </Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="receptionist@example.com"
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
        </div>

        {/* Document Uploads */}
        <div className="space-y-3 p-4 bg-blue-50 rounded-lg">
          <p className="text-sm font-medium text-gray-700">
            KYC Documents (Optional)
          </p>

          <div>
            <Label htmlFor="panDocument" className="text-sm">
              PAN Card
            </Label>
            <div className="flex items-center gap-2 mt-1">
              <Input
                id="panDocument"
                name="panDocumentUrl"
                type="file"
                onChange={handleFileChange}
                disabled={isLoading}
                className="cursor-pointer"
                accept=".pdf,.jpg,.jpeg,.png"
              />
              {formData.panDocumentUrl && (
                <span className="text-xs text-green-600">
                  {formData.panDocumentUrl.name}
                </span>
              )}
            </div>
          </div>

          <div>
            <Label htmlFor="aadhaarDocument" className="text-sm">
              Aadhaar Card
            </Label>
            <div className="flex items-center gap-2 mt-1">
              <Input
                id="aadhaarDocument"
                name="aadhaarDocumentUrl"
                type="file"
                onChange={handleFileChange}
                disabled={isLoading}
                className="cursor-pointer"
                accept=".pdf,.jpg,.jpeg,.png"
              />
              {formData.aadhaarDocumentUrl && (
                <span className="text-xs text-green-600">
                  {formData.aadhaarDocumentUrl.name}
                </span>
              )}
            </div>
          </div>

          <div>
            <Label htmlFor="signature" className="text-sm">
              Signature
            </Label>
            <div className="flex items-center gap-2 mt-1">
              <Input
                id="signature"
                name="signatureUrl"
                type="file"
                onChange={handleFileChange}
                disabled={isLoading}
                className="cursor-pointer"
                accept=".pdf,.jpg,.jpeg,.png"
              />
              {formData.signatureUrl && (
                <span className="text-xs text-green-600">
                  {formData.signatureUrl.name}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex gap-3 pt-4">
          <Button
            type="button"
            onClick={onBack}
            disabled={isLoading}
            variant="outline"
            className="flex-1"
          >
            Back
          </Button>
          <Button type="submit" disabled={isLoading} className="flex-1 bg-green-600 hover:bg-green-700">
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Completing...
              </>
            ) : (
              primaryLabel || "Complete Onboarding"
            )}
          </Button>
          {onSecondaryAction && secondaryActionLabel ? (
            <Button
              type="button"
              disabled={isLoading}
              variant="secondary"
              className="flex-1"
              onClick={onSecondaryAction}
            >
              {secondaryActionLabel}
            </Button>
          ) : null}
        </div>
      </form>
    </div>
  );
}
