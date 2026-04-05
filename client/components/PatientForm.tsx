import { useState, useEffect } from "react";
import { Plus, Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/api-base";
import { useAdminAuth } from "@/context/AdminAuthContext";

interface DoctorOption {
  id: string;
  name: string;
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
    <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
      <h3 className="text-lg font-bold text-gray-900 mb-4">Add New Patient</h3>

      {error && (
        <div className="mb-4 p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg">
          {error}
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Doctor *</label>
          <select
            value={doctorUserId}
            onChange={(e) => setDoctorUserId(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Patient Name *
          </label>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleChange}
            placeholder="Enter full name"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Age *
            </label>
            <input
              type="number"
              name="age"
              value={formData.age}
              onChange={handleChange}
              placeholder="Years"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Phone *
            </label>
            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              placeholder="+91 XXXXX XXXXX"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Gender (optional)</label>
          <select
            name="gender"
            value={formData.gender}
            onChange={handleChange}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Prefer not to say</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">BP systolic</label>
            <input
              type="number"
              name="bpSystolic"
              value={formData.bpSystolic}
              onChange={handleChange}
              placeholder="e.g. 120"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">BP diastolic</label>
            <input
              type="number"
              name="bpDiastolic"
              value={formData.bpDiastolic}
              onChange={handleChange}
              placeholder="e.g. 80"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Heart rate</label>
            <input
              type="number"
              name="heartRate"
              value={formData.heartRate}
              onChange={handleChange}
              placeholder="bpm"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Symptoms / chief complaint
          </label>
          <textarea
            name="symptoms"
            value={formData.symptoms}
            onChange={handleChange}
            placeholder="Chief complaints and symptoms"
            rows={3}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Consultation Fee (₹)
          </label>
          <input
            type="number"
            name="feesPaid"
            value={formData.feesPaid}
            onChange={handleChange}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
        >
          {submitting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Saving…
            </>
          ) : (
            <>
              <Plus className="w-5 h-5" />
              Add to Queue
            </>
          )}
        </button>
      </div>
    </form>
  );
}
