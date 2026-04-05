import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../navigation/AppNavigator";
import { apiFetch } from "../../api/client";
import { getUser } from "../../auth/storage";
import HandwritingPad, { type StrokePayload, strokesToSvgString } from "../../components/HandwritingPad";
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

  const [letterheadUrl, setLetterheadUrl] = useState<string | null>(null);
  const [patientName, setPatientName] = useState(`Patient ${patientId.slice(0, 8)}`);
  const [strokes, setStrokes] = useState<StrokePayload>({ version: 1, lines: [] });

  const [suggestQ, setSuggestQ] = useState("");
  const [suggestions, setSuggestions] = useState<Array<{ name: string; strength?: string | null }>>([]);

  const [transcript, setTranscript] = useState("");
  const [recordingConsent, setRecordingConsent] = useState(false);
  const [aiSummaryText, setAiSummaryText] = useState("");

  const loadContext = useCallback(async () => {
    const user = await getUser();
    if (!user?.clinic_id) return;
    try {
      const lh = await apiFetch<{
        success: true;
        letterhead: { signedUrl: string | null };
      }>(`/api/staff/clinic/letterhead-active?clinicId=${encodeURIComponent(user.clinic_id)}`);
      setLetterheadUrl(lh.letterhead?.signedUrl ?? null);
    } catch {
      setLetterheadUrl(null);
    }
    try {
      const pr = await apiFetch<{ success: true; patient: { name: string } }>(
        `/api/patients/${patientId}?clinicId=${encodeURIComponent(user.clinic_id)}`
      );
      setPatientName(pr.patient.name);
    } catch {
      /* keep fallback */
    }
  }, [patientId]);

  useEffect(() => {
    void loadContext();
  }, [loadContext]);

  const runSuggest = async () => {
    if (!suggestQ.trim()) return;
    const json = await apiFetch<{ success: true; suggestions: Array<{ name: string; strength?: string | null }> }>(
      "/api/ai/medication-suggest",
      { method: "POST", body: JSON.stringify({ query: suggestQ.trim(), limit: 12 }) }
    );
    setSuggestions(json.suggestions || []);
  };

  const runSummary = async () => {
    if (!recordingConsent) {
      Alert.alert("Consent required", "Enable recording consent to generate a draft summary.");
      return;
    }
    if (transcript.trim().length < 3) {
      Alert.alert("Transcript", "Enter a short transcript or notes first.");
      return;
    }
    const json = await apiFetch<{ success: true; summary: { plan: string; chiefComplaint: string; history: string } }>(
      "/api/ai/consultation-summary",
      {
        method: "POST",
        body: JSON.stringify({ transcript: transcript.trim(), recordingConsent: true as const }),
      }
    );
    const block = [json.summary.chiefComplaint, json.summary.plan].filter(Boolean).join(" — ");
    setAiSummaryText(block);
  };

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

    const handwritingStrokes = strokes.lines.length > 0 ? strokes : undefined;

    await apiFetch("/api/consultations/complete", {
      method: "POST",
      body: JSON.stringify({
        clinicId: user.clinic_id,
        appointmentId,
        patientId,
        diagnosis: diagnosis || undefined,
        treatmentPlan: treatmentPlan || undefined,
        notes: notes || undefined,
        handwritingStrokes,
        aiTranscript: transcript.trim() || undefined,
        aiSummary: aiSummaryText || undefined,
        recordingConsent,
        prescription: {
          followUpDate,
          items: rxItems,
        },
      }),
    });

    Alert.alert("Completed", "Consultation saved — awaiting payment at reception.");
    navigation.replace("DoctorQueue");
  };

  const shareRx = async () => {
    const user = await getUser();
    const topParts: string[] = [];
    if (letterheadUrl) {
      topParts.push(
        `<div style="margin-bottom:12px;"><img src="${letterheadUrl}" style="width:100%;max-height:220px;object-fit:contain;" alt="letterhead" /></div>`
      );
    }
    if (strokes.lines.length > 0) {
      topParts.push(`<div style="margin-bottom:12px;">${strokesToSvgString(strokes)}</div>`);
    }
    const html = prescriptionHtml({
      clinicName: "Clinic",
      doctorName: user?.name || "Doctor",
      patientName,
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
      topHtml: topParts.join(""),
      aiSummary: aiSummaryText || undefined,
    });
    await shareHtmlAsPdf({ title: "Prescription", html });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 32 }}>
      <Text style={styles.title}>Consultation</Text>
      <Text style={styles.meta}>Appointment: {appointmentId}</Text>

      <Text style={styles.section}>Letterhead & handwriting</Text>
      <View style={styles.letterWrap}>
        {letterheadUrl ? (
          <Image source={{ uri: letterheadUrl }} style={styles.letterImg} resizeMode="contain" />
        ) : (
          <Text style={styles.hint}>No letterhead uploaded for this clinic yet.</Text>
        )}
        <View style={styles.padOverlay}>
          <HandwritingPad onChange={setStrokes} />
        </View>
      </View>

      <Text style={styles.section}>Clinical notes</Text>
      <TextInput value={diagnosis} onChangeText={setDiagnosis} placeholder="Diagnosis" style={styles.input} />
      <TextInput value={treatmentPlan} onChangeText={setTreatmentPlan} placeholder="Treatment plan" style={styles.input} />
      <TextInput value={notes} onChangeText={setNotes} placeholder="Notes" style={styles.input} />

      <Text style={styles.section}>Formulary suggest</Text>
      <View style={styles.row}>
        <TextInput
          value={suggestQ}
          onChangeText={setSuggestQ}
          placeholder="Search drug…"
          style={[styles.input, { flex: 1 }]}
        />
        <Pressable onPress={() => void runSuggest().catch((e) => Alert.alert("Suggest failed", String(e.message)))} style={styles.btnSm}>
          <Text style={styles.btnSmText}>Go</Text>
        </Pressable>
      </View>
      {suggestions.slice(0, 6).map((s) => (
        <Pressable
          key={s.name + (s.strength || "")}
          style={styles.sug}
          onPress={() => {
            setMedName(s.name);
            if (s.strength) setMedDosage(s.strength);
          }}
        >
          <Text style={styles.sugText}>
            {s.name}
            {s.strength ? ` · ${s.strength}` : ""}
          </Text>
        </Pressable>
      ))}

      <Text style={styles.section}>AI summary (consent-gated)</Text>
      <TextInput
        value={transcript}
        onChangeText={setTranscript}
        placeholder="Paste conversation / exam notes for draft summary"
        style={[styles.input, { minHeight: 72 }]}
        multiline
      />
      <View style={styles.consentRow}>
        <Text style={styles.consentLabel}>Recording / summary consent</Text>
        <Switch value={recordingConsent} onValueChange={setRecordingConsent} />
      </View>
      <Pressable
        onPress={() => void runSummary().catch((e) => Alert.alert("Summary failed", String(e.message)))}
        style={styles.btnSecondary}
      >
        <Text style={styles.btnSecondaryText}>Generate draft summary</Text>
      </Pressable>
      {aiSummaryText ? <Text style={styles.summaryOut}>{aiSummaryText}</Text> : null}

      <Text style={styles.section}>Prescription</Text>
      <TextInput value={medName} onChangeText={setMedName} placeholder="Medicine name" style={styles.input} />
      <TextInput value={medDosage} onChangeText={setMedDosage} placeholder="Dosage" style={styles.input} />
      <TextInput value={medFreq} onChangeText={setMedFreq} placeholder="Frequency" style={styles.input} />
      <TextInput value={medDuration} onChangeText={setMedDuration} placeholder="Duration" style={styles.input} />
      <TextInput value={medQty} onChangeText={setMedQty} keyboardType="numeric" placeholder="Quantity" style={styles.input} />

      <Pressable onPress={() => void complete().catch((e) => Alert.alert("Failed", String(e.message)))} style={styles.btn}>
        <Text style={styles.btnText}>Complete consultation</Text>
      </Pressable>

      <View style={{ height: 12 }} />
      <Pressable onPress={() => void shareRx().catch((e) => Alert.alert("Print failed", String(e.message)))} style={styles.btnSecondary}>
        <Text style={styles.btnSecondaryText}>Share prescription (PDF)</Text>
      </Pressable>
    </ScrollView>
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
  letterWrap: { position: "relative", minHeight: 220, marginBottom: 8 },
  letterImg: { width: "100%", height: 200, opacity: 0.35 },
  padOverlay: { position: "absolute", left: 0, right: 0, top: 0 },
  hint: { color: "#6b7280", marginBottom: 8 },
  row: { flexDirection: "row", gap: 8, alignItems: "center" },
  btnSm: { backgroundColor: "#2563eb", paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12 },
  btnSmText: { color: "white", fontWeight: "800" },
  sug: { paddingVertical: 8, paddingHorizontal: 10, borderRadius: 10, backgroundColor: "#111827", marginBottom: 6 },
  sugText: { color: "#e2e8f0", fontSize: 13 },
  consentRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  consentLabel: { color: "#cbd5e1", flex: 1, paddingRight: 12 },
  summaryOut: { color: "#a7f3d0", marginTop: 8, marginBottom: 8 },
});
