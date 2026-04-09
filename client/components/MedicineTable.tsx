import { useEffect, useState } from "react";
import { Plus, X, Loader2 } from "lucide-react";
import { Medicine } from "@/context/ClinicContext";
import { apiFetch } from "@/lib/api-base";

interface MedicineTableProps {
  medicines: Medicine[];
  onChange: (medicines: Medicine[]) => void;
  editable?: boolean;
}

type SearchRow = {
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
};

/** Last-resort when API unreachable */
const OFFLINE_SUGGESTIONS: SearchRow[] = [
  { name: "Paracetamol", dosage: "500mg", duration: "5 days", frequency: "Thrice daily" },
  { name: "Ibuprofen", dosage: "400mg", duration: "3 days", frequency: "Twice daily" },
  { name: "Amoxicillin", dosage: "250mg", duration: "7 days", frequency: "Twice daily" },
];

export default function MedicineTable({ medicines, onChange, editable = true }: MedicineTableProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newMedicine, setNewMedicine] = useState({
    name: "",
    dosage: "",
    duration: "",
    frequency: "",
  });
  const [search, setSearch] = useState("");
  const [suggestions, setSuggestions] = useState<SearchRow[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  useEffect(() => {
    const q = search.trim();
    if (q.length < 1) {
      setSuggestions([]);
      return;
    }
    const t = setTimeout(() => {
      void (async () => {
        setSearchLoading(true);
        try {
          const res = await apiFetch(
            `/api/medicines/search?q=${encodeURIComponent(q)}&limit=20`
          );
          const j = (await res.json()) as { results?: SearchRow[] };
          if (res.ok && Array.isArray(j.results)) {
            setSuggestions(j.results);
          } else {
            setSuggestions(
              OFFLINE_SUGGESTIONS.filter(
                (m) => m.name.toLowerCase().includes(q.toLowerCase())
              )
            );
          }
        } catch {
          setSuggestions(
            OFFLINE_SUGGESTIONS.filter((m) => m.name.toLowerCase().includes(q.toLowerCase()))
          );
        } finally {
          setSearchLoading(false);
        }
      })();
    }, 280);
    return () => clearTimeout(t);
  }, [search]);

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

  const addFromSearchRow = (row: SearchRow) => {
    const newMed: Medicine = {
      id: Date.now().toString() + Math.random().toString(16).slice(2),
      name: row.name,
      dosage: row.dosage,
      duration: row.duration,
      frequency: row.frequency,
    };
    onChange([...medicines, newMed]);
    setSearch("");
    setSuggestions([]);
  };

  return (
    <div className="space-y-4">
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
                        type="button"
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
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Search medicines
            </label>
            <div className="relative">
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Type to search formulary (e.g. Para, Amox)…"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                autoComplete="off"
              />
              {searchLoading && (
                <Loader2 className="absolute right-3 top-2.5 h-4 w-4 animate-spin text-gray-400" />
              )}
            </div>
            {search.trim().length > 0 && suggestions.length > 0 && (
              <ul className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-sm divide-y divide-gray-100">
                {suggestions.map((row) => (
                  <li key={`${row.name}-${row.dosage}`}>
                    <button
                      type="button"
                      onClick={() => addFromSearchRow(row)}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 transition-colors"
                    >
                      <span className="font-semibold text-gray-900">{row.name}</span>{" "}
                      <span className="text-gray-600">{row.dosage}</span>
                      <span className="text-gray-500 text-xs block">
                        {row.frequency} · {row.duration}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {search.trim().length > 0 && !searchLoading && suggestions.length === 0 && (
              <p className="text-xs text-gray-500 mt-2">No matches — use custom add below.</p>
            )}
          </div>

          {!showAddForm ? (
            <button
              type="button"
              onClick={() => setShowAddForm(true)}
              className="w-full py-2 border-2 border-dashed border-blue-400 text-blue-600 rounded-lg font-semibold hover:bg-blue-50 transition-colors flex items-center justify-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Add custom medicine
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
              <input
                type="text"
                placeholder="Dosage (e.g. 500mg)"
                value={newMedicine.dosage}
                onChange={(e) =>
                  setNewMedicine((prev) => ({ ...prev, dosage: e.target.value }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
              <input
                type="text"
                placeholder="Frequency (e.g. Twice daily)"
                value={newMedicine.frequency}
                onChange={(e) =>
                  setNewMedicine((prev) => ({ ...prev, frequency: e.target.value }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
              <input
                type="text"
                placeholder="Duration (e.g. 5 days)"
                value={newMedicine.duration}
                onChange={(e) =>
                  setNewMedicine((prev) => ({ ...prev, duration: e.target.value }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleAddMedicine}
                  className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors text-sm"
                >
                  Add
                </button>
                <button
                  type="button"
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
