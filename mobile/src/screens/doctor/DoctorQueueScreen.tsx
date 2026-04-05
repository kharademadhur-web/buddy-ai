import { useCallback, useEffect, useRef, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../navigation/AppNavigator";
import { apiFetch } from "../../api/client";
import { getUser } from "../../auth/storage";
import type { AppointmentDTO } from "../../types";
import { subscribeClinicEvents } from "../../realtime/sse";

type Props = NativeStackScreenProps<RootStackParamList, "DoctorQueue">;

export default function DoctorQueueScreen({ navigation }: Props) {
  const [queue, setQueue] = useState<AppointmentDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const sseAbortRef = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const user = await getUser();
      if (!user?.clinic_id) return;
      const resp = await apiFetch<{ success: true; queue: AppointmentDTO[] }>(
        `/api/queue?clinicId=${encodeURIComponent(user.clinic_id)}&doctorId=${encodeURIComponent(user.id)}`
      );
      setQueue(resp.queue);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const ac = new AbortController();
    sseAbortRef.current = ac;
    (async () => {
      try {
        await subscribeClinicEvents({
          signal: ac.signal,
          onEvent: (eventName) => {
            if (eventName.startsWith("appointment.") || eventName.startsWith("consultation.")) {
              load();
            }
          },
        });
      } catch {
        // ignore, refresh button exists
      }
    })();
    return () => ac.abort();
  }, [load]);

  return (
    <View style={styles.container}>
      <Pressable style={styles.refresh} onPress={load}>
        <Text style={styles.refreshText}>{loading ? "Loading..." : "Refresh"}</Text>
      </Pressable>

      <FlatList
        data={queue}
        keyExtractor={(it) => it.id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Status: {item.status}</Text>
            <Text style={styles.meta}>Time: {new Date(item.appointment_time).toLocaleTimeString()}</Text>
            {!!item.chief_complaint && <Text style={styles.meta}>Complaint: {item.chief_complaint}</Text>}
            <View style={styles.actions}>
              <Pressable
                style={styles.btn}
                onPress={() =>
                  navigation.navigate("DoctorConsultation", {
                    appointmentId: item.id,
                    patientId: item.patient_id,
                  })
                }
              >
                <Text style={styles.btnText}>Consult</Text>
              </Pressable>
              <Pressable
                style={styles.btnSecondary}
                onPress={() => navigation.navigate("DoctorPatientHistory", { patientId: item.patient_id })}
              >
                <Text style={styles.btnText}>History</Text>
              </Pressable>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View style={{ padding: 16 }}>
            <Text style={{ color: "#6b7280" }}>No patients in queue.</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: "#0b1220" },
  refresh: { alignSelf: "flex-start", paddingVertical: 8, paddingHorizontal: 12, borderRadius: 12, backgroundColor: "#111827", marginBottom: 12 },
  refreshText: { color: "#e5e7eb", fontWeight: "800" },
  card: { backgroundColor: "#111827", borderRadius: 16, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: "#1f2937" },
  cardTitle: { color: "white", fontWeight: "900" },
  meta: { color: "#cbd5e1", marginTop: 4 },
  actions: { flexDirection: "row", gap: 10, marginTop: 12 },
  btn: { flex: 1, backgroundColor: "#22c55e", paddingVertical: 12, borderRadius: 12, alignItems: "center" },
  btnSecondary: { flex: 1, backgroundColor: "#2563eb", paddingVertical: 12, borderRadius: 12, alignItems: "center" },
  btnText: { color: "white", fontWeight: "900" },
});

