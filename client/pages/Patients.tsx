import { useState } from "react";
import {
  Search,
  User,
  Phone,
  Calendar,
  Plus,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

type FilterType = "all" | "followup" | "new" | "critical";

export default function Patients() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterType>("all");

  const filters = [
    { id: "all", label: "All", icon: User },
    { id: "followup", label: "Follow-up", icon: Calendar },
    { id: "new", label: "New", icon: Plus },
    { id: "critical", label: "Critical", icon: AlertCircle },
  ];

  const mockPatients = [
    {
      id: 1,
      name: "Rajesh Kumar",
      age: 45,
      phone: "+91 98765 43210",
      lastVisit: "Today, 10:30 AM",
      status: "completed",
      condition: "Hypertension",
    },
    {
      id: 2,
      name: "Priya Singh",
      age: 32,
      phone: "+91 98765 43211",
      lastVisit: "Today, 11:45 AM",
      status: "completed",
      condition: "Migraine",
    },
    {
      id: 3,
      name: "Amit Patel",
      age: 58,
      phone: "+91 98765 43212",
      lastVisit: "Today, 1:15 PM",
      status: "followup",
      condition: "Diabetes",
    },
    {
      id: 4,
      name: "Vikram Singh",
      age: 52,
      phone: "+91 98765 43213",
      lastVisit: "Yesterday, 4:30 PM",
      status: "critical",
      condition: "Cardiac Care",
    },
    {
      id: 5,
      name: "Neha Gupta",
      age: 28,
      phone: "+91 98765 43214",
      lastVisit: "2 days ago",
      status: "new",
      condition: "General Checkup",
    },
  ];

  const filteredPatients = mockPatients.filter(
    (patient) =>
      (activeFilter === "all" || patient.status === activeFilter) &&
      (patient.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        patient.phone.includes(searchQuery))
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 pt-6 pb-8 rounded-b-3xl">
        <h1 className="text-2xl font-bold">Patients</h1>
        <p className="text-blue-100 text-sm mt-2">
          Manage your patient records
        </p>
      </div>

      <div className="px-4 py-6">
        {/* Search Bar */}
        <div className="mb-6 relative">
          <Search className="absolute left-4 top-4 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name or phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
          />
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {filters.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveFilter(id as FilterType)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-full font-medium whitespace-nowrap transition-all",
                activeFilter === id
                  ? "bg-blue-600 text-white shadow-md"
                  : "bg-white border-2 border-gray-200 text-gray-700 hover:border-blue-300"
              )}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        {/* Patient List */}
        <div className="space-y-3">
          {filteredPatients.length > 0 ? (
            filteredPatients.map((patient) => (
              <div
                key={patient.id}
                className="bg-white rounded-xl p-4 border border-gray-100 hover:shadow-md transition-all cursor-pointer"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-800 text-lg">
                      {patient.name}
                    </h3>
                    <p className="text-sm text-gray-600 mt-1">
                      {patient.age} years old • {patient.condition}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap",
                      patient.status === "critical"
                        ? "bg-red-100 text-red-700"
                        : patient.status === "followup"
                        ? "bg-amber-100 text-amber-700"
                        : patient.status === "new"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-green-100 text-green-700"
                    )}
                  >
                    {patient.status === "completed"
                      ? "Completed"
                      : patient.status === "followup"
                      ? "Follow-up"
                      : patient.status === "critical"
                      ? "Critical"
                      : "New"}
                  </span>
                </div>

                <div className="flex items-center gap-4 text-sm text-gray-600">
                  <div className="flex items-center gap-1">
                    <Phone className="w-4 h-4" />
                    {patient.phone}
                  </div>
                  <div className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    {patient.lastVisit}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-500">No patients found</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
