import { useState, useEffect } from "react";
import { Plus, Loader2, Building2 } from "lucide-react";
import { apiFetch } from "@/lib/api-base";
import { useAdminAuth } from "@/context/AdminAuthContext";

interface DoctorOption {
  id: string;
  name: string;
}

interface ClinicLetterhead {
  signedUrl: string | null;
  clinicName: string;
  clinicPhone: string;
  clinicAddress: string;
}

interface PatientFormProps {
  onSuccess?: () => void;
}

export default function PatientForm({ onSuccess }: PatientFormProps) {
  const { user } = useAdminAuth();
  const clinicId = user?.clinic_id;
  const [doctors, setDoctors] = useState<DoctorOption[]>([]);
  const [doctorUserId, setDoctorUserId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [letterhead, setLetterhead] = useState<ClinicLetterhead | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    age: 0,
    phone: "",
    gender: "" as "" | "male" | "female" | "other",
    symptoms: "",
    feesPaid: 500,
    bpSystolic: "",
    bpDiastolic: "",
    heartRate: "",
  });

  // Fetch doctors
  useEffect(() => {
    if (!clinicId) return;
    (async () => {
      const res = await apiFetch(`/api/staff/doctors?clinicId=${encodeURIComponent(clinicId)}`);
      const j = await res.json();
      if (res.ok && j.success && j.doctors?.length) {
        setDoctors(j.doctors.map((d: { id: string; name: string }) => ({ id: d.id, name: d.name })));
        setDoctorUserId((prev: string) => prev || j.doctors[0].id);
      }
    })();
  }, [clinicId]);

  // Fetch clinic letterhead
  useEffect(() => {
    if (!clinicId) return;
    (async () => {
      try {
        const res = await apiFetch(
          `/api/staff/clinic/letterhead-active?clinicId=${encodeURIComponent(clinicId)}`
        );
        const j = await res.json();
        if (res.ok && j.success) {
          setLetterhead({
            signedUrl: j.letterhead?.signedUrl ?? null,
            clinicName: j.clinic?.name ?? "",
            clinicPhone: j.clinic?.phone ?? "",
            clinicAddress: j.clinic?.address ?? "",
          });
        }
      } catch {
        // Non-fatal: letterhead just won't show
      }
    })();
  }, [clinicId]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === "age" || name === "feesPaid" ? parseInt(value, 10) || 0 : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!clinicId) {
      setError("No clinic assigned to your account.");
      return;
    }
    if (!formData.name.trim() || !formData.age || !formData.phone.trim()) {
      setError("Please fill in name, age, and phone.");
      return;
    }
    if (!doctorUserId) {
      setError("Select a doctor.");
      return;
    }

    setSubmitting(true);
    try {
      const dob = new Date();
      dob.setFullYear(dob.getFullYear() - formData.age);
      const dateOfBirth = dob.toISOString().slice(0, 10);

      const pr = await apiFetch("/api/patients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clinicId,
          name: formData.name.trim(),
          phone: formData.phone.trim(),
          dateOfBirth,
          gender: formData.gender || undefined,
          medicalHistory: formData.symptoms || undefined,
        }),
      });
      const pj = await pr.json();
      if (!pr.ok) throw new Error(pj.error || "Failed to create patient");
      const patientId = pj.patient?.id;
      if (!patientId) throw new Error("Invalid patient response");

      const vitalsBody: Record<string, unknown> = {};
      if (formData.bpSystolic.trim()) {
        const n = parseInt(formData.bpSystolic, 10);
        if (Number.isFinite(n)) vitalsBody.bpSystolic = n;
      }
      if (formData.bpDiastolic.trim()) {
        const n = parseInt(formData.bpDiastolic, 10);
        if (Number.isFinite(n)) vitalsBody.bpDiastolic = n;
      }
      if (formData.heartRate.trim()) {
        const n = parseInt(formData.heartRate, 10);
        if (Number.isFinite(n)) vitalsBody.heartRate = n;
      }
      if (formData.symptoms.trim()) vitalsBody.notes = `Intake: ${formData.symptoms.trim()}`;
      if (Object.keys(vitalsBody).length > 0) {
        const vr = await apiFetch(
          `/api/patients/${patientId}/vitals?clinicId=${encodeURIComponent(clinicId)}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(vitalsBody),
          }
        );
        const vj = await vr.json().catch(() => ({}));
        if (!vr.ok) throw new Error((vj as { error?: string }).error || "Failed to save vitals");
      }

      const now = new Date().toISOString();
      const ar = await apiFetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clinicId,
          patientId,
          doctorUserId,
          appointmentTime: now,
          chiefComplaint: formData.symptoms || undefined,
        }),
      });
      const aj = await ar.json();
      if (!ar.ok) throw new Error(aj.error || "Failed to create appointment");
      const appointmentId = aj.appointment?.id;
      if (!appointmentId) throw new Error("Invalid appointment response");

      const cr = await apiFetch(`/api/appointments/${appointmentId}/checkin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chiefComplaint: formData.symptoms || undefined,
          vitals: {
            bp_sys: (() => {
              const n = parseInt(formData.bpSystolic, 10);
              return formData.bpSystolic.trim() && Number.isFinite(n) ? n : undefined;
            })(),
            bp_dia: (() => {
              const n = parseInt(formData.bpDiastolic, 10);
              return formData.bpDiastolic.trim() && Number.isFinite(n) ? n : undefined;
            })(),
            heart_rate: (() => {
              const n = parseInt(formData.heartRate, 10);
              return formData.heartRate.trim() && Number.isFinite(n) ? n : undefined;
            })(),
          },
        }),
      });
      const cj = await cr.json();
      if (!cr.ok) throw new Error(cj.error || "Failed to check in");

      const br = await apiFetch("/api/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clinicId,
          appointmentId,
          patientId,
          consultationFee: formData.feesPaid,
          medicineCost: 0,
        }),
      });
      const bj = await br.json();
      if (!br.ok) throw new Error(bj.error || "Failed to create bill");

      setFormData({
        name: "",
        age: 0,
        phone: "",
        gender: "",
        symptoms: "",
        feesPaid: 500,
        bpSystolic: "",
        bpDiastolic: "",
        heartRate: "",
      });
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* ── Letterhead Header ── */}
      {letterhead?.signedUrl ? (
        <div className="relative w-full">
          <img
            src={letterhead.signedUrl}
            alt="Clinic letterhead"
            className="w-full object-cover max-h-40"
          />
          {/* Overlay patient slip label */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent px-4 py-2">
            <p className="text-white text-xs font-semibold tracking-wide">PATIENT INTAKE SLIP</p>
          </div>
        </div>
      ) : (
        <div className="bg-gradient-to-r from-blue-700 to-blue-900 px-6 py-4 flex items-center gap-3">
          <Building2 className="w-8 h-8 text-white/80 shrink-0" />
          <div>
            <p className="text-white font-bold text-base leading-tight">
              {letterhead?.clinicName || "Clinic"}
            </p>
            {letterhead?.clinicAddress && (
              <p className="text-white/80 text-xs">{letterhead.clinicAddress}</p>
            )}
            {letterhead?.clinicPhone && (
              <p className="text-white/80 text-xs">{letterhead.clinicPhone}</p>
            )}
          </div>
          <div className="ml-auto text-right">
            <p className="text-white/70 text-xs">PATIENT INTAKE SLIP</p>
            <p className="text-white text-xs">{new Date().toLocaleDateString("en-IN")}</p>
          </div>
        </div>
      )}

      {/* ── Form Body ── */}
      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        <h3 className="text-base font-bold text-gray-900">Patient Details</h3>

        {error && (
          <div className="p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Doctor *</label>
          <select
            value={doctorUserId}
            onChange={(e) => setDoctorUserId(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            required
          >
            <option value="">Select doctor</option>
            {doctors.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>

        {/* Patient name + phone */}
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="block text-sm font-semibold text-gray-700 mb-1">Patient Name *</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="Full name"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Age *</label>
            <input
              type="number"
              name="age"
              value={formData.age || ""}
              onChange={handleChange}
              placeholder="Years"
              min={0}
              max={120}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Sex *</label>
            <select
              name="gender"
              value={formData.gender}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            >
              <option value="">Select</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Phone *</label>
          <input
            type="tel"
            name="phone"
            value={formData.phone}
            onChange={handleChange}
            placeholder="+91 XXXXX XXXXX"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            required
          />
        </div>

        {/* Chief complaint — the key field */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Chief Complaint / Disease Problem *
          </label>
          <textarea
            name="symptoms"
            value={formData.symptoms}
            onChange={handleChange}
            placeholder="Describe the patient's main complaint or disease (e.g. fever 3 days, headache, chest pain…)"
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm resize-none"
          />
        </div>

        {/* Vitals */}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">BP Systolic</label>
            <input
              type="number"
              name="bpSystolic"
              value={formData.bpSystolic}
              onChange={handleChange}
              placeholder="120"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">BP Diastolic</label>
            <input
              type="number"
              name="bpDiastolic"
              value={formData.bpDiastolic}
              onChange={handleChange}
              placeholder="80"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Heart Rate</label>
            <input
              type="number"
              name="heartRate"
              value={formData.heartRate}
              onChange={handleChange}
              placeholder="bpm"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Consultation Fee (₹)</label>
          <input
            type="number"
            name="feesPaid"
            value={formData.feesPaid}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-lg font-semibold transition-colors flex items-center justify-center gap-2 text-sm"
        >
          {submitting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Saving…
            </>
          ) : (
            <>
              <Plus className="w-5 h-5" />
              Send to Doctor's Queue
            </>
          )}
        </button>
      </form>
    </div>
  );
}
