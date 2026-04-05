import { useEffect, useMemo, useState } from "react";
import { Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../navigation/AppNavigator";
import { apiFetch } from "../../api/client";
import { getUser } from "../../auth/storage";
import type { PatientDTO } from "../../types";

type Props = NativeStackScreenProps<RootStackParamList, "ReceptionNewAppointment">;

type DoctorListOk = { success: true; doctors: Array<{ id: string; name: string; role: string }> };

export default function ReceptionNewAppointmentScreen({ navigation }: Props) {
  const [query, setQuery] = useState("");
  const [patients, setPatients] = useState<PatientDTO[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<PatientDTO | null>(null);
  const [doctors, setDoctors] = useState<Array<{ id: string; name: string }>>([]);
  const [doctorId, setDoctorId] = useState<string>("");
  const [chiefComplaint, setChiefComplaint] = useState("");
  const [minutesFromNow, setMinutesFromNow] = useState("30");

  const clinicIdPromise = useMemo(async () => (await getUser())?.clinic_id || null, []);

  useEffect(() => {
    (async () => {
      const clinicId = await clinicIdPromise;
      if (!clinicId) return;
      const d = await apiFetch<DoctorListOk>(`/api/staff/doctors?clinicId=${encodeURIComponent(clinicId)}`);
      const list = d.doctors.map((x) => ({ id: x.id, name: x.name }));
      setDoctors(list);
      if (list[0]) setDoctorId(list[0].id);
    })();
  }, [clinicIdPromise]);

  const search = async () => {
    const clinicId = await clinicIdPromise;
    if (!clinicId) return;
    const resp = await apiFetch<{ success: true; patients: PatientDTO[] }>(
      `/api/patients?clinicId=${encodeURIComponent(clinicId)}&query=${encodeURIComponent(query)}`
    );
    setPatients(resp.patients);
  };

  const createPatientQuick = async () => {
    const clinicId = await clinicIdPromise;
    if (!clinicId) return;
    if (!query.trim()) return Alert.alert("Enter patient name or phone");

    // Heuristic: if query contains digits, treat as phone; else make a dummy phone prompt.
    const digits = query.replace(/\D/g, "");
    const phone = digits.length >= 6 ? digits : undefined;
    if (!phone) return Alert.alert("Enter phone number in search box to quick-create");

    const body = {
      clinicId,
      name: query.trim(),
      phone,
    };

    const resp = await apiFetch<{ success: true; patient: PatientDTO }>("/api/patients", {
      method: "POST",
      body: JSON.stringify(body),
    });
    setSelectedPatient(resp.patient);
    Alert.alert("Patient saved", resp.patient.name);
  };

  const createAppointment = async () => {
    const clinicId = await clinicIdPromise;
    if (!clinicId) return;
    if (!selectedPatient) return Alert.alert("Select a patient");
    if (!doctorId) return Alert.alert("Select a doctor");

    const mins = Math.max(parseInt(minutesFromNow || "0", 10) || 0, 0);
    const appointmentTime = new Date(Date.now() + mins * 60 * 1000).toISOString();

    const resp = await apiFetch<{ success: true; appointment: { id: string } }>("/api/appointments", {
      method: "POST",
      body: JSON.stringify({
        clinicId,
        patientId: selectedPatient.id,
        doctorUserId: doctorId,
        appointmentTime,
        chiefComplaint: chiefComplaint || undefined,
      }),
    });

    Alert.alert("Appointment created", `ID: ${resp.appointment.id}`);
    navigation.replace("ReceptionAppointments");
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Search patient (name/phone)</Text>
      <View style={styles.row}>
        <TextInput value={query} onChangeText={setQuery} placeholder="Rahul / 9876543210" style={styles.input} />
        <Pressable onPress={search} style={styles.btn}>
          <Text style={styles.btnText}>Search</Text>
        </Pressable>
      </View>

      <Pressable onPress={createPatientQuick} style={styles.btnSecondary}>
        <Text style={styles.btnText}>Quick-create patient from phone</Text>
      </Pressable>

      <Text style={styles.section}>Patients</Text>
      <FlatList
        data={patients}
        keyExtractor={(p) => p.id}
        style={{ maxHeight: 180 }}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => setSelectedPatient(item)}
            style={[styles.item, selectedPatient?.id === item.id && styles.itemSelected]}
          >
            <Text style={styles.itemTitle}>{item.name}</Text>
            <Text style={styles.itemMeta}>{item.phone}</Text>
          </Pressable>
        )}
        ListEmptyComponent={<Text style={{ color: "#6b7280" }}>Search to find patients.</Text>}
      />

      <Text style={styles.section}>Doctor</Text>
      <FlatList
        data={doctors}
        keyExtractor={(d) => d.id}
        horizontal
        renderItem={({ item }) => (
          <Pressable
            onPress={() => setDoctorId(item.id)}
            style={[styles.pill, doctorId === item.id && styles.pillSelected]}
          >
            <Text style={styles.pillText}>{item.name}</Text>
          </Pressable>
        )}
      />

      <Text style={styles.section}>Chief complaint</Text>
      <TextInput value={chiefComplaint} onChangeText={setChiefComplaint} placeholder="Fever and headache" style={styles.input} />

      <Text style={styles.section}>Appointment in (minutes)</Text>
      <TextInput value={minutesFromNow} onChangeText={setMinutesFromNow} keyboardType="numeric" style={styles.input} />

      <Pressable onPress={createAppointment} style={styles.btnPrimary}>
        <Text style={styles.btnPrimaryText}>Create appointment</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: "#0b1220" },
  label: { color: "#e5e7eb", fontWeight: "700", marginBottom: 8 },
  row: { flexDirection: "row", gap: 10, alignItems: "center" },
  input: { backgroundColor: "white", borderRadius: 12, padding: 12, flex: 1, marginBottom: 10 },
  btn: { backgroundColor: "#2563eb", paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12 },
  btnSecondary: { backgroundColor: "#111827", paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: "#1f2937" },
  btnText: { color: "white", fontWeight: "800" },
  section: { color: "#e5e7eb", fontWeight: "800", marginTop: 10, marginBottom: 8 },
  item: { padding: 12, borderRadius: 12, backgroundColor: "#111827", marginBottom: 8, borderWidth: 1, borderColor: "#1f2937" },
  itemSelected: { borderColor: "#2563eb" },
  itemTitle: { color: "white", fontWeight: "800" },
  itemMeta: { color: "#9ca3af", marginTop: 4 },
  pill: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 999, backgroundColor: "#111827", marginRight: 10, borderWidth: 1, borderColor: "#1f2937" },
  pillSelected: { borderColor: "#22c55e" },
  pillText: { color: "white", fontWeight: "700" },
  btnPrimary: { backgroundColor: "#22c55e", paddingVertical: 14, borderRadius: 14, alignItems: "center", marginTop: 14 },
  btnPrimaryText: { color: "#052e16", fontWeight: "900" },
});

