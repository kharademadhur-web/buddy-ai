import { getAccessToken } from "../auth/storage";
import Constants from "expo-constants";

const DEFAULT_API_BASE_URL = "http://localhost:8080";

export function getApiBaseUrl() {
  // Production: set EXPO_PUBLIC_API_URL (see mobile/.env.example), e.g. https://api.estrellx.shop
  const env = process.env.EXPO_PUBLIC_API_URL;
  if (env?.trim()) return env.trim().replace(/\/+$/, "");

  const extraUrl = (Constants.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl;
  if (typeof extraUrl === "string" && extraUrl.trim()) return extraUrl.trim().replace(/\/+$/, "");

  // Dev: LAN IP from Expo when testing on a device (localhost = phone itself).

  // If running in Expo Go on a physical device, "localhost" points to the phone.
  // Derive the host IP from the Expo hostUri and assume the API is served from the same host on port 8080.
  const hostUri =
    (Constants.expoConfig as any)?.hostUri ||
    (Constants as any)?.expoConfig?.hostUri ||
    (Constants as any)?.manifest2?.extra?.expoClient?.hostUri ||
    (Constants as any)?.manifest?.hostUri;

  if (typeof hostUri === "string" && hostUri.length > 0) {
    const host = hostUri.split(":")[0]; // "192.168.1.9"
    if (host && host !== "localhost" && host !== "127.0.0.1") {
      return `http://${host}:8080`;
    }
  }

  return DEFAULT_API_BASE_URL;
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const base = getApiBaseUrl().replace(/\/+$/, "");
  const token = await getAccessToken();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init.headers as any),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${base}${path}`, {
    ...init,
    headers,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error || data?.message || "Request failed";
    throw new Error(msg);
  }
  return data as T;
}

