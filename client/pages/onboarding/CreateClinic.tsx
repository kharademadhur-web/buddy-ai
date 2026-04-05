import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, Loader2 } from "lucide-react";

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
  });

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

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
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    // Clear error for this field
    if (formErrors[name]) {
      setFormErrors((prev) => ({
        ...prev,
        [name]: "",
      }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (validateForm()) {
      onNext(formData);
    }
  };

  // Development helper: Try test endpoint
  const handleTestSubmit = () => {
    onNext(formData);
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
