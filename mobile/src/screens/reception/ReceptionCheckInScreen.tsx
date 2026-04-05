import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../navigation/AppNavigator";
import { apiFetch } from "../../api/client";

type Props = NativeStackScreenProps<RootStackParamList, "ReceptionCheckIn">;

export default function ReceptionCheckInScreen({ route, navigation }: Props) {
  const { appointmentId } = route.params;
  const [complaint, setComplaint] = useState("");
  const [tempF, setTempF] = useState("");
  const [bp, setBp] = useState("");
  const [allergies, setAllergies] = useState("");

  const onCheckIn = async () => {
    try {
      await apiFetch(`/api/appointments/${appointmentId}/checkin`, {
        method: "POST",
        body: JSON.stringify({
          chiefComplaint: complaint || undefined,
          vitals: {
            temperature_f: tempF ? Number(tempF) : undefined,
            bp: bp || undefined,
          },
          intakeHistory: {
            allergies: allergies || undefined,
          },
        }),
      });
      Alert.alert("Checked-in", "Sent to doctor");
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
      <TextInput value={tempF} onChangeText={setTempF} placeholder="Temperature °F (e.g. 101.5)" keyboardType="numeric" style={styles.input} />
      <TextInput value={bp} onChangeText={setBp} placeholder="BP (e.g. 120/80)" style={styles.input} />
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

