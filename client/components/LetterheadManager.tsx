import { useState } from "react";
import { useClinic } from "@/context/ClinicContext";
import { Plus, Trash2, Edit2, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

export default function LetterheadManager() {
  const { letterheads, addLetterhead, deleteLetterhead, doctors } = useClinic();
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    clinicName: "",
    clinicAddress: "",
    clinicPhone: "",
    doctorName: "",
    registrationNumber: "",
    specialization: "",
    templateUrl: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
  });

  const gradients = [
    { name: "Blue Purple", value: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" },
    { name: "Green Teal", value: "linear-gradient(135deg, #11998e 0%, #38ef7d 100%)" },
    { name: "Orange Red", value: "linear-gradient(135deg, #ff6b6b 0%, #feca57 100%)" },
    { name: "Pink Blue", value: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)" },
    { name: "Purple Pink", value: "linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)" },
    { name: "Light Gray", value: "linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)" },
  ];

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.clinicName.trim()) {
      alert("Please fill in name and clinic name");
      return;
    }

    addLetterhead({
      name: formData.name,
      templateUrl: formData.templateUrl,
      clinicName: formData.clinicName,
      clinicAddress: formData.clinicAddress,
      clinicPhone: formData.clinicPhone,
      doctorName: formData.doctorName,
      registrationNumber: formData.registrationNumber,
      specialization: formData.specialization,
      isDefault: false,
    });

    setFormData({
      name: "",
      clinicName: "",
      clinicAddress: "",
      clinicPhone: "",
      doctorName: "",
      registrationNumber: "",
      specialization: "",
      templateUrl: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    });
    setShowAddForm(false);
  };

  return (
    <div className="space-y-6">
      {/* Add Button */}
      {!showAddForm && (
        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors"
        >
          <Plus className="w-5 h-5" />
          Create New Letterhead
        </button>
      )}

      {/* Add Form */}
      {showAddForm && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Create New Letterhead</h3>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Template Name *
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                placeholder="e.g., Classic Blue, Professional Green"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>

            {/* Clinic Info */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Clinic Name *
                </label>
                <input
                  type="text"
                  name="clinicName"
                  value={formData.clinicName}
                  onChange={handleInputChange}
                  placeholder="Your clinic name"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Address
                </label>
                <input
                  type="text"
                  name="clinicAddress"
                  value={formData.clinicAddress}
                  onChange={handleInputChange}
                  placeholder="Clinic address"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Phone & Doctor Info */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Phone
                </label>
                <input
                  type="tel"
                  name="clinicPhone"
                  value={formData.clinicPhone}
                  onChange={handleInputChange}
                  placeholder="+91 XXXXX XXXXX"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Doctor Name
                </label>
                <input
                  type="text"
                  name="doctorName"
                  value={formData.doctorName}
                  onChange={handleInputChange}
                  placeholder="Dr. Name"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Professional Details */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Registration Number
                </label>
                <input
                  type="text"
                  name="registrationNumber"
                  value={formData.registrationNumber}
                  onChange={handleInputChange}
                  placeholder="IMC/XXXX/XXXXX"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Specialization
                </label>
                <input
                  type="text"
                  name="specialization"
                  value={formData.specialization}
                  onChange={handleInputChange}
                  placeholder="e.g., General Medicine"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Color Selection */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                Letterhead Color Theme
              </label>
              <div className="grid grid-cols-3 gap-3">
                {gradients.map((gradient) => (
                  <button
                    key={gradient.value}
                    onClick={() =>
                      setFormData((prev) => ({
                        ...prev,
                        templateUrl: gradient.value,
                      }))
                    }
                    type="button"
                    className={cn(
                      "h-20 rounded-lg border-2 transition-all flex items-center justify-center font-semibold text-white text-xs text-center p-2",
                      formData.templateUrl === gradient.value
                        ? "border-blue-600 ring-2 ring-blue-400"
                        : "border-gray-300 hover:border-gray-400"
                    )}
                    style={{ background: gradient.value }}
                  >
                    {gradient.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Preview */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Preview
              </label>
              <div
                className="h-32 rounded-lg border-2 border-gray-200 p-4 text-white flex items-center justify-center"
                style={{ background: formData.templateUrl }}
              >
                <div className="text-center">
                  <p className="font-bold">{formData.clinicName || "Clinic Name"}</p>
                  <p className="text-xs opacity-90">
                    {formData.doctorName || "Dr. Name"}
                  </p>
                </div>
              </div>
            </div>

            {/* Submit Buttons */}
            <div className="flex gap-3">
              <button
                type="submit"
                className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors"
              >
                Create Letterhead
              </button>
              <button
                onClick={() => setShowAddForm(false)}
                type="button"
                className="flex-1 py-2 bg-gray-300 hover:bg-gray-400 text-gray-800 rounded-lg font-semibold transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Letterheads List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {letterheads.map((letterhead) => (
          <div
            key={letterhead.id}
            className="border border-gray-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all"
          >
            {/* Preview */}
            <div
              className="h-40 bg-cover bg-center relative flex items-end justify-between p-4"
              style={{ background: letterhead.templateUrl }}
            >
              <div className="absolute inset-0 bg-black/20"></div>
              <div className="relative z-10 text-white">
                <h4 className="font-bold text-sm">{letterhead.name}</h4>
                <p className="text-xs opacity-90">{letterhead.clinicName}</p>
              </div>
              {letterhead.isDefault && (
                <div className="relative z-10 bg-green-500 text-white text-xs font-semibold px-2 py-1 rounded">
                  Default
                </div>
              )}
            </div>

            {/* Details */}
            <div className="p-4 space-y-2 bg-white">
              <p className="text-xs text-gray-600">
                <span className="font-semibold">Doctor:</span>{" "}
                {letterhead.doctorName || "Not assigned"}
              </p>
              <p className="text-xs text-gray-600">
                <span className="font-semibold">Address:</span>{" "}
                {letterhead.clinicAddress}
              </p>
              {letterhead.registrationNumber && (
                <p className="text-xs text-gray-600">
                  <span className="font-semibold">Reg:</span>{" "}
                  {letterhead.registrationNumber}
                </p>
              )}

              {/* Assign to Doctor */}
              <div className="pt-2 border-t border-gray-100">
                <p className="text-xs font-semibold text-gray-700 mb-2">
                  Assigned to:
                </p>
                <select className="w-full text-xs px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Select Doctor</option>
                  {doctors.map((doctor) => (
                    <option key={doctor.id} value={doctor.id}>
                      {doctor.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-3">
                <button className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors text-xs font-semibold">
                  <Copy className="w-4 h-4" />
                  Duplicate
                </button>
                <button
                  onClick={() => deleteLetterhead(letterhead.id)}
                  className="px-3 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
