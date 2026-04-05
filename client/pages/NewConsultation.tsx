import { useState } from "react";
import {
  Mic,
  Type,
  Zap,
  Plus,
  X,
  Edit2,
  CheckCircle2,
  Globe,
  Brain,
  Pill,
} from "lucide-react";
import { cn } from "@/lib/utils";

type InputMode = "voice" | "typing";

export default function NewConsultation() {
  const [inputMode, setInputMode] = useState<InputMode>("typing");
  const [clinicalNotes, setClinicalNotes] = useState("");
  const [language, setLanguage] = useState("en");
  const [aiSuggestions] = useState({
    diagnosis: [
      { id: 1, name: "Hypertension", confidence: 0.92 },
      { id: 2, name: "Type 2 Diabetes", confidence: 0.78 },
      { id: 3, name: "Hyperlipidemia", confidence: 0.65 },
    ],
    prescriptions: [
      {
        id: 1,
        medicine: "Amlodipine",
        dosage: "5mg",
        duration: "30 days",
        frequency: "Once daily",
      },
      {
        id: 2,
        medicine: "Metformin",
        dosage: "500mg",
        duration: "30 days",
        frequency: "Twice daily",
      },
      {
        id: 3,
        medicine: "Atorvastatin",
        dosage: "20mg",
        duration: "30 days",
        frequency: "Once daily",
      },
    ],
  });

  const [selectedDiagnosis, setSelectedDiagnosis] = useState<number[]>([
    aiSuggestions.diagnosis[0].id,
  ]);
  const [selectedPrescriptions, setSelectedPrescriptions] = useState<number[]>([
    aiSuggestions.prescriptions[0].id,
  ]);

  const languages = [
    { code: "en", name: "English" },
    { code: "hi", name: "Hindi" },
    { code: "mr", name: "Marathi" },
    { code: "gu", name: "Gujarati" },
    { code: "ta", name: "Tamil" },
  ];

  const handleDiagnosisToggle = (id: number) => {
    setSelectedDiagnosis((prev) =>
      prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]
    );
  };

  const handlePrescriptionToggle = (id: number) => {
    setSelectedPrescriptions((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 pt-6 pb-8 rounded-b-3xl">
        <h1 className="text-2xl font-bold">New Consultation</h1>
        <p className="text-blue-100 text-sm mt-2">
          Enter clinical notes to get AI suggestions
        </p>
      </div>

      <div className="px-4 py-6 max-w-4xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column - Input */}
          <div className="space-y-6">
            {/* Input Mode Toggle */}
            <div className="bg-white rounded-2xl p-4 border border-gray-200">
              <div className="flex gap-2">
                <button
                  onClick={() => setInputMode("typing")}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-medium transition-all",
                    inputMode === "typing"
                      ? "bg-blue-600 text-white shadow-md"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  )}
                >
                  <Type className="w-5 h-5" />
                  Type
                </button>
                <button
                  onClick={() => setInputMode("voice")}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-medium transition-all",
                    inputMode === "voice"
                      ? "bg-purple-600 text-white shadow-md"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  )}
                >
                  <Mic className="w-5 h-5" />
                  Voice
                </button>
              </div>
            </div>

            {/* Notes Input Area */}
            <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
              <label className="block text-sm font-semibold text-gray-800 mb-3">
                Clinical Notes
              </label>
              <textarea
                value={clinicalNotes}
                onChange={(e) => setClinicalNotes(e.target.value)}
                placeholder="Enter or speak clinical observations, symptoms, examination findings, and patient history..."
                className="w-full h-40 p-4 border border-gray-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-2">
                {clinicalNotes.length} characters
              </p>
            </div>

            {/* Language Selection */}
            <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
              <label className="block text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <Globe className="w-4 h-4" />
                Patient Language
              </label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {languages.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Right Column - AI Suggestions */}
          <div className="space-y-6">
            {/* Diagnosis Suggestions */}
            <div className="bg-white rounded-2xl p-6 border border-blue-200 shadow-sm">
              <h3 className="flex items-center gap-2 text-lg font-bold text-gray-800 mb-4">
                <Brain className="w-5 h-5 text-blue-600" />
                Suggested Diagnosis
              </h3>

              {clinicalNotes ? (
                <div className="space-y-3">
                  {aiSuggestions.diagnosis.map((diagnosis) => (
                    <div
                      key={diagnosis.id}
                      className={cn(
                        "p-4 rounded-xl border-2 cursor-pointer transition-all",
                        selectedDiagnosis.includes(diagnosis.id)
                          ? "border-blue-500 bg-blue-50"
                          : "border-gray-200 bg-gray-50 hover:border-gray-300"
                      )}
                      onClick={() => handleDiagnosisToggle(diagnosis.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-gray-800">
                            {diagnosis.name}
                          </p>
                          <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-blue-600 h-2 rounded-full transition-all"
                              style={{
                                width: `${diagnosis.confidence * 100}%`,
                              }}
                            />
                          </div>
                          <p className="text-xs text-gray-600 mt-1">
                            {Math.round(diagnosis.confidence * 100)}% confidence
                          </p>
                        </div>
                        {selectedDiagnosis.includes(diagnosis.id) && (
                          <CheckCircle2 className="w-6 h-6 text-blue-600 flex-shrink-0" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-sm text-center py-8">
                  Enter clinical notes to see AI suggestions
                </p>
              )}
            </div>

            {/* Prescription Suggestions */}
            <div className="bg-white rounded-2xl p-6 border border-green-200 shadow-sm">
              <h3 className="flex items-center gap-2 text-lg font-bold text-gray-800 mb-4">
                <Pill className="w-5 h-5 text-green-600" />
                Suggested Prescriptions
              </h3>

              {clinicalNotes ? (
                <div className="space-y-3">
                  {aiSuggestions.prescriptions.map((rx) => (
                    <div
                      key={rx.id}
                      className={cn(
                        "p-4 rounded-xl border-2 cursor-pointer transition-all",
                        selectedPrescriptions.includes(rx.id)
                          ? "border-green-500 bg-green-50"
                          : "border-gray-200 bg-gray-50 hover:border-gray-300"
                      )}
                      onClick={() => handlePrescriptionToggle(rx.id)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <p className="font-semibold text-gray-800">
                            {rx.medicine}
                          </p>
                          <div className="grid grid-cols-3 gap-2 mt-2 text-xs">
                            <div>
                              <span className="text-gray-600">Dosage:</span>
                              <p className="font-semibold text-gray-800">
                                {rx.dosage}
                              </p>
                            </div>
                            <div>
                              <span className="text-gray-600">Frequency:</span>
                              <p className="font-semibold text-gray-800">
                                {rx.frequency}
                              </p>
                            </div>
                            <div>
                              <span className="text-gray-600">Duration:</span>
                              <p className="font-semibold text-gray-800">
                                {rx.duration}
                              </p>
                            </div>
                          </div>
                        </div>
                        {selectedPrescriptions.includes(rx.id) && (
                          <CheckCircle2 className="w-6 h-6 text-green-600 flex-shrink-0 mt-1" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-sm text-center py-8">
                  Enter clinical notes to see AI suggestions
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-8 mb-6">
          <button className="bg-white border-2 border-gray-300 text-gray-800 font-semibold py-4 rounded-xl hover:bg-gray-50 transition-colors flex items-center justify-center gap-2">
            <Edit2 className="w-5 h-5" />
            Edit Suggestions
          </button>
          <button className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-4 rounded-xl transition-colors flex items-center justify-center gap-2 shadow-md">
            <Zap className="w-5 h-5" />
            Generate Prescription
          </button>
        </div>
      </div>
    </div>
  );
}
