import { useState } from "react";
import { Plus, X } from "lucide-react";
import { Medicine } from "@/context/ClinicContext";

interface MedicineTableProps {
  medicines: Medicine[];
  onChange: (medicines: Medicine[]) => void;
  editable?: boolean;
}

const mockMedicines = [
  { id: "1", name: "Paracetamol", dosage: "500mg", duration: "5 days", frequency: "Thrice daily" },
  { id: "2", name: "Ibuprofen", dosage: "400mg", duration: "3 days", frequency: "Twice daily" },
  { id: "3", name: "Amoxicillin", dosage: "250mg", duration: "7 days", frequency: "Twice daily" },
  { id: "4", name: "Metformin", dosage: "500mg", duration: "30 days", frequency: "Twice daily" },
  { id: "5", name: "Lisinopril", dosage: "10mg", duration: "30 days", frequency: "Once daily" },
];

export default function MedicineTable({ medicines, onChange, editable = true }: MedicineTableProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newMedicine, setNewMedicine] = useState({
    name: "",
    dosage: "",
    duration: "",
    frequency: "",
  });
  const [selectedMedicineName, setSelectedMedicineName] = useState("");

  const handleAddMedicine = () => {
    if (!newMedicine.name || !newMedicine.dosage || !newMedicine.duration || !newMedicine.frequency) {
      alert("Please fill all fields");
      return;
    }

    const medicine: Medicine = {
      id: Date.now().toString(),
      ...newMedicine,
    };

    onChange([...medicines, medicine]);
    setNewMedicine({ name: "", dosage: "", duration: "", frequency: "" });
    setShowAddForm(false);
  };

  const handleRemoveMedicine = (medicineId: string) => {
    onChange(medicines.filter((m) => m.id !== medicineId));
  };

  const handleQuickAdd = (medicine: typeof mockMedicines[0]) => {
    const newMed: Medicine = {
      id: Date.now().toString(),
      name: medicine.name,
      dosage: medicine.dosage,
      duration: medicine.duration,
      frequency: medicine.frequency,
    };
    onChange([...medicines, newMed]);
    setSelectedMedicineName("");
  };

  return (
    <div className="space-y-4">
      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-2 border-gray-200 bg-gray-50">
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Medicine</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Dosage</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Frequency</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Duration</th>
              {editable && <th className="px-4 py-3 text-center font-semibold text-gray-700">Action</th>}
            </tr>
          </thead>
          <tbody>
            {medicines.length > 0 ? (
              medicines.map((medicine) => (
                <tr key={medicine.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 font-semibold text-gray-900">{medicine.name}</td>
                  <td className="px-4 py-3 text-gray-700">{medicine.dosage}</td>
                  <td className="px-4 py-3 text-gray-700">{medicine.frequency}</td>
                  <td className="px-4 py-3 text-gray-700">{medicine.duration}</td>
                  {editable && (
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleRemoveMedicine(medicine.id)}
                        className="text-red-600 hover:text-red-700 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </td>
                  )}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={editable ? 5 : 4} className="px-4 py-8 text-center text-gray-500">
                  No medicines added yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {editable && (
        <div className="space-y-3">
          {/* Quick Add */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Quick Add from Common Medicines
            </label>
            <div className="flex gap-2">
              <select
                value={selectedMedicineName}
                onChange={(e) => {
                  const medicine = mockMedicines.find((m) => m.name === e.target.value);
                  if (medicine) {
                    handleQuickAdd(medicine);
                  }
                }}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              >
                <option value="">Select medicine...</option>
                {mockMedicines.map((m) => (
                  <option key={m.name} value={m.name}>
                    {m.name} ({m.dosage})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Add New */}
          {!showAddForm ? (
            <button
              onClick={() => setShowAddForm(true)}
              className="w-full py-2 border-2 border-dashed border-blue-400 text-blue-600 rounded-lg font-semibold hover:bg-blue-50 transition-colors flex items-center justify-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Add Custom Medicine
            </button>
          ) : (
            <div className="border border-gray-200 rounded-lg p-4 space-y-3 bg-gray-50">
              <input
                type="text"
                placeholder="Medicine name"
                value={newMedicine.name}
                onChange={(e) =>
                  setNewMedicine((prev) => ({ ...prev, name: e.target.value }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />
              <input
                type="text"
                placeholder="Dosage (e.g., 500mg)"
                value={newMedicine.dosage}
                onChange={(e) =>
                  setNewMedicine((prev) => ({ ...prev, dosage: e.target.value }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />
              <input
                type="text"
                placeholder="Frequency (e.g., Twice daily)"
                value={newMedicine.frequency}
                onChange={(e) =>
                  setNewMedicine((prev) => ({ ...prev, frequency: e.target.value }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />
              <input
                type="text"
                placeholder="Duration (e.g., 5 days)"
                value={newMedicine.duration}
                onChange={(e) =>
                  setNewMedicine((prev) => ({ ...prev, duration: e.target.value }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleAddMedicine}
                  className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors text-sm"
                >
                  Add
                </button>
                <button
                  onClick={() => setShowAddForm(false)}
                  className="flex-1 py-2 bg-gray-300 hover:bg-gray-400 text-gray-800 rounded-lg font-semibold transition-colors text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
