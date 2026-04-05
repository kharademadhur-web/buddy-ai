import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../navigation/AppNavigator";
import { apiFetch } from "../../api/client";
import { getUser } from "../../auth/storage";
import type { AppointmentDTO } from "../../types";
import { subscribeClinicEvents } from "../../realtime/sse";

type Props = NativeStackScreenProps<RootStackParamList, "ReceptionAppointments">;

function todayYmd() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default function ReceptionAppointmentsScreen({ navigation }: Props) {
  const [items, setItems] = useState<AppointmentDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const sseAbortRef = useRef<AbortController | null>(null);

  const date = useMemo(() => todayYmd(), []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const user = await getUser();
      if (!user?.clinic_id) return;
      const resp = await apiFetch<{ success: true; appointments: AppointmentDTO[] }>(
        `/api/appointments?date=${encodeURIComponent(date)}&clinicId=${encodeURIComponent(user.clinic_id)}`
      );
      setItems(resp.appointments);
    } finally {
      setLoading(false);
    }
  }, [date]);

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
            if (
              eventName.startsWith("appointment.") ||
              eventName.startsWith("consultation.") ||
              eventName.startsWith("bill.")
            ) {
              load();
            }
          },
        });
      } catch {
        // ignore; mobile networking can vary, refresh button remains
      }
    })();
    return () => ac.abort();
  }, [load]);

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.title}>Today</Text>
          <Text style={styles.sub}>Date: {date}</Text>
        </View>
        <Pressable style={styles.primaryBtn} onPress={() => navigation.navigate("ReceptionNewAppointment")}>
          <Text style={styles.primaryBtnText}>+ New</Text>
        </Pressable>
      </View>

      <Pressable style={styles.refreshBtn} onPress={load}>
        <Text style={styles.refreshText}>{loading ? "Loading..." : "Refresh"}</Text>
      </Pressable>

      <FlatList
        data={items}
        keyExtractor={(it) => it.id}
        contentContainerStyle={{ paddingBottom: 32 }}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{new Date(item.appointment_time).toLocaleTimeString()}</Text>
            <Text style={styles.cardMeta}>Status: {item.status}</Text>
            {!!item.chief_complaint && <Text style={styles.cardMeta}>Complaint: {item.chief_complaint}</Text>}

            <View style={styles.cardActions}>
              <Pressable
                style={styles.secondaryBtn}
                onPress={() => navigation.navigate("ReceptionCheckIn", { appointmentId: item.id })}
              >
                <Text style={styles.secondaryBtnText}>Check-in</Text>
              </Pressable>
              <Pressable
                style={styles.secondaryBtn}
                onPress={() =>
                  navigation.navigate("ReceptionBilling", {
                    appointmentId: item.id,
                    patientId: item.patient_id,
                  })
                }
              >
                <Text style={styles.secondaryBtnText}>Billing</Text>
              </Pressable>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View style={{ padding: 16 }}>
            <Text style={{ color: "#6b7280" }}>No appointments yet.</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: "#0b1220" },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  title: { fontSize: 22, fontWeight: "800", color: "white" },
  sub: { color: "#9ca3af", marginTop: 2 },
  primaryBtn: { backgroundColor: "#2563eb", paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12 },
  primaryBtnText: { color: "white", fontWeight: "800" },
  refreshBtn: { alignSelf: "flex-start", marginBottom: 12, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 12, backgroundColor: "#111827" },
  refreshText: { color: "#e5e7eb", fontWeight: "700" },
  card: { backgroundColor: "#111827", borderRadius: 16, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: "#1f2937" },
  cardTitle: { color: "white", fontWeight: "800", fontSize: 16, marginBottom: 4 },
  cardMeta: { color: "#cbd5e1", marginTop: 2 },
  cardActions: { flexDirection: "row", gap: 10, marginTop: 12 },
  secondaryBtn: { backgroundColor: "#0f172a", borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12, borderWidth: 1, borderColor: "#334155" },
  secondaryBtnText: { color: "white", fontWeight: "700" },
});

