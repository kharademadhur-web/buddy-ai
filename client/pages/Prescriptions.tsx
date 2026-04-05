import { FileText, Download, Share2, Printer } from "lucide-react";

export default function Prescriptions() {
  const mockPrescriptions = [
    {
      id: 1,
      patientName: "Rajesh Kumar",
      date: "Today, 10:30 AM",
      medicines: 3,
      status: "active",
    },
    {
      id: 2,
      patientName: "Priya Singh",
      date: "Today, 11:45 AM",
      medicines: 2,
      status: "active",
    },
    {
      id: 3,
      patientName: "Amit Patel",
      date: "Today, 1:15 PM",
      medicines: 4,
      status: "active",
    },
    {
      id: 4,
      patientName: "Vikram Singh",
      date: "Yesterday, 4:30 PM",
      medicines: 5,
      status: "draft",
    },
    {
      id: 5,
      patientName: "Neha Gupta",
      date: "2 days ago",
      medicines: 2,
      status: "completed",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 pt-6 pb-8 rounded-b-3xl">
        <h1 className="text-2xl font-bold">Prescriptions</h1>
        <p className="text-blue-100 text-sm mt-2">
          View and manage patient prescriptions
        </p>
      </div>

      <div className="px-4 py-6">
        <div className="space-y-3">
          {mockPrescriptions.map((prescription) => (
            <div
              key={prescription.id}
              className="bg-white rounded-xl p-4 border border-gray-100 hover:shadow-md transition-all"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-start gap-3 flex-1">
                  <div className="bg-blue-100 rounded-lg p-3 mt-0">
                    <FileText className="w-6 h-6 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-800">
                      {prescription.patientName}
                    </h3>
                    <p className="text-sm text-gray-600 mt-1">
                      {prescription.medicines} medicines prescribed
                    </p>
                    <p className="text-xs text-gray-500 mt-2">
                      {prescription.date}
                    </p>
                  </div>
                </div>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap ${
                    prescription.status === "active"
                      ? "bg-green-100 text-green-700"
                      : prescription.status === "draft"
                      ? "bg-amber-100 text-amber-700"
                      : "bg-gray-100 text-gray-700"
                  }`}
                >
                  {prescription.status.charAt(0).toUpperCase() +
                    prescription.status.slice(1)}
                </span>
              </div>

              <div className="flex gap-2">
                <button className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 transition-colors text-sm font-medium">
                  <Download className="w-4 h-4" />
                  Download PDF
                </button>
                <button className="flex items-center justify-center gap-2 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors">
                  <Share2 className="w-4 h-4" />
                </button>
                <button className="flex items-center justify-center gap-2 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors">
                  <Printer className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
