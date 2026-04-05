import { useCallback, useRef } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { apiFetch } from "../api/client";
import { clearSession, getUser } from "../auth/storage";
import type { RootStackParamList } from "../navigation/AppNavigator";

type Props = NativeStackScreenProps<RootStackParamList, "DoctorHome">;

export default function DoctorHome({ navigation }: Props) {
  const seenRef = useRef<Set<string>>(new Set());
  const bootstrappedRef = useRef(false);

  useFocusEffect(
    useCallback(() => {
      const tick = async () => {
        try {
          const user = await getUser();
          if (!user?.clinic_id) return;
          const since = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
          const json = await apiFetch<{ success: true; alerts: Array<{ id: string }> }>(
            `/api/consultations/payment-alerts?clinicId=${encodeURIComponent(user.clinic_id)}&since=${encodeURIComponent(since)}`
          );
          const list = json.alerts || [];
          if (!bootstrappedRef.current) {
            for (const a of list) seenRef.current.add(a.id);
            bootstrappedRef.current = true;
            return;
          }
          for (const a of list) {
            if (seenRef.current.has(a.id)) continue;
            seenRef.current.add(a.id);
            Alert.alert("Payment successful", "Reception marked payment for a recent visit.");
            break;
          }
        } catch {
          /* offline / auth */
        }
      };

      void tick();
      const t = setInterval(() => void tick(), 6000);
      return () => clearInterval(t);
    }, [])
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Doctor</Text>
      <Text style={styles.subtitle}>Queue, consultation, payment alerts (poll every ~6s while here)</Text>

      <Pressable onPress={() => navigation.navigate("DoctorQueue")} style={styles.primary}>
        <Text style={styles.primaryText}>Open queue</Text>
      </Pressable>

      <View style={{ height: 12 }} />

      <Pressable
        onPress={async () => {
          await clearSession();
          navigation.replace("Login");
        }}
        style={styles.button}
      >
        <Text style={styles.buttonText}>Logout</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: "center" },
  title: { fontSize: 28, fontWeight: "800", marginBottom: 8 },
  subtitle: { color: "#6b7280", marginBottom: 24 },
  primary: { backgroundColor: "#2563eb", padding: 12, borderRadius: 12, width: 200 },
  primaryText: { color: "white", fontWeight: "900", textAlign: "center" },
  button: { backgroundColor: "#ef4444", padding: 12, borderRadius: 12, width: 140 },
  buttonText: { color: "white", fontWeight: "700", textAlign: "center" },
});

