import { useEffect, useState } from "react";
import { Alert, Linking, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
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
  const [billPaid, setBillPaid] = useState(false);
  const [patientPhone, setPatientPhone] = useState("");
  const [patientName, setPatientName] = useState("");

  useEffect(() => {
    (async () => {
      const user = await getUser();
      if (!user?.clinic_id) return;
      try {
        const r = await apiFetch<{ success: true; patient: { phone: string; name: string } }>(
          `/api/patients/${patientId}?clinicId=${encodeURIComponent(user.clinic_id)}`
        );
        setPatientPhone(r.patient.phone || "");
        setPatientName(r.patient.name || "");
      } catch {
        /* ignore */
      }
    })();
  }, [patientId]);

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
    setBillPaid(false);
    Alert.alert("Bill created", resp.bill.id);
  };

  const pay = async (method: "upi" | "cash" | "card" | "other") => {
    if (!billId) return Alert.alert("Create bill first");
    await apiFetch(`/api/billing/${billId}/payments`, {
      method: "POST",
      body: JSON.stringify({ paymentMethod: method }),
    });
    setBillPaid(true);
    Alert.alert("Paid", `Method: ${method}. You can share PDF now.`);
  };

  const shareBill = async () => {
    if (!billPaid) {
      Alert.alert("Payment required", "Mark the bill as paid before sharing or printing.");
      return;
    }
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

  const total = Number(consultationFee || 0) + Number(medicineCost || 0);
  const billMessage = `Hello${patientName ? ` ${patientName}` : ""}, your visit bill is paid. Total: ₹${total}. Thank you for visiting our clinic.`;

  const openWhatsAppApp = async () => {
    if (!billPaid) {
      Alert.alert("Payment required", "Mark paid before messaging.");
      return;
    }
    const d = patientPhone.replace(/\D/g, "");
    if (d.length < 10) return Alert.alert("Phone", "Patient phone not on file.");
    const n = d.length === 10 ? `91${d}` : d.startsWith("91") ? d : d;
    const url = `whatsapp://send?phone=${n}&text=${encodeURIComponent(billMessage)}`;
    const ok = await Linking.canOpenURL(url).catch(() => false);
    if (!ok) return Alert.alert("WhatsApp", "WhatsApp is not available on this device.");
    await Linking.openURL(url);
  };

  const sendWhatsAppViaApi = async () => {
    if (!billPaid) return Alert.alert("Payment required", "Mark paid first.");
    const user = await getUser();
    if (!user?.clinic_id) return;
    try {
      await apiFetch("/api/messaging/whatsapp/send", {
        method: "POST",
        body: JSON.stringify({
          clinicId: user.clinic_id,
          patientId,
          message: billMessage,
        }),
      });
      Alert.alert("Sent", "WhatsApp queued via server (Twilio/Meta).");
    } catch (e) {
      Alert.alert("Failed", e instanceof Error ? e.message : "Unknown");
    }
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
      <Pressable
        onPress={() => void shareBill().catch((e) => Alert.alert("Share failed", String(e.message)))}
        style={[styles.btnShare, !billPaid && styles.btnShareDisabled]}
        disabled={!billId || !billPaid}
      >
        <Text style={styles.btnPayText}>{billPaid ? "Share bill (PDF)" : "Pay first — then share PDF"}</Text>
      </Pressable>

      <View style={{ height: 12 }} />
      <Pressable
        onPress={() => void openWhatsAppApp()}
        style={[styles.btnWa, !billPaid && styles.btnShareDisabled]}
        disabled={!billId || !billPaid}
      >
        <Text style={styles.btnPayText}>Open WhatsApp (patient)</Text>
      </Pressable>
      <View style={{ height: 8 }} />
      <Pressable
        onPress={() => void sendWhatsAppViaApi()}
        style={[styles.btnWaApi, !billPaid && styles.btnShareDisabled]}
        disabled={!billId || !billPaid}
      >
        <Text style={styles.btnPayText}>Send via WhatsApp API</Text>
      </Pressable>
      <Text style={styles.waHint}>
        API path uses Twilio/Meta env on the server. App button opens WhatsApp directly.
      </Text>

      <View style={{ height: 12 }} />
      <Pressable onPress={() => navigation.replace("ReceptionAppointments")} style={styles.btnDone}>
        <Text style={styles.btnPayText}>Back to queue</Text>
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
  btnShareDisabled: { opacity: 0.45 },
  btnWa: { backgroundColor: "#15803d", paddingVertical: 12, borderRadius: 12, alignItems: "center" },
  btnWaApi: { backgroundColor: "#0d9488", paddingVertical: 12, borderRadius: 12, alignItems: "center" },
  waHint: { color: "#6b7280", fontSize: 11, marginTop: 8 },
  btnDone: { backgroundColor: "#0f172a", paddingVertical: 12, borderRadius: 12, alignItems: "center", borderWidth: 1, borderColor: "#334155" },
});

