import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import {
  ChevronLeft,
  Upload,
  AlertCircle,
  CheckCircle2,
  Loader,
  User,
  FileText,
  Calendar,
  MapPin,
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function DoctorKYC() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    // Step 1: Professional Details
    licenseNumber: "",
    licenseValidTill: "",
    registrationNumber: "",
    specialization: "",
    address: "",

    // Step 2: KYC Documents
    aadhaar: "",
    pan: "",
    photoFile: null as File | null,
    signatureFile: null as File | null,
  });

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError(null);
  };

  const handleFileChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    field: "photoFile" | "signatureFile"
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError("File size must be less than 5MB");
        return;
      }
      setFormData((prev) => ({ ...prev, [field]: file }));
      setError(null);
    }
  };

  const validateStep1 = () => {
    if (!formData.licenseNumber.trim()) {
      setError("License number is required");
      return false;
    }
    if (!formData.licenseValidTill) {
      setError("License validity date is required");
      return false;
    }
    if (!formData.registrationNumber.trim()) {
      setError("Registration number is required");
      return false;
    }
    if (!formData.address.trim()) {
      setError("Address is required");
      return false;
    }
    return true;
  };

  const validateStep2 = () => {
    if (!formData.aadhaar.trim()) {
      setError("Aadhaar number is required");
      return false;
    }
    if (!formData.pan.trim()) {
      setError("PAN number is required");
      return false;
    }
    if (!formData.photoFile) {
      setError("Profile photo is required");
      return false;
    }
    if (!formData.signatureFile) {
      setError("Signature is required");
      return false;
    }
    return true;
  };

  const handleNextStep = () => {
    if (step === 1 && !validateStep1()) return;
    setStep(step + 1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateStep2()) return;

    setLoading(true);
    setError(null);

    try {
      // TODO: Replace with real API call
      // POST /api/doctors/kyc/submit with FormData
      await new Promise((resolve) => setTimeout(resolve, 2000));

      console.log("Doctor KYC data:", formData);

      // Navigate to dashboard
      navigate("/solo-dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "KYC submission failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <button
            onClick={() => (step > 1 ? setStep(step - 1) : navigate("/otp-login"))}
            className="flex items-center gap-2 text-blue-600 hover:text-blue-700 font-semibold transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
            Back
          </button>
          <div className="text-sm font-semibold text-gray-600">
            Step {step} of 2
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex items-center justify-center min-h-[calc(100vh-80px)] p-4">
        <div className="w-full max-w-2xl">
          {/* Progress */}
          <div className="mb-8">
            <div className="flex gap-2 mb-4">
              {[1, 2].map((s) => (
                <div
                  key={s}
                  className={cn(
                    "h-2 flex-1 rounded-full transition-all",
                    s <= step ? "bg-blue-600" : "bg-gray-300"
                  )}
                />
              ))}
            </div>
          </div>

          <form onSubmit={step === 2 ? handleSubmit : undefined} className="space-y-6">
            {/* Step 1: Professional Details */}
            {step === 1 && (
              <div className="space-y-6 animate-in fade-in duration-300">
                <div>
                  <h2 className="text-3xl font-bold text-gray-900 mb-2">
                    Professional Details
                  </h2>
                  <p className="text-gray-600">
                    Tell us about your medical qualifications
                  </p>
                </div>

                {/* License Number */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Medical License Number *
                  </label>
                  <input
                    type="text"
                    name="licenseNumber"
                    value={formData.licenseNumber}
                    onChange={handleInputChange}
                    placeholder="e.g., MCI-123456"
                    className={cn(
                      "w-full px-4 py-3 border-2 rounded-lg font-medium focus:outline-none transition-all",
                      error
                        ? "border-red-400 bg-red-50 focus:ring-2 focus:ring-red-200"
                        : "border-gray-300 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                    )}
                  />
                </div>

                {/* License Validity */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    License Valid Till *
                  </label>
                  <input
                    type="date"
                    name="licenseValidTill"
                    value={formData.licenseValidTill}
                    onChange={handleInputChange}
                    className={cn(
                      "w-full px-4 py-3 border-2 rounded-lg font-medium focus:outline-none transition-all",
                      error
                        ? "border-red-400 bg-red-50 focus:ring-2 focus:ring-red-200"
                        : "border-gray-300 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                    )}
                  />
                </div>

                {/* Registration Number */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Registration Number *
                  </label>
                  <input
                    type="text"
                    name="registrationNumber"
                    value={formData.registrationNumber}
                    onChange={handleInputChange}
                    placeholder="e.g., REG-2024-001"
                    className={cn(
                      "w-full px-4 py-3 border-2 rounded-lg font-medium focus:outline-none transition-all",
                      error
                        ? "border-red-400 bg-red-50 focus:ring-2 focus:ring-red-200"
                        : "border-gray-300 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                    )}
                  />
                </div>

                {/* Specialization */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Specialization (Optional)
                  </label>
                  <input
                    type="text"
                    name="specialization"
                    value={formData.specialization}
                    onChange={handleInputChange}
                    placeholder="e.g., General Medicine, Cardiology"
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg font-medium focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                  />
                </div>

                {/* Address */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Address *
                  </label>
                  <textarea
                    name="address"
                    value={formData.address}
                    onChange={handleInputChange}
                    placeholder="Full address"
                    rows={3}
                    className={cn(
                      "w-full px-4 py-3 border-2 rounded-lg font-medium focus:outline-none transition-all resize-none",
                      error
                        ? "border-red-400 bg-red-50 focus:ring-2 focus:ring-red-200"
                        : "border-gray-300 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                    )}
                  />
                </div>

                {/* Error */}
                {error && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm font-semibold flex gap-2">
                    <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                    {error}
                  </div>
                )}

                {/* Next Button */}
                <button
                  type="button"
                  onClick={handleNextStep}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors"
                >
                  Next Step
                </button>
              </div>
            )}

            {/* Step 2: KYC Documents */}
            {step === 2 && (
              <div className="space-y-6 animate-in fade-in duration-300">
                <div>
                  <h2 className="text-3xl font-bold text-gray-900 mb-2">
                    KYC Documents
                  </h2>
                  <p className="text-gray-600">
                    Upload your verification documents
                  </p>
                </div>

                {/* Aadhaar Number */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Aadhaar Number *
                  </label>
                  <input
                    type="text"
                    name="aadhaar"
                    value={formData.aadhaar}
                    onChange={handleInputChange}
                    placeholder="12-digit Aadhaar number"
                    maxLength={12}
                    className={cn(
                      "w-full px-4 py-3 border-2 rounded-lg font-medium focus:outline-none transition-all",
                      error
                        ? "border-red-400 bg-red-50 focus:ring-2 focus:ring-red-200"
                        : "border-gray-300 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                    )}
                  />
                </div>

                {/* PAN Number */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    PAN Number *
                  </label>
                  <input
                    type="text"
                    name="pan"
                    value={formData.pan}
                    onChange={handleInputChange}
                    placeholder="10-character PAN"
                    maxLength={10}
                    className={cn(
                      "w-full px-4 py-3 border-2 rounded-lg font-medium focus:outline-none transition-all uppercase",
                      error
                        ? "border-red-400 bg-red-50 focus:ring-2 focus:ring-red-200"
                        : "border-gray-300 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                    )}
                  />
                </div>

                {/* Photo Upload */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Profile Photo *
                  </label>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 transition-colors">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFileChange(e, "photoFile")}
                      className="hidden"
                      id="photo-input"
                    />
                    <label htmlFor="photo-input" className="cursor-pointer">
                      <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                      <p className="font-semibold text-gray-700">
                        {formData.photoFile?.name || "Click to upload photo"}
                      </p>
                      <p className="text-xs text-gray-500">JPG, PNG (Max 5MB)</p>
                    </label>
                  </div>
                </div>

                {/* Signature Upload */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Signature *
                  </label>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 transition-colors">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFileChange(e, "signatureFile")}
                      className="hidden"
                      id="signature-input"
                    />
                    <label htmlFor="signature-input" className="cursor-pointer">
                      <FileText className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                      <p className="font-semibold text-gray-700">
                        {formData.signatureFile?.name || "Click to upload signature"}
                      </p>
                      <p className="text-xs text-gray-500">JPG, PNG (Max 5MB)</p>
                    </label>
                  </div>
                </div>

                {/* Error */}
                {error && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm font-semibold flex gap-2">
                    <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                    {error}
                  </div>
                )}

                {/* Info */}
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-blue-800 text-sm">
                  <p className="font-semibold mb-2">Document Verification</p>
                  <ul className="list-disc list-inside space-y-1 text-xs">
                    <li>Your documents will be verified within 24 hours</li>
                    <li>Admin will review and approve your KYC</li>
                    <li>You'll receive notification once approved</li>
                  </ul>
                </div>

                {/* Buttons */}
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-semibold transition-colors"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className={cn(
                      "py-3 rounded-lg font-semibold transition-all flex items-center justify-center gap-2",
                      loading
                        ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                        : "bg-blue-600 hover:bg-blue-700 text-white cursor-pointer"
                    )}
                  >
                    {loading ? (
                      <>
                        <Loader className="w-5 h-5 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-5 h-5" />
                        Submit KYC
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
