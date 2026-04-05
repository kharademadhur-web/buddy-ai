import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { apiFetch } from "../api/client";
import { saveSession } from "../auth/storage";
import type { RootStackParamList } from "../navigation/AppNavigator";

type Props = NativeStackScreenProps<RootStackParamList, "Login">;

type LoginOk = {
  success: true;
  data: {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
    user: {
      id: string;
      user_id: string;
      name: string;
      email: string | null;
      phone: string | null;
      role: "doctor" | "receptionist" | "independent" | "super-admin" | "clinic-admin";
      clinic_id: string | null;
    };
  };
};

export default function LoginScreen({ navigation }: Props) {
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const onLogin = async () => {
    if (!userId || !password) return;
    setLoading(true);
    try {
      const resp = await apiFetch<LoginOk>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ user_id: userId, password }),
      });

      await saveSession({
        accessToken: resp.data.accessToken,
        refreshToken: resp.data.refreshToken,
        user: resp.data.user,
      });

      const role = resp.data.user.role;
      if (role === "doctor") navigation.replace("DoctorHome");
      else if (role === "receptionist") navigation.replace("ReceptionHome");
      else navigation.replace("IndependentHome");
    } catch (e) {
      Alert.alert("Login failed", e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Clinical Assistant</Text>
      <Text style={styles.subtitle}>Doctor / Reception / Independent</Text>

      <TextInput
        value={userId}
        onChangeText={setUserId}
        placeholder="User ID (e.g. MUM001-DOC-10234)"
        autoCapitalize="characters"
        style={styles.input}
      />
      <TextInput
        value={password}
        onChangeText={setPassword}
        placeholder="Password"
        secureTextEntry
        style={styles.input}
      />

      <Pressable
        onPress={onLogin}
        disabled={loading || !userId || !password}
        style={({ pressed }) => [
          styles.button,
          (loading || !userId || !password) && styles.buttonDisabled,
          pressed && styles.buttonPressed,
        ]}
      >
        <Text style={styles.buttonText}>{loading ? "Signing in..." : "Sign in"}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: "center", backgroundColor: "#0b1220" },
  title: { fontSize: 32, fontWeight: "800", color: "white", marginBottom: 8 },
  subtitle: { fontSize: 14, color: "#9ca3af", marginBottom: 24 },
  input: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  button: {
    backgroundColor: "#2563eb",
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
  },
  buttonDisabled: { backgroundColor: "#334155" },
  buttonPressed: { opacity: 0.9 },
  buttonText: { color: "white", fontWeight: "700" },
});

