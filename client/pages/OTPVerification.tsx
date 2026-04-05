import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Loader, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";

export default function OTPVerification() {
  const navigate = useNavigate();
  const { verifyOTP, sendOTP, error: authError, isLoading: authLoading, user } = useAuth();
  const [otp, setOtp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [timer, setTimer] = useState(300); // 5 minutes
  const [verified, setVerified] = useState(false);

  const contact = sessionStorage.getItem("otpContact") || "";
  const contactType = sessionStorage.getItem("otpContactType") || "phone";

  // Timer countdown
  useEffect(() => {
    if (timer === 0) return;

    const interval = setInterval(() => {
      setTimer((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [timer]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleOTPChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, "").slice(0, 6);
    setOtp(value);
    setError(null);
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (otp.length !== 6) {
      setError("OTP must be 6 digits");
      return;
    }

    if (timer === 0) {
      setError("OTP expired. Please request a new one.");
      return;
    }

    try {
      const sessionId = sessionStorage.getItem("otpSessionId");
      if (!sessionId) {
        setError("Session expired. Please request OTP again.");
        return;
      }

      // Call real backend API via AuthContext
      await verifyOTP(sessionId, otp);

      // Mark as verified to show success animation
      setVerified(true);

      // Redirect after animation
      setTimeout(() => {
        // TODO: Determine if clinic onboarding or doctor KYC based on role
        navigate("/clinic-onboarding");
      }, 2000);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Verification failed. Please try again.";
      setError(errorMsg);
      setOtp("");
    }
  };

  const handleResendOTP = async () => {
    setOtp("");
    setError(null);
    setTimer(300);

    try {
      // Call real backend API to resend OTP
      await sendOTP(contact, contactType as "phone" | "email");
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to resend OTP";
      setError(errorMsg);
    }
  };

  if (verified) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-green-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center space-y-6">
          <div className="flex justify-center">
            <div className="bg-green-100 rounded-full p-4 animate-bounce">
              <CheckCircle2 className="w-16 h-16 text-green-600" />
            </div>
          </div>
          <div>
            <h2 className="text-3xl font-bold text-gray-900 mb-2">
              Verified!
            </h2>
            <p className="text-gray-600">
              Your account is verified. Redirecting...
            </p>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-1 overflow-hidden">
            <div className="bg-green-600 h-full animate-pulse" style={{ width: "100%" }} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Back Button */}
        <button
          onClick={() => navigate("/otp-login")}
          className="flex items-center gap-2 text-blue-600 hover:text-blue-700 font-semibold mb-8 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Login
        </button>

        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Enter OTP
          </h1>
          <p className="text-gray-600">
            We've sent a verification code to
            <br />
            <span className="font-semibold text-gray-900">
              {contactType === "phone" ? `+91 ${contact}` : contact}
            </span>
          </p>
        </div>

        {/* OTP Form */}
        <form onSubmit={handleVerifyOTP} className="space-y-6">
          {/* OTP Input */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              6-Digit OTP
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={otp}
              onChange={handleOTPChange}
              placeholder="000000"
              maxLength={6}
              className={cn(
                "w-full px-4 py-4 text-center text-4xl font-bold tracking-widest border-2 rounded-lg focus:outline-none transition-all",
                error
                  ? "border-red-400 bg-red-50 focus:border-red-500 focus:ring-2 focus:ring-red-200"
                  : "border-gray-300 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              )}
              autoFocus
            />
            {(error || authError) && (
              <p className="mt-2 text-sm text-red-600 font-semibold">
                ⚠️ {error || authError}
              </p>
            )}
          </div>

          {/* Timer & Resend */}
          <div className="text-center space-y-3">
            <div className="text-sm">
              {timer > 0 ? (
                <p className="text-gray-600">
                  OTP expires in:{" "}
                  <span className="font-bold text-orange-600">
                    {formatTime(timer)}
                  </span>
                </p>
              ) : (
                <p className="text-red-600 font-semibold">OTP Expired</p>
              )}
            </div>

            {timer < 60 && timer > 0 && (
              <p className="text-xs text-orange-600">
                Your OTP will expire soon!
              </p>
            )}

            {timer === 0 && (
              <button
                type="button"
                onClick={handleResendOTP}
                className="text-blue-600 hover:text-blue-700 font-semibold text-sm underline"
              >
                Resend OTP
              </button>
            )}
          </div>

          {/* Verify Button */}
          <button
            type="submit"
            disabled={authLoading || otp.length !== 6 || timer === 0}
            className={cn(
              "w-full py-3 rounded-lg font-semibold transition-all flex items-center justify-center gap-2",
              authLoading || otp.length !== 6 || timer === 0
                ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                : "bg-blue-600 hover:bg-blue-700 text-white cursor-pointer shadow-lg"
            )}
          >
            {authLoading ? (
              <>
                <Loader className="w-5 h-5 animate-spin" />
                Verifying...
              </>
            ) : (
              "Verify OTP"
            )}
          </button>
        </form>

        {/* Info */}
        <div className="mt-8 p-4 bg-blue-50 rounded-xl border border-blue-200 text-sm text-blue-800 space-y-2">
          <p>
            <span className="font-semibold">Didn't receive the code?</span>
          </p>
          <ul className="list-disc list-inside space-y-1 text-xs">
            <li>Check your spam folder</li>
            <li>Wait for the message to arrive</li>
            <li>Request a new code after 60 seconds</li>
          </ul>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-gray-500 mt-6">
          For security, this code is valid for 5 minutes only
        </p>
      </div>
    </div>
  );
}
