import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Phone, Mail, ArrowRight, Loader } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";

type ContactType = "phone" | "email";

export default function OTPLogin() {
  const navigate = useNavigate();
  const { sendOTP, error: authError, isLoading: authLoading } = useAuth();
  const [contactType, setContactType] = useState<ContactType>("phone");
  const [contact, setContact] = useState("");
  const [error, setError] = useState<string | null>(null);

  const isValidPhoneNumber = (phone: string): boolean => {
    const phoneRegex = /^[6-9]\d{9}$/;
    return phoneRegex.test(phone.replace(/\D/g, ""));
  };

  const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const isValidContact = (): boolean => {
    if (contactType === "phone") {
      return isValidPhoneNumber(contact);
    } else {
      return isValidEmail(contact);
    }
  };

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!contact.trim()) {
      setError(
        contactType === "phone" ? "Enter phone number" : "Enter email address"
      );
      return;
    }

    if (!isValidContact()) {
      setError(
        contactType === "phone"
          ? "Invalid phone number (10 digits starting with 6-9)"
          : "Invalid email address"
      );
      return;
    }

    try {
      // Call real backend API via AuthContext
      await sendOTP(contact, contactType);

      // Navigate to OTP verification
      navigate("/otp-verify");
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to send OTP. Please try again.";
      setError(errorMsg);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex justify-center mb-4">
            <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl p-4">
              <Phone className="w-8 h-8 text-white" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            SmartClinic
          </h1>
          <p className="text-gray-600">
            Secure login with OTP verification
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSendOTP} className="space-y-6">
          {/* Contact Type Toggle */}
          <div className="flex gap-3 bg-gray-100 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => {
                setContactType("phone");
                setContact("");
                setError(null);
              }}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-semibold transition-all",
                contactType === "phone"
                  ? "bg-white text-blue-600 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              )}
            >
              <Phone className="w-5 h-5" />
              Phone
            </button>
            <button
              type="button"
              onClick={() => {
                setContactType("email");
                setContact("");
                setError(null);
              }}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-semibold transition-all",
                contactType === "email"
                  ? "bg-white text-blue-600 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              )}
            >
              <Mail className="w-5 h-5" />
              Email
            </button>
          </div>

          {/* Input Field */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              {contactType === "phone" ? "Phone Number" : "Email Address"}
            </label>
            <div className="relative">
              <input
                type={contactType === "phone" ? "tel" : "email"}
                value={contact}
                onChange={(e) => {
                  setContact(e.target.value);
                  setError(null);
                }}
                placeholder={
                  contactType === "phone"
                    ? "Enter 10-digit phone number"
                    : "name@example.com"
                }
                className={cn(
                  "w-full px-4 py-3 border-2 rounded-lg font-medium focus:outline-none transition-all",
                  error
                    ? "border-red-400 bg-red-50 focus:border-red-500 focus:ring-2 focus:ring-red-200"
                    : "border-gray-300 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                )}
              />
            </div>
            {(error || authError) && (
              <p className="mt-2 text-sm text-red-600 font-semibold">
                ⚠️ {error || authError}
              </p>
            )}
          </div>

          {/* Format Hint */}
          <p className="text-xs text-gray-500 text-center">
            {contactType === "phone"
              ? "Enter 10-digit number (e.g., 9876543210)"
              : "Enter valid email address"}
          </p>

          {/* Send OTP Button */}
          <button
            type="submit"
            disabled={authLoading || !contact.trim()}
            className={cn(
              "w-full py-3 rounded-lg font-semibold transition-all flex items-center justify-center gap-2",
              authLoading || !contact.trim()
                ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                : "bg-blue-600 hover:bg-blue-700 text-white cursor-pointer shadow-lg"
            )}
          >
            {authLoading ? (
              <>
                <Loader className="w-5 h-5 animate-spin" />
                Sending OTP...
              </>
            ) : (
              <>
                <span>Send OTP</span>
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        </form>

        {/* Info */}
        <div className="mt-8 p-4 bg-blue-50 rounded-xl border border-blue-200">
          <p className="text-sm text-blue-800">
            <span className="font-semibold">First time?</span> We'll create your
            account after verification. No password needed.
          </p>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-gray-500 mt-6">
          By logging in, you agree to our Terms of Service and Privacy Policy
        </p>
      </div>
    </div>
  );
}
