import { useState } from "react";
import { useBiometric } from "../hooks/useBiometric";
import { Button } from "./ui/button";
import { useToast } from "../hooks/use-toast";

interface BiometricRegisterProps {
  userId: string;
  deviceId: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

/**
 * BiometricRegister component
 * Allows users to register fingerprint or face recognition
 * Called after first successful password login
 */
export function BiometricRegister({
  userId,
  deviceId,
  onSuccess,
  onCancel,
}: BiometricRegisterProps) {
  const { registerBiometric, isLoading, error, isAvailable, isSupportedDevice } =
    useBiometric();
  const { toast } = useToast();
  const [isRegistering, setIsRegistering] = useState(false);

  // Check if device supports biometric
  const isSupported = isAvailable && isSupportedDevice();

  if (!isSupported) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <p className="text-sm text-yellow-800">
          Biometric authentication is not available on this device or browser.
        </p>
      </div>
    );
  }

  const handleRegisterBiometric = async () => {
    setIsRegistering(true);
    try {
      const result = await registerBiometric({
        userId,
        userName: userId,
        deviceId,
      });

      if (result.success) {
        // Send credential to backend
        try {
          const response = await fetch("/api/auth/register-biometric", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              credential: result.credential,
              deviceId,
              userId,
            }),
          });

          if (response.ok) {
            toast({
              title: "Success",
              description: "Biometric registered successfully",
            });
            onSuccess?.();
          } else {
            const error = await response.json();
            toast({
              title: "Error",
              description: error.error || "Failed to save biometric",
              variant: "destructive",
            });
          }
        } catch (err) {
          toast({
            title: "Error",
            description: "Failed to save biometric to server",
            variant: "destructive",
          });
        }
      } else {
        toast({
          title: "Error",
          description: result.error || "Biometric registration failed",
          variant: "destructive",
        });
      }
    } finally {
      setIsRegistering(false);
    }
  };

  return (
    <div className="border border-blue-200 rounded-lg p-6 bg-blue-50">
      <h3 className="text-lg font-semibold text-blue-900 mb-2">
        Secure Your Account with Biometric
      </h3>
      <p className="text-sm text-blue-700 mb-4">
        Register your fingerprint or face for faster, more secure login. You can
        still use your password anytime.
      </p>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex gap-3">
        <Button
          onClick={handleRegisterBiometric}
          disabled={isLoading || isRegistering}
          className="bg-blue-600 hover:bg-blue-700"
        >
          {isRegistering ? "Setting up..." : "Register Biometric"}
        </Button>
        <Button
          onClick={onCancel}
          variant="outline"
          disabled={isRegistering}
        >
          Skip for Now
        </Button>
      </div>

      <p className="text-xs text-gray-500 mt-4">
        You can set up biometric later in your profile settings.
      </p>
    </div>
  );
}
