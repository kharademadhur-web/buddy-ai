import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, Loader2, Upload } from "lucide-react";

interface AddDoctorProps {
  onNext: (data: any) => void;
  onBack: () => void;
  isLoading?: boolean;
  error?: string;
}

export function AddDoctor({
  onNext,
  onBack,
  isLoading = false,
  error,
}: AddDoctorProps) {
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    licenseNumber: "",
    address: "",
    panDocumentUrl: null as File | null,
    aadhaarDocumentUrl: null as File | null,
    signatureUrl: null as File | null,
  });

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const validateForm = () => {
    const errors: Record<string, string> = {};

    if (!formData.name.trim()) {
      errors.name = "Doctor name is required";
    }
    if (!formData.phone.trim()) {
      errors.phone = "Phone number is required";
    }
    if (!formData.email.trim()) {
      errors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = "Invalid email format";
    }
    if (!formData.licenseNumber.trim()) {
      errors.licenseNumber = "License number is required";
    }
    if (!formData.address.trim()) {
      errors.address = "Address is required";
    }
    if (!formData.panDocumentUrl) {
      errors.panDocumentUrl = "PAN card is required";
    }
    if (!formData.aadhaarDocumentUrl) {
      errors.aadhaarDocumentUrl = "Aadhaar card is required";
    }
    if (!formData.signatureUrl) {
      errors.signatureUrl = "Signature is required";
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
        <h2 className="text-2xl font-bold text-gray-900">Add Doctor</h2>
        <p className="text-gray-600 mt-2">
          Enter doctor information and upload required documents
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
              Doctor Name *
            </Label>
            <Input
              id="name"
              name="name"
              placeholder="Enter doctor name"
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
              placeholder="doctor@example.com"
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
            <Label htmlFor="licenseNumber" className="text-sm font-medium">
              License Number *
            </Label>
            <Input
              id="licenseNumber"
              name="licenseNumber"
              placeholder="Enter license number"
              value={formData.licenseNumber}
              onChange={handleChange}
              disabled={isLoading}
              className={formErrors.licenseNumber ? "border-red-500" : ""}
            />
            {formErrors.licenseNumber && (
              <p className="text-sm text-red-600 mt-1">
                {formErrors.licenseNumber}
              </p>
            )}
          </div>
        </div>

        <div>
          <Label htmlFor="address" className="text-sm font-medium">
            Address *
          </Label>
          <Input
            id="address"
            name="address"
            placeholder="Enter address"
            value={formData.address}
            onChange={handleChange}
            disabled={isLoading}
            className={formErrors.address ? "border-red-500" : ""}
          />
          {formErrors.address && (
            <p className="text-sm text-red-600 mt-1">{formErrors.address}</p>
          )}
        </div>

        {/* Document Uploads */}
        <div className="space-y-3 p-4 bg-blue-50 rounded-lg">
          <p className="text-sm font-medium text-gray-700">KYC Documents (Mandatory)</p>

          <div>
            <Label htmlFor="panDocument" className="text-sm">
              PAN Card *
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
            {formErrors.panDocumentUrl && (
              <p className="text-sm text-red-600 mt-1">{formErrors.panDocumentUrl}</p>
            )}
          </div>

          <div>
            <Label htmlFor="aadhaarDocument" className="text-sm">
              Aadhaar Card *
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
            {formErrors.aadhaarDocumentUrl && (
              <p className="text-sm text-red-600 mt-1">{formErrors.aadhaarDocumentUrl}</p>
            )}
          </div>

          <div>
            <Label htmlFor="signature" className="text-sm">
              Signature *
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
            {formErrors.signatureUrl && (
              <p className="text-sm text-red-600 mt-1">{formErrors.signatureUrl}</p>
            )}
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
          <Button
            type="submit"
            disabled={isLoading}
            className="flex-1 bg-blue-600 hover:bg-blue-700"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Adding...
              </>
            ) : (
              "Continue to Next Step"
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
