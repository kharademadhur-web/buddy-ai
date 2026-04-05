/**
 * API origin for browser fetches. In dev, same-origin + Vite proxy works; in production
 * set VITE_API_URL to the public HTTPS API origin if the SPA is served separately.
 */
export const API_BASE_URL = import.meta.env.VITE_API_URL?.replace(/\/$/, "") || "";

export function apiUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return API_BASE_URL ? `${API_BASE_URL}${p}` : p;
}

export function getAccessToken(): string {
  return sessionStorage.getItem("admin_access_token") || "";
}

export function authHeaders(): HeadersInit {
  const token = getAccessToken();
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
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
  return fetch(apiUrl(path), { ...init, headers });
}

export function apiErrorMessage(json: unknown): string {
  if (!json || typeof json !== "object") return "Request failed";
  const err = (json as { error?: unknown }).error;
  if (typeof err === "string") return err;
  if (
    err &&
    typeof err === "object" &&
    "message" in err &&
    typeof (err as { message: unknown }).message === "string"
  ) {
    return (err as { message: string }).message;
  }
  return "Request failed";
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
