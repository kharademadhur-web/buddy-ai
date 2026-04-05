import { useState } from "react";
import { Building2, Phone, Mail, MapPin, FileText, Edit2, Save, X } from "lucide-react";

interface ClinicInfo {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  registrationNumber?: string | null;
  doctorsAllowed?: number | null;
  receptionAllowed?: number | null;
}

interface ClinicInfoCardProps {
  clinic: ClinicInfo;
  onUpdate?: (clinic: ClinicInfo) => void;
}

export default function ClinicInfoCard({ clinic, onUpdate }: ClinicInfoCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<ClinicInfo>({
    ...clinic,
    phone: clinic.phone ?? "",
    email: clinic.email ?? "",
    address: clinic.address ?? "",
    registrationNumber: clinic.registrationNumber ?? "",
    doctorsAllowed: clinic.doctorsAllowed ?? 0,
    receptionAllowed: clinic.receptionAllowed ?? 0,
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSave = () => {
    onUpdate?.(formData);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setFormData({
      ...clinic,
      phone: clinic.phone ?? "",
      email: clinic.email ?? "",
      address: clinic.address ?? "",
      registrationNumber: clinic.registrationNumber ?? "",
      doctorsAllowed: clinic.doctorsAllowed ?? 0,
      receptionAllowed: clinic.receptionAllowed ?? 0,
    });
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Edit Clinic Information</h2>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Clinic Name
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Phone
              </label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Email
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Address
            </label>
            <textarea
              name="address"
              value={formData.address}
              onChange={handleChange}
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Registration Number
              </label>
              <input
                type="text"
                name="registrationNumber"
                value={formData.registrationNumber}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-6 border-t border-gray-200">
            <button
              onClick={handleSave}
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <Save className="w-4 h-4" />
              Save Changes
            </button>
            <button
              onClick={handleCancel}
              className="flex-1 px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-900 font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <X className="w-4 h-4" />
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-start gap-4">
          <div className="bg-blue-100 rounded-lg p-4">
            <Building2 className="w-8 h-8 text-blue-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{formData.name}</h2>
            <p className="text-sm text-gray-600 mt-1">Clinic ID: {formData.id}</p>
          </div>
        </div>
        <button
          onClick={() => setIsEditing(true)}
          className="flex items-center gap-2 px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-lg font-semibold transition-colors"
        >
          <Edit2 className="w-4 h-4" />
          Edit
        </button>
      </div>

      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-6">
          <div className="flex items-start gap-3">
            <Phone className="w-5 h-5 text-gray-400 mt-1 flex-shrink-0" />
            <div>
              <p className="text-xs text-gray-600 font-semibold uppercase">Phone</p>
              <p className="text-sm font-semibold text-gray-900 mt-1">{formData.phone}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Mail className="w-5 h-5 text-gray-400 mt-1 flex-shrink-0" />
            <div>
              <p className="text-xs text-gray-600 font-semibold uppercase">Email</p>
              <p className="text-sm font-semibold text-gray-900 mt-1">{formData.email}</p>
            </div>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <MapPin className="w-5 h-5 text-gray-400 mt-1 flex-shrink-0" />
          <div>
            <p className="text-xs text-gray-600 font-semibold uppercase">Address</p>
            <p className="text-sm font-semibold text-gray-900 mt-1">{formData.address}</p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <FileText className="w-5 h-5 text-gray-400 mt-1 flex-shrink-0" />
          <div>
            <p className="text-xs text-gray-600 font-semibold uppercase">Registration Number</p>
            <p className="text-sm font-semibold text-gray-900 mt-1">{formData.registrationNumber}</p>
          </div>
        </div>

        <div className="pt-4 border-t border-gray-200">
          <h3 className="font-semibold text-gray-900 mb-4">Subscription Limits</h3>
          <div className="grid grid-cols-2 gap-6">
            <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
              <p className="text-xs text-blue-600 font-semibold uppercase mb-2">Doctors Allowed</p>
              <p className="text-3xl font-bold text-blue-900">{formData.doctorsAllowed}</p>
            </div>
            <div className="bg-green-50 rounded-lg p-4 border border-green-200">
              <p className="text-xs text-green-600 font-semibold uppercase mb-2">Receptionists Allowed</p>
              <p className="text-3xl font-bold text-green-900">{formData.receptionAllowed}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
