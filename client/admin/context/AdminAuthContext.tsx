import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { apiUrl, apiErrorMessage } from "@/lib/api-base";

export type AdminRole =
  | "super-admin"
  | "clinic-admin"
  | "doctor"
  | "receptionist"
  | "independent";

export interface AdminUser {
  id: string;
  user_id: string; // e.g., MUM001-DOC-10234
  name: string;
  email: string | null;
  phone: string | null;
  role: AdminRole;
  clinic_id: string | null;
  /** Set at login from clinics.clinic_code */
  clinic_code?: string | null;
  loginTime: Date;
}

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

interface AdminAuthContextType {
  user: AdminUser | null;
  tokens: AuthTokens | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  // Auth methods — login resolves to the authenticated user for immediate post-login routing
  login: (user_id: string, password: string, deviceId?: string) => Promise<AdminUser>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<boolean>;
  changePassword: (oldPassword: string, newPassword: string) => Promise<void>;
  clearError: () => void;
}

const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined);

const STORAGE_KEYS = {
  ACCESS_TOKEN: "admin_access_token",
  REFRESH_TOKEN: "admin_refresh_token",
  USER: "admin_user",
  EXPIRY: "admin_token_expiry",
};

export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [tokens, setTokens] = useState<AuthTokens | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize auth from session storage on mount
  useEffect(() => {
    const initializeAuth = async () => {
      const savedAccessToken = sessionStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
      const savedRefreshToken = sessionStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
      const savedUser = sessionStorage.getItem(STORAGE_KEYS.USER);
      const savedExpiry = sessionStorage.getItem(STORAGE_KEYS.EXPIRY);

      if (savedAccessToken && savedUser && savedExpiry) {
        try {
          // Check if token is still valid
          const expiryTime = parseInt(savedExpiry, 10);
          const isTokenExpired = Date.now() > expiryTime;

          if (isTokenExpired && savedRefreshToken) {
            // Token expired, try to refresh
            const refreshSuccess = await refreshTokenHandler(savedRefreshToken);
            if (!refreshSuccess) {
              clearAuth();
              return;
            }
            setUser(JSON.parse(savedUser));
          } else if (!isTokenExpired) {
            // Token still valid, restore from storage
            setTokens({
              accessToken: savedAccessToken,
              refreshToken: savedRefreshToken || "",
              expiresIn: expiryTime - Date.now(),
            });
            setUser(JSON.parse(savedUser));
          }
        } catch (err) {
          console.error("Auth initialization error:", err);
          clearAuth();
        }
      }
    };

    initializeAuth();
  }, []);

  // Keep React token state in sync when apiFetch refreshes the access token
  useEffect(() => {
    const onRefreshed = () => {
      const access = sessionStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
      const exp = sessionStorage.getItem(STORAGE_KEYS.EXPIRY);
      const refresh = sessionStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
      if (!access || !exp) return;
      setTokens((prev) => ({
        accessToken: access,
        refreshToken: prev?.refreshToken || refresh || "",
        expiresIn: Math.max(0, parseInt(exp, 10) - Date.now()),
      }));
    };
    window.addEventListener("admin-access-token-refreshed", onRefreshed);
    return () => window.removeEventListener("admin-access-token-refreshed", onRefreshed);
  }, []);

  const clearAuth = useCallback(() => {
    setUser(null);
    setTokens(null);
    sessionStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
    sessionStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
    sessionStorage.removeItem(STORAGE_KEYS.USER);
    sessionStorage.removeItem(STORAGE_KEYS.EXPIRY);
  }, []);

  const login = async (user_id: string, password: string, deviceId?: string): Promise<AdminUser> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(apiUrl("/api/auth/login"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id,
          password,
          deviceId: deviceId || getDeviceId(),
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(apiErrorMessage(data) || "Login failed");
      }

      const { accessToken, refreshToken, expiresIn, user: backendUser } = data.data;

      // Transform backend user response
      const authUser: AdminUser = {
        id: backendUser.id,
        user_id: backendUser.user_id,
        name: backendUser.name,
        email: backendUser.email,
        phone: backendUser.phone,
        role: backendUser.role,
        clinic_id: backendUser.clinic_id,
        clinic_code: backendUser.clinic_code ?? null,
        loginTime: new Date(),
      };

      // Calculate expiry time (current time + expiresIn seconds)
      const expiryTime = Date.now() + expiresIn * 1000;

      // Store auth data
      const authTokens = {
        accessToken,
        refreshToken,
        expiresIn,
      };

      sessionStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, accessToken);
      sessionStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, refreshToken);
      sessionStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(authUser));
      sessionStorage.setItem(STORAGE_KEYS.EXPIRY, expiryTime.toString());

      setTokens(authTokens);
      setUser(authUser);
      return authUser;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Login failed";
      setError(errorMsg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const refreshTokenHandler = async (refreshToken: string): Promise<boolean> => {
    try {
      const response = await fetch(apiUrl("/api/auth/refresh"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error("Token refresh failed");
      }

      const newAccessToken = data.accessToken;

      const expiryTime = Date.now() + 15 * 60 * 1000; // 15 minutes
      sessionStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, newAccessToken);
      sessionStorage.setItem(STORAGE_KEYS.EXPIRY, expiryTime.toString());

      const rt =
        sessionStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN) || refreshToken;
      setTokens({
        accessToken: newAccessToken,
        refreshToken: rt,
        expiresIn: 15 * 60,
      });

      return true;
    } catch (err) {
      console.error("Token refresh error:", err);
      clearAuth();
      return false;
    }
  };

  const refreshToken = async (): Promise<boolean> => {
    const savedRefreshToken = sessionStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
    if (!savedRefreshToken) {
      clearAuth();
      return false;
    }

    return refreshTokenHandler(savedRefreshToken);
  };

  const logout = async (): Promise<void> => {
    setIsLoading(true);

    try {
      if (tokens?.accessToken) {
        await fetch(apiUrl("/api/auth/logout"), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${tokens.accessToken}`,
          },
        });
      }
    } catch (err) {
      console.error("Logout error:", err);
    } finally {
      clearAuth();
      setIsLoading(false);
    }
  };

  const changePassword = async (oldPassword: string, newPassword: string): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      if (!tokens?.accessToken) {
        throw new Error("Not authenticated");
      }

      const response = await fetch(apiUrl("/api/auth/change-password"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokens.accessToken}`,
        },
        body: JSON.stringify({ oldPassword, newPassword }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(apiErrorMessage(data) || "Failed to change password");
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to change password";
      setError(errorMsg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const clearError = () => {
    setError(null);
  };

  const isAuthenticated = !!tokens?.accessToken && !!user;

  return (
    <AdminAuthContext.Provider
      value={{
        user,
        tokens,
        isAuthenticated,
        isLoading,
        error,
        login,
        logout,
        refreshToken,
        changePassword,
        clearError,
      }}
    >
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  const context = useContext(AdminAuthContext);
  if (!context) {
    throw new Error("useAdminAuth must be used within AdminAuthProvider");
  }
  return context;
}

/**
 * Get or generate device ID for this browser
 */
function getDeviceId(): string {
  const DEVICE_ID_KEY = "admin_device_id";
  let deviceId = localStorage.getItem(DEVICE_ID_KEY);

  if (!deviceId) {
    // Generate a new device ID
    deviceId = `admin-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem(DEVICE_ID_KEY, deviceId);
  }

  return deviceId;
}

