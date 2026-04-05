import AsyncStorage from "@react-native-async-storage/async-storage";

const KEYS = {
  accessToken: "accessToken",
  refreshToken: "refreshToken",
  user: "user",
};

export type MobileUser = {
  id: string;
  user_id: string;
  name: string;
  role: "doctor" | "receptionist" | "independent" | "super-admin" | "clinic-admin";
  clinic_id: string | null;
};

export async function saveSession(params: {
  accessToken: string;
  refreshToken: string;
  user: MobileUser;
}) {
  await AsyncStorage.multiSet([
    [KEYS.accessToken, params.accessToken],
    [KEYS.refreshToken, params.refreshToken],
    [KEYS.user, JSON.stringify(params.user)],
  ]);
}

export async function clearSession() {
  await AsyncStorage.multiRemove([KEYS.accessToken, KEYS.refreshToken, KEYS.user]);
}

export async function getAccessToken() {
  return AsyncStorage.getItem(KEYS.accessToken);
}

export async function getUser(): Promise<MobileUser | null> {
  const raw = await AsyncStorage.getItem(KEYS.user);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as MobileUser;
  } catch {
    return null;
  }
}

