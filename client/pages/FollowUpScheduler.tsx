import { useState, useEffect } from "react";
import { useAdminAuth } from "@/context/AdminAuthContext";
import {
  Calendar,
  Clock,
  User,
  MessageSquare,
  Plus,
  Loader,
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  Bell,
  Smartphone,
  Mail,
  Trash2,
  Edit2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { apiErrorMessage, apiFetch } from "@/lib/api-base";

interface FollowUp {
  id: string;
  patientId: string;
  doctorId: string;
  scheduledDate: string;
  notes: string;
  status: "scheduled" | "reminded" | "completed" | "cancelled";
  notificationChannel: "whatsapp" | "sms" | "email";
}

interface FollowUpFormData {
  patientId: string;
  doctorId: string;
  clinicId: string;
  scheduledDate: string;
  scheduledTime: string;
  notes: string;
  notificationChannel: "whatsapp" | "sms" | "email";
  reminderMinutesBefore: number;
}

export default function FollowUpScheduler() {
  const { user } = useAdminAuth();
  const currentClinicId = user?.clinic_id ?? "";
  const [upcomingFollowUps, setUpcomingFollowUps] = useState<FollowUp[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formData, setFormData] = useState<FollowUpFormData>({
    patientId: "",
    doctorId: user?.id ?? "",
    clinicId: currentClinicId,
    scheduledDate: "",
    scheduledTime: "10:00",
    notes: "",
    notificationChannel: "whatsapp",
    reminderMinutesBefore: 60,
  });

  useEffect(() => {
    fetchUpcomingFollowUps();
  }, [currentClinicId]);

  useEffect(() => {
    setFormData((prev) => ({
      ...prev,
      clinicId: currentClinicId,
      doctorId: prev.doctorId || user?.id || "",
    }));
  }, [currentClinicId, user?.id]);

  const fetchUpcomingFollowUps = async () => {
    try {
      if (!currentClinicId) return;

      const qs = new URLSearchParams({ clinicId: currentClinicId });
      const response = await apiFetch(`/api/followups/upcoming?${qs.toString()}`);
      const data = await response.json().catch(() => ({}));
      if (data.success) {
        setUpcomingFollowUps(data.followUps);
      } else if (!response.ok) {
        setError(apiErrorMessage(data) || "Failed to load follow-ups");
      }
    } catch (err) {
      console.error("Failed to fetch follow-ups:", err);
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === "reminderMinutesBefore" ? Number(value) : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (!currentClinicId) throw new Error("Clinic is required");

      if (!formData.patientId.trim()) {
        setError("Patient ID is required");
        return;
      }

      if (!formData.doctorId.trim()) {
        setError("Doctor ID is required");
        return;
      }

      if (!formData.scheduledDate) {
        setError("Scheduled date is required");
        return;
      }

      // Combine date and time
      const [year, month, day] = formData.scheduledDate.split("-");
      const [hours, minutes] = formData.scheduledTime.split(":");
      const scheduledDateTime = new Date(
        parseInt(year),
        parseInt(month) - 1,
        parseInt(day),
        parseInt(hours),
        parseInt(minutes)
      ).toISOString();

      const endpoint = editingId ? `/api/followups/${editingId}` : "/api/followups/schedule";

      const method = editingId ? "PUT" : "POST";

      const response = await apiFetch(endpoint, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          patientId: formData.patientId,
          doctorId: formData.doctorId,
          clinicId: formData.clinicId,
          scheduledDate: scheduledDateTime,
          notes: formData.notes,
          notificationChannel: formData.notificationChannel,
          reminderMinutesBefore: formData.reminderMinutesBefore,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (data.success) {
        setSuccessMessage(
          editingId ? "Follow-up updated successfully" : "Follow-up scheduled successfully"
        );
        setShowForm(false);
        setEditingId(null);
        setFormData({
          patientId: "",
          doctorId: user?.id ?? "",
          clinicId: currentClinicId,
          scheduledDate: "",
          scheduledTime: "10:00",
          notes: "",
          notificationChannel: "whatsapp",
          reminderMinutesBefore: 60,
        });
        fetchUpcomingFollowUps();
        setTimeout(() => setSuccessMessage(null), 3000);
      } else {
        setError(apiErrorMessage(data) || "Failed to schedule follow-up");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to schedule follow-up");
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (followUp: FollowUp) => {
    const date = new Date(followUp.scheduledDate);
    const dateStr = date.toISOString().split("T")[0];
    const timeStr = `${String(date.getHours()).padStart(2, "0")}:${String(
      date.getMinutes()
    ).padStart(2, "0")}`;

    setFormData({
      patientId: followUp.patientId,
      doctorId: followUp.doctorId,
      clinicId: currentClinicId,
      scheduledDate: dateStr,
      scheduledTime: timeStr,
      notes: followUp.notes,
      notificationChannel: followUp.notificationChannel,
      reminderMinutesBefore: 60,
    });
    setEditingId(followUp.id);
    setShowForm(true);
  };

  const handleCompleteFollowUp = async (followUpId: string) => {
    try {
      const response = await apiFetch(`/api/followups/${followUpId}/complete`, {
        method: "PUT",
      });

      const data = await response.json().catch(() => ({}));
      if (data.success) {
        setSuccessMessage("Follow-up marked as completed");
        fetchUpcomingFollowUps();
        setTimeout(() => setSuccessMessage(null), 3000);
      }
    } catch (err) {
      setError("Failed to complete follow-up");
    }
  };

  const getNotificationIcon = (channel: string) => {
    switch (channel) {
      case "whatsapp":
        return <Smartphone className="w-4 h-4" />;
      case "sms":
        return <MessageSquare className="w-4 h-4" />;
      case "email":
        return <Mail className="w-4 h-4" />;
      default:
        return <Bell className="w-4 h-4" />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">Follow-up Scheduler</h1>
            <p className="text-gray-600">Schedule and manage patient follow-ups</p>
          </div>
          <button
            onClick={() => {
              setShowForm(!showForm);
              setEditingId(null);
              setFormData({
                patientId: "",
                doctorId: user?.id ?? "",
                clinicId: currentClinicId,
                scheduledDate: "",
                scheduledTime: "10:00",
                notes: "",
                notificationChannel: "whatsapp",
                reminderMinutesBefore: 60,
              });
            }}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
          >
            <Plus className="w-5 h-5" />
            Schedule Follow-up
          </button>
        </div>

        {/* Messages */}
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 flex gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {successMessage && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-700 flex gap-3">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Form */}
        {showForm && (
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">
                {editingId ? "Edit Follow-up" : "Schedule New Follow-up"}
              </h2>
              <button
                onClick={() => {
                  setShowForm(false);
                  setEditingId(null);
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ChevronLeft className="w-5 h-5 text-gray-600" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Patient ID */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Patient ID *
                  </label>
                  <input
                    type="text"
                    name="patientId"
                    value={formData.patientId}
                    onChange={handleInputChange}
                    placeholder="Enter patient ID"
                    disabled={!!editingId}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 disabled:bg-gray-100"
                  />
                </div>

                {/* Doctor ID */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Doctor ID *
                  </label>
                  <input
                    type="text"
                    name="doctorId"
                    value={formData.doctorId}
                    onChange={handleInputChange}
                    placeholder="Enter doctor ID"
                    disabled={!!editingId}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 disabled:bg-gray-100"
                  />
                </div>

                {/* Date */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Date *
                  </label>
                  <input
                    type="date"
                    name="scheduledDate"
                    value={formData.scheduledDate}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                  />
                </div>

                {/* Time */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Time</label>
                  <input
                    type="time"
                    name="scheduledTime"
                    value={formData.scheduledTime}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                  />
                </div>

                {/* Notification Channel */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Notification Channel
                  </label>
                  <select
                    name="notificationChannel"
                    value={formData.notificationChannel}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                  >
                    <option value="whatsapp">WhatsApp</option>
                    <option value="sms">SMS</option>
                    <option value="email">Email</option>
                  </select>
                </div>

                {/* Reminder Minutes */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Reminder (minutes before)
                  </label>
                  <input
                    type="number"
                    name="reminderMinutesBefore"
                    value={formData.reminderMinutesBefore}
                    onChange={handleInputChange}
                    min="0"
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Notes</label>
                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleInputChange}
                  placeholder="Add any notes about this follow-up..."
                  rows={4}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 resize-none"
                />
              </div>

              {/* Buttons */}
              <div className="flex gap-4">
                <button
                  type="submit"
                  disabled={loading}
                  className={cn(
                    "flex-1 py-3 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2",
                    loading
                      ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                      : "bg-blue-600 hover:bg-blue-700 text-white cursor-pointer"
                  )}
                >
                  {loading ? (
                    <>
                      <Loader className="w-5 h-5 animate-spin" />
                      {editingId ? "Updating..." : "Scheduling..."}
                    </>
                  ) : (
                    <>
                      <Calendar className="w-5 h-5" />
                      {editingId ? "Update Follow-up" : "Schedule Follow-up"}
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setEditingId(null);
                  }}
                  className="px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-semibold transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Upcoming Follow-ups */}
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Upcoming Follow-ups</h2>
          {upcomingFollowUps.length === 0 ? (
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-8 text-center">
              <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No upcoming follow-ups scheduled</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {upcomingFollowUps.map((followUp) => (
                <div
                  key={followUp.id}
                  className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 hover:shadow-md transition-shadow"
                >
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {/* Patient Info */}
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Patient ID</p>
                      <p className="font-semibold text-gray-900">{followUp.patientId}</p>
                    </div>

                    {/* Doctor Info */}
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Doctor ID</p>
                      <p className="font-semibold text-gray-900">{followUp.doctorId}</p>
                    </div>

                    {/* Date & Time */}
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Scheduled Date & Time</p>
                      <p className="font-semibold text-gray-900">
                        {new Date(followUp.scheduledDate).toLocaleDateString()} at{" "}
                        {new Date(followUp.scheduledDate).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>

                    {/* Notification */}
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Notification</p>
                      <div className="flex items-center gap-2">
                        {getNotificationIcon(followUp.notificationChannel)}
                        <span className="font-semibold capitalize">
                          {followUp.notificationChannel}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Notes */}
                  {followUp.notes && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <p className="text-sm text-gray-600 mb-1">Notes</p>
                      <p className="text-gray-700">{followUp.notes}</p>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="mt-4 pt-4 border-t border-gray-200 flex gap-2">
                    <button
                      onClick={() => handleEdit(followUp)}
                      className="flex items-center gap-2 px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors font-semibold"
                    >
                      <Edit2 className="w-4 h-4" />
                      Edit
                    </button>
                    <button
                      onClick={() => handleCompleteFollowUp(followUp.id)}
                      className="flex items-center gap-2 px-4 py-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors font-semibold"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Complete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
