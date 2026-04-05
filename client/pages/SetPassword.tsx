import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { setPasswordSchema, type SetPasswordInput, validatePasswordStrength } from "../lib/validation";
import { BiometricRegister } from "../components/BiometricRegister";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { useToast } from "../hooks/use-toast";
import { getOrCreateDeviceId } from "../lib/device-fingerprint";

/**
 * SetPassword page
 * User sets permanent password after OTP verification
 * Allows optional biometric registration
 */
export function SetPassword() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showBiometric, setShowBiometric] = useState(false);

  // Get userId and OTP from location state (passed from OTP verification)
  const userId = (location.state as any)?.userId;
  const otp = (location.state as any)?.otp;

  if (!userId || !otp) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-2">Invalid Access</h1>
          <p className="text-gray-600 mb-4">Please verify your OTP first</p>
          <Button onClick={() => navigate("/login")}>Back to Login</Button>
        </div>
      </div>
    );
  }

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<SetPasswordInput>({
    resolver: zodResolver(setPasswordSchema),
  });

  const newPassword = watch("newPassword");
  const passwordStrength = newPassword
    ? validatePasswordStrength(newPassword)
    : null;

  const onSubmit = async (data: SetPasswordInput) => {
    setIsLoading(true);
    try {
      const deviceId = getOrCreateDeviceId();
      const response = await fetch("/api/auth/first-login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId,
          otp,
          newPassword: data.newPassword,
          deviceId,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        
        // Store tokens
        localStorage.setItem("accessToken", result.accessToken);
        if (result.refreshToken) {
          localStorage.setItem("refreshToken", result.refreshToken);
          localStorage.setItem("deviceId", deviceId);
        }

        toast({
          title: "Success",
          description: "Password set successfully",
        });

        // Show biometric registration if available
        if (result.user.biometricEnabled === false) {
          setShowBiometric(true);
        } else {
          navigate("/dashboard");
        }
      } else {
        const error = await response.json();
        toast({
          title: "Error",
          description: error.error || "Failed to set password",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An error occurred while setting password",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleBiometricSuccess = () => {
    navigate("/dashboard");
  };

  const handleSkipBiometric = () => {
    navigate("/dashboard");
  };

  if (showBiometric) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-lg shadow-md p-8">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Welcome!
            </h1>
            <p className="text-gray-600 mb-6">
              Your account is ready. You can optionally set up biometric
              authentication for faster login.
            </p>

            <BiometricRegister
              userId={userId}
              deviceId={getOrCreateDeviceId()}
              onSuccess={handleBiometricSuccess}
              onCancel={handleSkipBiometric}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-lg shadow-md p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Create Your Password
          </h1>
          <p className="text-gray-600 mb-6">
            Set a strong password for your account
          </p>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* New Password */}
            <div>
              <label className="text-sm font-medium text-gray-700">
                New Password
              </label>
              <div className="relative mt-1">
                <Input
                  {...register("newPassword")}
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter new password"
                  disabled={isLoading}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  disabled={isLoading}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
              {errors.newPassword && (
                <p className="mt-1 text-sm text-red-600">
                  {errors.newPassword.message}
                </p>
              )}

              {/* Password Strength Indicator */}
              {passwordStrength && (
                <div className="mt-3 p-3 bg-gray-50 rounded">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-medium text-gray-700">
                      Strength:
                    </span>
                    <div className="flex gap-1">
                      {[0, 1, 2].map((i) => (
                        <div
                          key={i}
                          className={`h-2 w-6 rounded ${
                            i < passwordStrength.score
                              ? passwordStrength.strength === "strong"
                                ? "bg-green-500"
                                : passwordStrength.strength === "medium"
                                ? "bg-yellow-500"
                                : "bg-red-500"
                              : "bg-gray-200"
                          }`}
                        />
                      ))}
                    </div>
                    <span
                      className={`text-sm font-medium ${
                        passwordStrength.strength === "strong"
                          ? "text-green-600"
                          : passwordStrength.strength === "medium"
                          ? "text-yellow-600"
                          : "text-red-600"
                      }`}
                    >
                      {passwordStrength.strength}
                    </span>
                  </div>
                  {passwordStrength.feedback.length > 0 && (
                    <ul className="text-xs text-gray-600 list-disc list-inside">
                      {passwordStrength.feedback.slice(0, 2).map((item, i) => (
                        <li key={i}>{item}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>

            {/* Confirm Password */}
            <div>
              <label className="text-sm font-medium text-gray-700">
                Confirm Password
              </label>
              <Input
                {...register("confirmPassword")}
                type="password"
                placeholder="Confirm password"
                disabled={isLoading}
                className="mt-1"
              />
              {errors.confirmPassword && (
                <p className="mt-1 text-sm text-red-600">
                  {errors.confirmPassword.message}
                </p>
              )}
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={isLoading}
              className="w-full mt-6 bg-blue-600 hover:bg-blue-700 text-white"
            >
              {isLoading ? "Setting up..." : "Set Password & Login"}
            </Button>
          </form>

          <p className="text-xs text-gray-500 text-center mt-4">
            Password must be at least 8 characters with letters and numbers
          </p>
        </div>
      </div>
    </div>
  );
}
