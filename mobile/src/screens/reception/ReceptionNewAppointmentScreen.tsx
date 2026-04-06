import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../navigation/AppNavigator";
import { apiFetch } from "../../api/client";
import { getUser } from "../../auth/storage";
import type { PatientDTO } from "../../types";

type Props = NativeStackScreenProps<RootStackParamList, "ReceptionNewAppointment">;

type DoctorListOk = { success: true; doctors: Array<{ id: string; name: string; role: string }> };

function digitsOnly(s: string) {
  return s.replace(/\D/g, "");
}

export default function ReceptionNewAppointmentScreen({ navigation }: Props) {
  const [query, setQuery] = useState("");
  const [patients, setPatients] = useState<PatientDTO[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<PatientDTO | null>(null);
  const [doctors, setDoctors] = useState<Array<{ id: string; name: string }>>([]);
  const [doctorId, setDoctorId] = useState<string>("");
  const [chiefComplaint, setChiefComplaint] = useState("");
  const [minutesFromNow, setMinutesFromNow] = useState("15");

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [ageYears, setAgeYears] = useState("");
  const [gender, setGender] = useState<"" | "male" | "female" | "other">("");

  const [otpSessionId, setOtpSessionId] = useState<string | null>(null);
  const [otpCode, setOtpCode] = useState("");
  const [phoneVerified, setPhoneVerified] = useState(false);

  const [bpSys, setBpSys] = useState("");
  const [bpDia, setBpDia] = useState("");
  const [heartRate, setHeartRate] = useState("");
  const [tempC, setTempC] = useState("");
  const [vitalNotes, setVitalNotes] = useState("");

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

  const sendOtp = async () => {
    const d = digitsOnly(phone);
    if (d.length < 8) return Alert.alert("Phone", "Enter a valid phone number");
    try {
      const resp = await apiFetch<{ success: true; sessionId: string }>("/api/auth/send-otp", {
        method: "POST",
        body: JSON.stringify({ contact: d, contactType: "phone" }),
      });
      setOtpSessionId(resp.sessionId);
      setPhoneVerified(false);
      Alert.alert("OTP sent", "Enter the code sent to the patient (check server logs in dev).");
    } catch (e) {
      Alert.alert("OTP failed", e instanceof Error ? e.message : "Unknown");
    }
  };

  const verifyOtp = async () => {
    if (!otpSessionId || otpCode.trim().length < 4) return Alert.alert("OTP", "Enter the 6-digit code");
    try {
      await apiFetch("/api/staff/verify-patient-phone-otp", {
        method: "POST",
        body: JSON.stringify({ sessionId: otpSessionId, otp: otpCode.trim() }),
      });
      setPhoneVerified(true);
      Alert.alert("Verified", "Phone verified — you can register this patient.");
    } catch (e) {
      Alert.alert("Verify failed", e instanceof Error ? e.message : "Unknown");
    }
  };

  const createPatientAndAppointment = async () => {
    const clinicId = await clinicIdPromise;
    if (!clinicId) return;
    if (!doctorId) return Alert.alert("Doctor", "Select a doctor");
    if (!name.trim()) return Alert.alert("Name", "Enter patient name");
    const phoneDigits = digitsOnly(phone);
    if (phoneDigits.length < 8) return Alert.alert("Phone", "Enter a valid phone");

    const y = parseInt(ageYears, 10);
    let dateOfBirth: string | undefined;
    if (ageYears.trim() && Number.isFinite(y) && y > 0 && y < 130) {
      const d = new Date();
      d.setFullYear(d.getFullYear() - y);
      dateOfBirth = d.toISOString().slice(0, 10);
    }

    try {
      let patient: PatientDTO;
      if (selectedPatient) {
        patient = selectedPatient;
      } else {
        const body: Record<string, unknown> = {
          clinicId,
          name: name.trim(),
          phone: phoneDigits,
          dateOfBirth,
          gender: gender || undefined,
          email: email.trim() || undefined,
        };
        if (otpSessionId && phoneVerified) body.otpSessionId = otpSessionId;

        const resp = await apiFetch<{ success: true; patient: PatientDTO }>("/api/patients", {
          method: "POST",
          body: JSON.stringify(body),
        });
        patient = resp.patient;
      }

      const vitalsBody: Record<string, unknown> = {};
      if (bpSys) vitalsBody.bpSystolic = Number(bpSys);
      if (bpDia) vitalsBody.bpDiastolic = Number(bpDia);
      if (heartRate) vitalsBody.heartRate = Number(heartRate);
      if (tempC) vitalsBody.temperatureC = Number(tempC);
      if (vitalNotes) vitalsBody.notes = vitalNotes;

      if (Object.keys(vitalsBody).length > 0) {
        await apiFetch(`/api/patients/${patient.id}/vitals?clinicId=${encodeURIComponent(clinicId)}`, {
          method: "POST",
          body: JSON.stringify(vitalsBody),
        });
      }

      const mins = Math.max(parseInt(minutesFromNow || "0", 10) || 0, 0);
      const appointmentTime = new Date(Date.now() + mins * 60 * 1000).toISOString();

      await apiFetch(`/api/appointments`, {
        method: "POST",
        body: JSON.stringify({
          clinicId,
          patientId: patient.id,
          doctorUserId: doctorId,
          appointmentTime,
          chiefComplaint: chiefComplaint || undefined,
        }),
      });

      Alert.alert("Done", "Patient saved — appointment queued for the doctor.");
      navigation.replace("ReceptionAppointments");
    } catch (e) {
      Alert.alert("Failed", e instanceof Error ? e.message : "Unknown error");
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <Text style={styles.h1}>New patient → intake</Text>
      <Text style={styles.hint}>OTP is optional in dev; production clinics should verify phone before first save.</Text>

      <Text style={styles.section}>1) Phone verification</Text>
      <TextInput value={phone} onChangeText={setPhone} placeholder="Phone (10+ digits)" keyboardType="phone-pad" style={styles.input} />
      <View style={styles.row}>
        <Pressable style={styles.btnSecondary} onPress={sendOtp}>
          <Text style={styles.btnSecondaryText}>Send OTP</Text>
        </Pressable>
        <TextInput
          value={otpCode}
          onChangeText={setOtpCode}
          placeholder="OTP code"
          keyboardType="number-pad"
          style={[styles.input, { flex: 1 }]}
        />
        <Pressable style={styles.btnSecondary} onPress={verifyOtp}>
          <Text style={styles.btnSecondaryText}>Verify</Text>
        </Pressable>
      </View>
      {phoneVerified ? <Text style={styles.ok}>Phone verified ✓</Text> : null}

      <Text style={styles.section}>2) Patient details</Text>
      <TextInput value={name} onChangeText={setName} placeholder="Full name" style={styles.input} />
      <TextInput value={ageYears} onChangeText={setAgeYears} placeholder="Age (years)" keyboardType="numeric" style={styles.input} />
      <View style={styles.genderRow}>
        {(["male", "female", "other"] as const).map((g) => (
          <Pressable
            key={g}
            onPress={() => setGender(g)}
            style={[styles.genderPill, gender === g && styles.genderPillOn]}
          >
            <Text style={styles.genderPillText}>{g}</Text>
          </Pressable>
        ))}
      </View>
      <TextInput value={email} onChangeText={setEmail} placeholder="Email (optional)" keyboardType="email-address" style={styles.input} />

      <Text style={styles.section}>3) Vitals (optional)</Text>
      <TextInput value={bpSys} onChangeText={setBpSys} placeholder="BP systolic" keyboardType="numeric" style={styles.input} />
      <TextInput value={bpDia} onChangeText={setBpDia} placeholder="BP diastolic" keyboardType="numeric" style={styles.input} />
      <TextInput value={heartRate} onChangeText={setHeartRate} placeholder="Heart rate" keyboardType="numeric" style={styles.input} />
      <TextInput value={tempC} onChangeText={setTempC} placeholder="Temperature °C" keyboardType="numeric" style={styles.input} />
      <TextInput value={vitalNotes} onChangeText={setVitalNotes} placeholder="Notes" style={styles.input} />

      <Text style={styles.section}>Or search existing patient</Text>
      <View style={styles.row}>
        <TextInput value={query} onChangeText={setQuery} placeholder="Name / phone" style={[styles.input, { flex: 1 }]} />
        <Pressable style={styles.btn} onPress={search}>
          <Text style={styles.btnText}>Search</Text>
        </Pressable>
      </View>
      <FlatList
        data={patients}
        keyExtractor={(p) => p.id}
        style={{ maxHeight: 140 }}
        scrollEnabled={patients.length > 3}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => {
              setSelectedPatient(item);
              setName(item.name);
              setPhone(item.phone);
            }}
            style={[styles.item, selectedPatient?.id === item.id && styles.itemSelected]}
          >
            <Text style={styles.itemTitle}>{item.name}</Text>
            <Text style={styles.itemMeta}>{item.phone}</Text>
          </Pressable>
        )}
        ListEmptyComponent={
          <Text style={{ color: "#6b7280", marginBottom: 8 }}>Search to find existing patients.</Text>
        }
      />

      <Text style={styles.section}>4) Doctor & queue</Text>
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
      <TextInput value={chiefComplaint} onChangeText={setChiefComplaint} placeholder="Chief complaint" style={styles.input} />
      <TextInput value={minutesFromNow} onChangeText={setMinutesFromNow} placeholder="Starts in (minutes)" keyboardType="numeric" style={styles.input} />

      <Pressable
        onPress={createPatientAndAppointment}
        style={styles.btnPrimary}
      >
        <Text style={styles.btnPrimaryText}>Save patient & send to doctor</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: "#0b1220" },
  h1: { color: "white", fontSize: 20, fontWeight: "900", marginBottom: 6 },
  hint: { color: "#6b7280", marginBottom: 12, fontSize: 12 },
  section: { color: "#e5e7eb", fontWeight: "800", marginTop: 14, marginBottom: 8 },
  input: { backgroundColor: "white", borderRadius: 12, padding: 12, marginBottom: 10 },
  row: { flexDirection: "row", gap: 10, alignItems: "center", marginBottom: 10 },
  btn: { backgroundColor: "#2563eb", paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12 },
  btnSecondary: { backgroundColor: "#111827", paddingVertical: 12, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: "#1f2937" },
  btnText: { color: "white", fontWeight: "800" },
  btnSecondaryText: { color: "white", fontWeight: "700", fontSize: 12 },
  ok: { color: "#4ade80", fontWeight: "700", marginBottom: 8 },
  genderRow: { flexDirection: "row", gap: 8, marginBottom: 10 },
  genderPill: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, backgroundColor: "#111827", borderWidth: 1, borderColor: "#334155" },
  genderPillOn: { borderColor: "#22c55e" },
  genderPillText: { color: "white", fontWeight: "700", textTransform: "capitalize" },
  item: { padding: 12, borderRadius: 12, backgroundColor: "#111827", marginBottom: 8, borderWidth: 1, borderColor: "#1f2937" },
  itemSelected: { borderColor: "#2563eb" },
  itemTitle: { color: "white", fontWeight: "800" },
  itemMeta: { color: "#9ca3af", marginTop: 4 },
  pill: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 999, backgroundColor: "#111827", marginRight: 10, borderWidth: 1, borderColor: "#1f2937" },
  pillSelected: { borderColor: "#22c55e" },
  pillText: { color: "white", fontWeight: "700" },
  btnPrimary: { backgroundColor: "#22c55e", paddingVertical: 16, borderRadius: 14, alignItems: "center", marginTop: 20 },
  btnPrimaryText: { color: "#052e16", fontWeight: "900" },
});
