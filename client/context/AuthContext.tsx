import React, { createContext, useContext, useState, useEffect } from "react";

export type UserRole = "super-admin" | "clinic" | "doctor";

export interface AuthUser {
  id: string;
  contact: string;
  contactType: "phone" | "email";
  role?: UserRole;
  clinicId?: string;
  doctorId?: string;
  name?: string;
  isVerified: boolean;
  loginTime: Date;
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  
  // Auth methods
  login: (contact: string, contactType: "phone" | "email", otp: string) => Promise<void>;
  logout: () => void;
  setUser: (user: AuthUser | null) => void;
  clearError: () => void;
  
  // OTP methods
  sendOTP: (contact: string, contactType: "phone" | "email") => Promise<string>; // returns sessionId
  verifyOTP: (sessionId: string, otp: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize auth from sessionStorage
  useEffect(() => {
    const savedToken = sessionStorage.getItem("accessToken");
    const savedUser = sessionStorage.getItem("authUser");

    if (savedToken && savedUser) {
      try {
        setToken(savedToken);
        setUser(JSON.parse(savedUser));
      } catch (err) {
        // Invalid stored data
        sessionStorage.removeItem("accessToken");
        sessionStorage.removeItem("refreshToken");
        sessionStorage.removeItem("authUser");
      }
    }
  }, []);

  const sendOTP = async (
    contact: string,
    contactType: "phone" | "email"
  ): Promise<string> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contact, contactType }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to send OTP");
      }

      const { sessionId } = data;
      sessionStorage.setItem("otpSessionId", sessionId);
      sessionStorage.setItem("otpContact", contact);
      sessionStorage.setItem("otpContactType", contactType);

      return sessionId;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to send OTP";
      setError(errorMsg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const verifyOTP = async (sessionId: string, otp: string): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, otp }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "OTP verification failed");
      }

      const { accessToken, refreshToken, user: backendUser } = data;

      // Transform backend user response to AuthUser
      const authUser: AuthUser = {
        id: backendUser._id || backendUser.id,
        contact: backendUser.contact,
        contactType: backendUser.contactType,
        role: backendUser.role,
        clinicId: backendUser.clinicId,
        doctorId: backendUser.doctorId,
        name: backendUser.name,
        isVerified: backendUser.isVerified,
        loginTime: new Date(),
      };

      // Store auth data
      sessionStorage.setItem("accessToken", accessToken);
      if (refreshToken) {
        sessionStorage.setItem("refreshToken", refreshToken);
      }
      sessionStorage.setItem("authUser", JSON.stringify(authUser));

      setToken(accessToken);
      setUser(authUser);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "OTP verification failed";
      setError(errorMsg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (
    contact: string,
    contactType: "phone" | "email",
    otp: string
  ): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      // Send OTP first if needed
      const sessionId = await sendOTP(contact, contactType);

      // Verify OTP
      await verifyOTP(sessionId, otp);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Login failed";
      setError(errorMsg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    setError(null);

    // Clear storage
    sessionStorage.removeItem("accessToken");
    sessionStorage.removeItem("refreshToken");
    sessionStorage.removeItem("authUser");
    sessionStorage.removeItem("otpSessionId");
    sessionStorage.removeItem("otpContact");
    sessionStorage.removeItem("otpContactType");
  };

  const clearError = () => {
    setError(null);
  };

  const isAuthenticated = !!token && !!user;

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated,
        isLoading,
        error,
        login,
        logout,
        setUser,
        clearError,
        sendOTP,
        verifyOTP,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
