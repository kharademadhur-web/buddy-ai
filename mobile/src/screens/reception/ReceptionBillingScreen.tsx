import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../navigation/AppNavigator";
import { apiFetch } from "../../api/client";
import { getUser } from "../../auth/storage";
import { billHtml, shareHtmlAsPdf } from "../../print/pdf";

type Props = NativeStackScreenProps<RootStackParamList, "ReceptionBilling">;

export default function ReceptionBillingScreen({ route, navigation }: Props) {
  const { appointmentId, patientId } = route.params;
  const [consultationFee, setConsultationFee] = useState("500");
  const [medicineCost, setMedicineCost] = useState("200");
  const [billId, setBillId] = useState<string | null>(null);

  const createBill = async () => {
    const user = await getUser();
    if (!user?.clinic_id) return Alert.alert("Missing clinic");
    const resp = await apiFetch<{ success: true; bill: { id: string } }>("/api/billing", {
      method: "POST",
      body: JSON.stringify({
        clinicId: user.clinic_id,
        appointmentId,
        patientId,
        consultationFee: Number(consultationFee || 0),
        medicineCost: Number(medicineCost || 0),
      }),
    });
    setBillId(resp.bill.id);
    Alert.alert("Bill created", resp.bill.id);
  };

  const pay = async (method: "upi" | "cash" | "card" | "other") => {
    if (!billId) return Alert.alert("Create bill first");
    await apiFetch(`/api/billing/${billId}/payments`, {
      method: "POST",
      body: JSON.stringify({ paymentMethod: method }),
    });
    Alert.alert("Paid", `Method: ${method}`);
    navigation.replace("ReceptionAppointments");
  };

  const shareBill = async () => {
    const html = billHtml({
      clinicName: "Clinic",
      patientName: `Patient ${patientId}`,
      date: new Date().toLocaleDateString(),
      consultationFee: Number(consultationFee || 0),
      medicineCost: Number(medicineCost || 0),
      total: Number(consultationFee || 0) + Number(medicineCost || 0),
    });
    await shareHtmlAsPdf({ title: "Bill", html });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Billing</Text>
      <Text style={styles.meta}>Appointment: {appointmentId}</Text>

      <TextInput value={consultationFee} onChangeText={setConsultationFee} keyboardType="numeric" style={styles.input} placeholder="Consultation fee" />
      <TextInput value={medicineCost} onChangeText={setMedicineCost} keyboardType="numeric" style={styles.input} placeholder="Medicine cost" />

      <Pressable onPress={createBill} style={styles.btnPrimary}>
        <Text style={styles.btnPrimaryText}>{billId ? "Recreate bill" : "Create bill"}</Text>
      </Pressable>

      <View style={{ height: 12 }} />

      <View style={styles.row}>
        <Pressable onPress={() => pay("upi")} style={styles.btnPay}><Text style={styles.btnPayText}>UPI</Text></Pressable>
        <Pressable onPress={() => pay("cash")} style={styles.btnPay}><Text style={styles.btnPayText}>Cash</Text></Pressable>
        <Pressable onPress={() => pay("card")} style={styles.btnPay}><Text style={styles.btnPayText}>Card</Text></Pressable>
      </View>

      <View style={{ height: 12 }} />
      <Pressable onPress={shareBill} style={styles.btnShare}>
        <Text style={styles.btnPayText}>Share bill (PDF)</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: "#0b1220" },
  title: { color: "white", fontSize: 22, fontWeight: "900", marginBottom: 6 },
  meta: { color: "#9ca3af", marginBottom: 12 },
  input: { backgroundColor: "white", borderRadius: 12, padding: 12, marginBottom: 10 },
  btnPrimary: { backgroundColor: "#22c55e", paddingVertical: 14, borderRadius: 14, alignItems: "center" },
  btnPrimaryText: { color: "#052e16", fontWeight: "900" },
  row: { flexDirection: "row", gap: 10 },
  btnPay: { flex: 1, backgroundColor: "#2563eb", paddingVertical: 12, borderRadius: 12, alignItems: "center" },
  btnPayText: { color: "white", fontWeight: "900" },
  btnShare: { backgroundColor: "#111827", paddingVertical: 12, borderRadius: 12, alignItems: "center", borderWidth: 1, borderColor: "#1f2937" },
});

