import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Building2, MapPin, Phone, Mail, Loader, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

export default function ClinicOnboarding() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    clinicName: "",
    location: "",
    address: "",
    phone: "",
    email: user?.contact || "",
    registrationNumber: "",
  });

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError(null);
  };

  const validateStep1 = () => {
    if (!formData.clinicName.trim()) {
      setError("Clinic name is required");
      return false;
    }
    if (!formData.location.trim()) {
      setError("Location is required");
      return false;
    }
    return true;
  };

  const validateStep2 = () => {
    if (!formData.address.trim()) {
      setError("Address is required");
      return false;
    }
    if (!formData.phone.trim()) {
      setError("Phone number is required");
      return false;
    }
    const phoneRegex = /^[6-9]\d{9}$/;
    if (!phoneRegex.test(formData.phone.replace(/\D/g, ""))) {
      setError("Invalid phone number");
      return false;
    }
    return true;
  };

  const handleNextStep = () => {
    if (step === 1 && !validateStep1()) return;
    if (step === 2 && !validateStep2()) return;
    setStep(step + 1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateStep2()) return;

    setLoading(true);
    setError(null);

    try {
      // TODO: Replace with real API call
      // POST /api/clinics/register
      await new Promise((resolve) => setTimeout(resolve, 2000));

      console.log("Clinic data:", formData);

      // Navigate to dashboard
      navigate("/solo-dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
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
          {/* Progress Indicator */}
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

          {/* Form */}
          <form onSubmit={step === 2 ? handleSubmit : undefined} className="space-y-6">
            {/* Step 1: Basic Info */}
            {step === 1 && (
              <div className="space-y-6 animate-in fade-in duration-300">
                <div>
                  <h2 className="text-3xl font-bold text-gray-900 mb-2">
                    Register Your Clinic
                  </h2>
                  <p className="text-gray-600">
                    Tell us about your clinic so patients can find you
                  </p>
                </div>

                {/* Clinic Name */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Clinic Name *
                  </label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-3.5 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      name="clinicName"
                      value={formData.clinicName}
                      onChange={handleInputChange}
                      placeholder="e.g., City Medical Clinic"
                      className={cn(
                        "w-full pl-10 pr-4 py-3 border-2 rounded-lg font-medium focus:outline-none transition-all",
                        error
                          ? "border-red-400 bg-red-50 focus:ring-2 focus:ring-red-200"
                          : "border-gray-300 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                      )}
                    />
                  </div>
                </div>

                {/* Location */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    City / Location *
                  </label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-3.5 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      name="location"
                      value={formData.location}
                      onChange={handleInputChange}
                      placeholder="e.g., Mumbai, Delhi"
                      className={cn(
                        "w-full pl-10 pr-4 py-3 border-2 rounded-lg font-medium focus:outline-none transition-all",
                        error
                          ? "border-red-400 bg-red-50 focus:ring-2 focus:ring-red-200"
                          : "border-gray-300 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                      )}
                    />
                  </div>
                </div>

                {/* Error */}
                {error && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm font-semibold">
                    ⚠️ {error}
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

            {/* Step 2: Contact & Details */}
            {step === 2 && (
              <div className="space-y-6 animate-in fade-in duration-300">
                <div>
                  <h2 className="text-3xl font-bold text-gray-900 mb-2">
                    Contact Information
                  </h2>
                  <p className="text-gray-600">
                    How can patients reach your clinic?
                  </p>
                </div>

                {/* Address */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Full Address *
                  </label>
                  <textarea
                    name="address"
                    value={formData.address}
                    onChange={handleInputChange}
                    placeholder="e.g., 123 Main Street, Mumbai 400001"
                    rows={3}
                    className={cn(
                      "w-full px-4 py-3 border-2 rounded-lg font-medium focus:outline-none transition-all resize-none",
                      error
                        ? "border-red-400 bg-red-50 focus:ring-2 focus:ring-red-200"
                        : "border-gray-300 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                    )}
                  />
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Phone Number *
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-3.5 w-5 h-5 text-gray-400" />
                    <input
                      type="tel"
                      name="phone"
                      value={formData.phone}
                      onChange={handleInputChange}
                      placeholder="10-digit phone number"
                      maxLength={10}
                      className={cn(
                        "w-full pl-10 pr-4 py-3 border-2 rounded-lg font-medium focus:outline-none transition-all",
                        error
                          ? "border-red-400 bg-red-50 focus:ring-2 focus:ring-red-200"
                          : "border-gray-300 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                      )}
                    />
                  </div>
                </div>

                {/* Email */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3.5 w-5 h-5 text-gray-400" />
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      disabled
                      className="w-full pl-10 pr-4 py-3 border-2 border-gray-300 rounded-lg font-medium bg-gray-50 text-gray-500 cursor-not-allowed"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Using your verified email
                  </p>
                </div>

                {/* Registration Number (Optional) */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Registration Number (Optional)
                  </label>
                  <input
                    type="text"
                    name="registrationNumber"
                    value={formData.registrationNumber}
                    onChange={handleInputChange}
                    placeholder="e.g., REG-12345"
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg font-medium focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                  />
                </div>

                {/* Error */}
                {error && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm font-semibold">
                    ⚠️ {error}
                  </div>
                )}

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
                        Creating...
                      </>
                    ) : (
                      "Create Clinic"
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
