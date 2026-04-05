import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../navigation/AppNavigator";
import { apiFetch } from "../../api/client";
import { getUser } from "../../auth/storage";
import { prescriptionHtml, shareHtmlAsPdf } from "../../print/pdf";

type Props = NativeStackScreenProps<RootStackParamList, "DoctorConsultation">;

export default function DoctorConsultationScreen({ route, navigation }: Props) {
  const { appointmentId, patientId } = route.params;

  const [diagnosis, setDiagnosis] = useState("Viral fever");
  const [treatmentPlan, setTreatmentPlan] = useState("Rest + fluids");
  const [notes, setNotes] = useState("");

  const [medName, setMedName] = useState("Paracetamol");
  const [medDosage, setMedDosage] = useState("500mg");
  const [medFreq, setMedFreq] = useState("BD");
  const [medDuration, setMedDuration] = useState("3 days");
  const [medQty, setMedQty] = useState("10");

  const complete = async () => {
    const user = await getUser();
    if (!user?.clinic_id) return Alert.alert("Missing clinic");

    const rxItems = [
      {
        name: medName,
        dosage: medDosage || undefined,
        frequency: medFreq || undefined,
        duration: medDuration || undefined,
        quantity: medQty ? Number(medQty) : undefined,
      },
    ];

    const followUpDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    await apiFetch("/api/consultations/complete", {
      method: "POST",
      body: JSON.stringify({
        clinicId: user.clinic_id,
        appointmentId,
        patientId,
        diagnosis: diagnosis || undefined,
        treatmentPlan: treatmentPlan || undefined,
        notes: notes || undefined,
        prescription: {
          followUpDate,
          items: rxItems,
        },
      }),
    });

    Alert.alert("Completed", "Consultation + prescription saved");
    navigation.replace("DoctorQueue");
  };

  const shareRx = async () => {
    const user = await getUser();
    const html = prescriptionHtml({
      clinicName: "Clinic",
      doctorName: user?.name || "Doctor",
      patientName: `Patient ${patientId}`,
      date: new Date().toLocaleDateString(),
      diagnosis,
      items: [
        {
          name: medName,
          dosage: medDosage || undefined,
          frequency: medFreq || undefined,
          duration: medDuration || undefined,
          quantity: medQty ? Number(medQty) : undefined,
        },
      ],
      notes,
      followUpDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    });
    await shareHtmlAsPdf({ title: "Prescription", html });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Consultation</Text>
      <Text style={styles.meta}>Appointment: {appointmentId}</Text>

      <TextInput value={diagnosis} onChangeText={setDiagnosis} placeholder="Diagnosis" style={styles.input} />
      <TextInput value={treatmentPlan} onChangeText={setTreatmentPlan} placeholder="Treatment plan" style={styles.input} />
      <TextInput value={notes} onChangeText={setNotes} placeholder="Notes" style={styles.input} />

      <Text style={styles.section}>Prescription</Text>
      <TextInput value={medName} onChangeText={setMedName} placeholder="Medicine name" style={styles.input} />
      <TextInput value={medDosage} onChangeText={setMedDosage} placeholder="Dosage" style={styles.input} />
      <TextInput value={medFreq} onChangeText={setMedFreq} placeholder="Frequency" style={styles.input} />
      <TextInput value={medDuration} onChangeText={setMedDuration} placeholder="Duration" style={styles.input} />
      <TextInput value={medQty} onChangeText={setMedQty} keyboardType="numeric" placeholder="Quantity" style={styles.input} />

      <Pressable onPress={complete} style={styles.btn}>
        <Text style={styles.btnText}>Complete consultation</Text>
      </Pressable>

      <View style={{ height: 12 }} />
      <Pressable onPress={shareRx} style={styles.btnSecondary}>
        <Text style={styles.btnSecondaryText}>Share prescription (PDF)</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: "#0b1220" },
  title: { color: "white", fontSize: 22, fontWeight: "900", marginBottom: 6 },
  meta: { color: "#9ca3af", marginBottom: 12 },
  section: { color: "#e5e7eb", fontWeight: "900", marginTop: 10, marginBottom: 8 },
  input: { backgroundColor: "white", borderRadius: 12, padding: 12, marginBottom: 10 },
  btn: { backgroundColor: "#22c55e", paddingVertical: 14, borderRadius: 14, alignItems: "center", marginTop: 6 },
  btnText: { color: "#052e16", fontWeight: "900" },
  btnSecondary: { backgroundColor: "#2563eb", paddingVertical: 14, borderRadius: 14, alignItems: "center" },
  btnSecondaryText: { color: "white", fontWeight: "900" },
});

