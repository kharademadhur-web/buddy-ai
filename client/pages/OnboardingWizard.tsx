import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { OnboardingProgress } from "@/components/OnboardingProgress";
import { CreateClinic } from "./onboarding/CreateClinic";
import { AddDoctor } from "./onboarding/AddDoctor";
import { AddReceptionist } from "./onboarding/AddReceptionist";
import { AlertCircle, CheckCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const STEPS = ["Create Clinic", "Add Doctor", "Add Receptionist"];

interface OnboardingData {
  clinicId?: string;
  clinic?: any;
  doctor?: any;
  receptionist?: any;
}

export function OnboardingWizard() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [onboardingData, setOnboardingData] = useState<OnboardingData>({});
  const [isComplete, setIsComplete] = useState(false);
  const [generatedCredentials, setGeneratedCredentials] = useState<any>(null);

  // Development mode: Set dev token if not present
  React.useEffect(() => {
    const token = sessionStorage.getItem("accessToken");
    if (!token) {
      console.log("[DEV MODE] Setting dev-test-token for development");
      sessionStorage.setItem("accessToken", "dev-test-token");
    }
  }, []);

  const handleClinicCreated = async (clinicData: any) => {
    try {
      setIsLoading(true);
      setError("");

      const response = await fetch("/api/onboarding/clinic", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionStorage.getItem("accessToken")}`,
        },
        body: JSON.stringify(clinicData),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `API error: ${response.status} ${response.statusText}. ${errorText}`
        );
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message || "Failed to create clinic");
      }

      setOnboardingData((prev) => ({
        ...prev,
        clinicId: result.data.clinicId,
        clinic: result.data,
      }));

      setCurrentStep(2);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create clinic"
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleDoctorAdded = async (doctorData: any) => {
    try {
      setIsLoading(true);
      setError("");

      const formData = new FormData();
      formData.append("clinicId", onboardingData.clinicId!);
      formData.append("name", doctorData.name);
      formData.append("phone", doctorData.phone);
      formData.append("email", doctorData.email);
      formData.append("licenseNumber", doctorData.licenseNumber);
      formData.append("address", doctorData.address);

      // TODO: Handle file uploads to Supabase or cloud storage

      const response = await fetch("/api/onboarding/doctor", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${sessionStorage.getItem("accessToken")}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `API error: ${response.status} ${response.statusText}. ${errorText}`
        );
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message || "Failed to add doctor");
      }

      setOnboardingData((prev) => ({
        ...prev,
        doctor: result.data,
      }));

      setGeneratedCredentials({
        userIdUnique: result.data.userIdUnique,
        temporaryPassword: result.data.temporaryPassword,
        email: result.data.email,
      });

      setCurrentStep(3);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add doctor");
    } finally {
      setIsLoading(false);
    }
  };

  const handleReceptionistAdded = async (receptionistData: any) => {
    try {
      setIsLoading(true);
      setError("");

      const formData = new FormData();
      formData.append("clinicId", onboardingData.clinicId!);
      formData.append("name", receptionistData.name);
      formData.append("phone", receptionistData.phone);
      formData.append("email", receptionistData.email);

      // TODO: Handle file uploads to Supabase or cloud storage

      const response = await fetch("/api/onboarding/receptionist", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${sessionStorage.getItem("accessToken")}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `API error: ${response.status} ${response.statusText}. ${errorText}`
        );
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message || "Failed to add receptionist");
      }

      setOnboardingData((prev) => ({
        ...prev,
        receptionist: result.data,
      }));

      setIsComplete(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to add receptionist"
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
      setError("");
    }
  };

  const handleDone = () => {
    navigate("/admin-dashboard/clinics");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Clinic Onboarding
          </h1>
          <p className="text-gray-600 mt-2">
            Complete the onboarding process to setup your clinic
          </p>
        </div>

        {/* Main Card */}
        <div className="bg-white rounded-lg shadow-lg p-8">
          {!isComplete ? (
            <>
              {/* Progress Bar */}
              <div className="mb-8">
                <OnboardingProgress
                  currentStep={currentStep}
                  totalSteps={STEPS.length}
                  steps={STEPS}
                />
              </div>

              {/* Step Content */}
              <div className="min-h-[500px]">
                {currentStep === 1 && (
                  <CreateClinic
                    onNext={handleClinicCreated}
                    isLoading={isLoading}
                    error={error}
                  />
                )}
                {currentStep === 2 && (
                  <AddDoctor
                    onNext={handleDoctorAdded}
                    onBack={handleBack}
                    isLoading={isLoading}
                    error={error}
                  />
                )}
                {currentStep === 3 && (
                  <AddReceptionist
                    onNext={handleReceptionistAdded}
                    onBack={handleBack}
                    isLoading={isLoading}
                    error={error}
                  />
                )}
              </div>
            </>
          ) : (
            // Completion Screen
            <div className="space-y-6 text-center py-12">
              <div className="flex justify-center">
                <CheckCircle className="w-16 h-16 text-green-500" />
              </div>

              <div>
                <h2 className="text-2xl font-bold text-gray-900">
                  Onboarding Complete!
                </h2>
                <p className="text-gray-600 mt-2">
                  Your clinic and staff have been successfully registered
                </p>
              </div>

              {generatedCredentials && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-left">
                  <h3 className="font-semibold text-gray-900 mb-3">
                    Doctor Credentials
                  </h3>
                  <div className="space-y-2 text-sm">
                    <p>
                      <strong>User ID:</strong>{" "}
                      <code className="bg-gray-100 px-2 py-1 rounded">
                        {generatedCredentials.userIdUnique}
                      </code>
                    </p>
                    <p>
                      <strong>Temporary Password:</strong>{" "}
                      <code className="bg-gray-100 px-2 py-1 rounded">
                        {generatedCredentials.temporaryPassword}
                      </code>
                    </p>
                    <p className="text-yellow-700 text-xs mt-3">
                      ⚠️ Share these credentials with the doctor securely. They
                      will need to change their password on first login.
                    </p>
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <Button
                  onClick={handleDone}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                >
                  Go to Clinics Dashboard
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
