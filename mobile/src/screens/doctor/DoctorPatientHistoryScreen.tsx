import { useCallback, useEffect, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../navigation/AppNavigator";
import { apiFetch } from "../../api/client";
import { getUser } from "../../auth/storage";
import type { ConsultationDTO } from "../../types";

type Props = NativeStackScreenProps<RootStackParamList, "DoctorPatientHistory">;

export default function DoctorPatientHistoryScreen({ route }: Props) {
  const { patientId } = route.params;
  const [items, setItems] = useState<ConsultationDTO[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const user = await getUser();
      if (!user?.clinic_id) return;
      const resp = await apiFetch<{ success: true; consultations: ConsultationDTO[] }>(
        `/api/consultations/patients/${encodeURIComponent(patientId)}/history?clinicId=${encodeURIComponent(
          user.clinic_id
        )}`
      );
      setItems(resp.consultations);
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <View style={styles.container}>
      <Pressable style={styles.refresh} onPress={load}>
        <Text style={styles.refreshText}>{loading ? "Loading..." : "Refresh"}</Text>
      </Pressable>

      <FlatList
        data={items}
        keyExtractor={(it) => it.id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.title}>{new Date(item.created_at).toLocaleString()}</Text>
            {!!item.diagnosis && <Text style={styles.meta}>Dx: {item.diagnosis}</Text>}
            {!!item.treatment_plan && <Text style={styles.meta}>Plan: {item.treatment_plan}</Text>}
            {!!item.notes && <Text style={styles.meta}>Notes: {item.notes}</Text>}
          </View>
        )}
        ListEmptyComponent={
          <View style={{ padding: 16 }}>
            <Text style={{ color: "#6b7280" }}>No history yet.</Text>
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
  title: { color: "white", fontWeight: "900", marginBottom: 6 },
  meta: { color: "#cbd5e1", marginTop: 4 },
});

