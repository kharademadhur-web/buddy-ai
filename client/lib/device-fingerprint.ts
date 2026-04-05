import crypto from "crypto";

/**
 * Device fingerprint generator
 * Combines User-Agent, available screen resolution, and timezone
 * to create a unique device identifier
 */

const DEVICE_ID_KEY = "clinic_saas_device_id";
const DEVICE_INFO_KEY = "clinic_saas_device_info";

interface DeviceInfo {
  userAgent: string;
  resolution: string;
  timezone: string;
  language: string;
  timestamp: number;
}

/**
 * Get or create persistent device ID
 * Uses localStorage to persist device ID across sessions
 */
export function getOrCreateDeviceId(): string {
  // Check if device ID already exists in localStorage
  const existingDeviceId = localStorage.getItem(DEVICE_ID_KEY);
  if (existingDeviceId) {
    return existingDeviceId;
  }

  // Generate new device ID
  const deviceId = generateDeviceId();
  localStorage.setItem(DEVICE_ID_KEY, deviceId);
  
  // Store device info
  const deviceInfo = getDeviceInfo();
  localStorage.setItem(DEVICE_INFO_KEY, JSON.stringify(deviceInfo));

  return deviceId;
}

/**
 * Generate unique device ID based on device characteristics
 */
function generateDeviceId(): string {
  const deviceInfo = getDeviceInfo();
  const fingerprint = `${deviceInfo.userAgent}|${deviceInfo.resolution}|${deviceInfo.timezone}|${deviceInfo.language}`;
  
  // Use SubtleCrypto for hashing in browser
  // Since we need synchronous hash, we'll use a simple alternative
  return hashString(fingerprint);
}

/**
 * Get current device information
 */
export function getDeviceInfo(): DeviceInfo {
  return {
    userAgent: navigator.userAgent,
    resolution: `${window.screen.width}x${window.screen.height}`,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    language: navigator.language,
    timestamp: Date.now(),
  };
}

/**
 * Simple hash function for device fingerprint
 * Creates a deterministic hash from a string
 */
function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  // Convert to hex string and ensure it's always the same length
  return `device_${Math.abs(hash).toString(16).padStart(16, "0")}`;
}

/**
 * Validate device fingerprint matches current device
 * Returns true if current device matches stored fingerprint
 */
export function validateDeviceFingerprint(storedDeviceId: string): boolean {
  const currentDeviceId = generateDeviceId();
  return currentDeviceId === storedDeviceId;
}

/**
 * Get stored device ID
 */
export function getStoredDeviceId(): string | null {
  return localStorage.getItem(DEVICE_ID_KEY);
}

/**
 * Get stored device info
 */
export function getStoredDeviceInfo(): DeviceInfo | null {
  const stored = localStorage.getItem(DEVICE_INFO_KEY);
  return stored ? JSON.parse(stored) : null;
}

/**
 * Clear device ID (logout all devices or switch device)
 */
export function clearDeviceId(): void {
  localStorage.removeItem(DEVICE_ID_KEY);
  localStorage.removeItem(DEVICE_INFO_KEY);
}

/**
 * Check if device is trusted (has been used for login before)
 */
export function isDeviceTrusted(): boolean {
  return localStorage.getItem(DEVICE_ID_KEY) !== null;
}
