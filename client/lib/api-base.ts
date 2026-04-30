import { getApiUrl } from "@/config/api";

export { API_BASE_URL } from "@/config/api";

export function apiUrl(path: string): string {
  return getApiUrl(path);
}

const REFRESH_STORAGE_KEY = "admin_refresh_token";
const ACCESS_STORAGE_KEY = "admin_access_token";
const EXPIRY_STORAGE_KEY = "admin_token_expiry";

export function getAccessToken(): string {
  return sessionStorage.getItem(ACCESS_STORAGE_KEY) || "";
}

export function authHeaders(): HeadersInit {
  const token = getAccessToken();
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

let refreshInFlight: Promise<boolean> | null = null;

/**
 * Uses refresh token in sessionStorage (same keys as AdminAuthContext) to obtain a new access token.
 * Deduplicates concurrent refresh calls.
 */
async function refreshAccessTokenOnce(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    try {
      const refresh = sessionStorage.getItem(REFRESH_STORAGE_KEY);
      if (!refresh) return false;
      const res = await fetch(apiUrl("/api/auth/refresh"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: refresh }),
      });
      const data = (await res.json()) as {
        success?: boolean;
        accessToken?: string;
        refreshToken?: string;
        expiresIn?: number;
      };
      if (!res.ok || !data.success || !data.accessToken) return false;
      sessionStorage.setItem(ACCESS_STORAGE_KEY, data.accessToken);
      // Server now rotates refresh tokens — store the new one if returned so
      // the next refresh uses an unrevoked credential.
      if (data.refreshToken) {
        sessionStorage.setItem(REFRESH_STORAGE_KEY, data.refreshToken);
      }
      const ttlMs =
        typeof data.expiresIn === "number" && data.expiresIn > 0
          ? data.expiresIn * 1000
          : 15 * 60 * 1000;
      sessionStorage.setItem(EXPIRY_STORAGE_KEY, String(Date.now() + ttlMs));
      window.dispatchEvent(new Event("admin-access-token-refreshed"));
      return true;
    } catch {
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const attempt = async (isAfterRefresh: boolean): Promise<Response> => {
    const headers = new Headers(init?.headers);
    const token = getAccessToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
    if (
      init?.body != null &&
      typeof init.body === "string" &&
      !headers.has("Content-Type")
    ) {
      headers.set("Content-Type", "application/json");
    }

    const res = await fetch(apiUrl(path), { ...init, headers });

    const hadToken = Boolean(token);
    if (res.status === 401 && hadToken && !isAfterRefresh) {
      const ok = await refreshAccessTokenOnce();
      if (ok) return attempt(true);
    }
    return res;
  };

  return attempt(false);
}

export function apiErrorMessage(json: unknown): string {
  if (!json || typeof json !== "object") return "Request failed";
  const o = json as Record<string, unknown>;
  if (typeof o.message === "string" && o.message.trim()) return o.message;

  const err = o.error;
  if (typeof err === "string") return err;
  if (
    err &&
    typeof err === "object" &&
    "message" in err &&
    typeof (err as { message: unknown }).message === "string"
  ) {
    return (err as { message: string }).message;
  }
  if (err && typeof err === "object") {
    const e = err as Record<string, unknown>;
    if (typeof e.details === "string" && e.details.trim()) return e.details;
    if (typeof e.hint === "string" && e.hint.trim()) return e.hint;
  }
  return "Request failed";
}

/** Safe message for catch blocks (avoids "[object Object]" from Error(non-string)). */
export function errorMessageFromUnknown(e: unknown, fallback: string): string {
  if (e instanceof Error) {
    const m = e.message;
    if (m && m !== "[object Object]") return m;
  }
  return fallback;
}

export async function apiFetchWithRetry(
  path: string,
  init?: RequestInit,
  opts?: { retries?: number; retryMethods?: string[] }
): Promise<Response> {
  const retries = opts?.retries ?? 2;
  const method = (init?.method || "GET").toUpperCase();
  const allowRetry = opts?.retryMethods?.includes(method) ?? method === "GET";
  let last: Response | undefined;
  for (let attempt = 0; attempt <= retries; attempt++) {
    last = await apiFetch(path, init);
    if (!allowRetry || last.ok || last.status < 500 || attempt === retries) return last;
    await new Promise((r) => setTimeout(r, 250 * (attempt + 1)));
  }
  return last!;
}
