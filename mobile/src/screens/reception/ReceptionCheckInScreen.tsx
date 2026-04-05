import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../navigation/AppNavigator";
import { apiFetch } from "../../api/client";
import { getUser } from "../../auth/storage";

type Props = NativeStackScreenProps<RootStackParamList, "ReceptionCheckIn">;

export default function ReceptionCheckInScreen({ route, navigation }: Props) {
  const { appointmentId, patientId } = route.params;
  const [complaint, setComplaint] = useState("");
  const [tempC, setTempC] = useState("");
  const [bpSys, setBpSys] = useState("");
  const [bpDia, setBpDia] = useState("");
  const [heartRate, setHeartRate] = useState("");
  const [spo2, setSpo2] = useState("");
  const [allergies, setAllergies] = useState("");

  const onCheckIn = async () => {
    try {
      const user = await getUser();
      if (!user?.clinic_id) return Alert.alert("Missing clinic");

      await apiFetch(`/api/appointments/${appointmentId}/checkin`, {
        method: "POST",
        body: JSON.stringify({
          chiefComplaint: complaint || undefined,
          vitals: {
            temperature_c: tempC ? Number(tempC) : undefined,
            bp_sys: bpSys ? Number(bpSys) : undefined,
            bp_dia: bpDia ? Number(bpDia) : undefined,
            heart_rate: heartRate ? Number(heartRate) : undefined,
            spo2: spo2 ? Number(spo2) : undefined,
          },
          intakeHistory: {
            allergies: allergies || undefined,
          },
        }),
      });

      const vitalsBody: Record<string, unknown> = {};
      if (bpSys) vitalsBody.bpSystolic = Number(bpSys);
      if (bpDia) vitalsBody.bpDiastolic = Number(bpDia);
      if (heartRate) vitalsBody.heartRate = Number(heartRate);
      if (tempC) vitalsBody.temperatureC = Number(tempC);
      if (spo2) vitalsBody.spo2 = Number(spo2);
      if (complaint) vitalsBody.notes = complaint;

      if (Object.keys(vitalsBody).length > 0) {
        await apiFetch(`/api/patients/${patientId}/vitals?clinicId=${encodeURIComponent(user.clinic_id)}`, {
          method: "POST",
          body: JSON.stringify(vitalsBody),
        });
      }

      Alert.alert("Checked-in", "Vitals saved — sent to doctor");
      navigation.replace("ReceptionAppointments");
    } catch (e) {
      Alert.alert("Failed", e instanceof Error ? e.message : "Unknown error");
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Check-in</Text>
      <Text style={styles.meta}>Appointment: {appointmentId}</Text>

      <TextInput value={complaint} onChangeText={setComplaint} placeholder="Chief complaint" style={styles.input} />
      <TextInput value={tempC} onChangeText={setTempC} placeholder="Temperature °C" keyboardType="numeric" style={styles.input} />
      <TextInput value={bpSys} onChangeText={setBpSys} placeholder="BP systolic" keyboardType="numeric" style={styles.input} />
      <TextInput value={bpDia} onChangeText={setBpDia} placeholder="BP diastolic" keyboardType="numeric" style={styles.input} />
      <TextInput value={heartRate} onChangeText={setHeartRate} placeholder="Heart rate (bpm)" keyboardType="numeric" style={styles.input} />
      <TextInput value={spo2} onChangeText={setSpo2} placeholder="SpO₂ %" keyboardType="numeric" style={styles.input} />
      <TextInput value={allergies} onChangeText={setAllergies} placeholder="Allergies (if any)" style={styles.input} />

      <Pressable onPress={onCheckIn} style={styles.btn}>
        <Text style={styles.btnText}>Send to doctor</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: "#0b1220" },
  title: { color: "white", fontSize: 22, fontWeight: "900", marginBottom: 6 },
  meta: { color: "#9ca3af", marginBottom: 12 },
  input: { backgroundColor: "white", borderRadius: 12, padding: 12, marginBottom: 10 },
  btn: { backgroundColor: "#2563eb", paddingVertical: 14, borderRadius: 14, alignItems: "center", marginTop: 8 },
  btnText: { color: "white", fontWeight: "900" },
});
