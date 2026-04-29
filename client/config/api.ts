/**
 * Centralised API base URL config.
 *
 * Priority order:
 * 1. VITE_API_URL env var (set in .env.mobile / .env.web for builds)
 * 2. Empty string → same-origin (Vite dev proxy / Express serve same port)
 *
 * For APK builds pointing at a local dev server, set:
 *   VITE_API_URL=http://192.168.1.10:8080   (replace with your machine's LAN IP)
 */
export const API_BASE_URL = (import.meta.env.VITE_API_URL as string)?.replace(/\/$/, "") || "";

export function getApiUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return API_BASE_URL ? `${API_BASE_URL}${p}` : p;
}
