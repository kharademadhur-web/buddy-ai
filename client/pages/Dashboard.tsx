import { useState } from "react";
import {
  Calendar,
  Stethoscope,
  TrendingUp,
  Plus,
  Mic,
  ChevronRight,
  Clock,
  AlertCircle,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

export default function Dashboard() {
  const [doctorName] = useState("Dr. Sharma");
  const currentDate = new Date();
  const greeting = getGreeting();

  // Mock data
  const appointments = {
    total: 8,
    time: "2:30 PM",
  };

  const followUps = {
    due: 3,
    critical: 1,
  };

  const earnings = {
    today: 4500,
    currency: "₹",
  };

  const recentPatients = [
    {
      id: 1,
      name: "Rajesh Kumar",
      age: 45,
      lastVisit: "Today, 10:30 AM",
      status: "Completed",
      condition: "Hypertension",
    },
    {
      id: 2,
      name: "Priya Singh",
      age: 32,
      lastVisit: "Today, 11:45 AM",
      status: "Completed",
      condition: "Migraine",
    },
    {
      id: 3,
      name: "Amit Patel",
      age: 58,
      lastVisit: "Today, 1:15 PM",
      status: "Follow-up",
      condition: "Diabetes",
    },
    {
      id: 4,
      name: "Neha Gupta",
      age: 28,
      lastVisit: "Yesterday, 3:00 PM",
      status: "Completed",
      condition: "Fever",
    },
    {
      id: 5,
      name: "Vikram Singh",
      age: 52,
      lastVisit: "Yesterday, 4:30 PM",
      status: "Critical",
      condition: "Cardiac Care",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {/* Header Section */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 pt-6 pb-8 rounded-b-3xl">
        <div className="flex items-start justify-between mb-6">
          <div>
            <p className="text-blue-100 text-sm font-medium">{greeting}</p>
            <h1 className="text-3xl font-bold text-white mt-1">{doctorName}</h1>
          </div>
          <div className="bg-blue-500 rounded-full p-3">
            <Stethoscope className="w-6 h-6" />
          </div>
        </div>
        <p className="text-blue-100 text-sm">
          {format(currentDate, "EEEE, d MMMM yyyy")}
        </p>
      </div>

      {/* Main Content */}
      <div className="px-4 py-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 gap-4 mb-8">
          {/* Appointments Card */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-blue-100">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium mb-2">
                  Today's Appointments
                </p>
                <h2 className="text-4xl font-bold text-blue-600 mb-2">
                  {appointments.total}
                </h2>
                <p className="text-gray-500 text-sm">
                  Next appointment at {appointments.time}
                </p>
              </div>
              <div className="bg-blue-100 rounded-full p-4">
                <Calendar className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>

          {/* Follow-ups Card */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-amber-100">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium mb-2">
                  Follow-ups Due
                </p>
                <h2 className="text-4xl font-bold text-amber-600 mb-2">
                  {followUps.due}
                </h2>
                <p className="text-gray-500 text-sm flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-500" />
                  {followUps.critical} critical
                </p>
              </div>
              <div className="bg-amber-100 rounded-full p-4">
                <Clock className="w-6 h-6 text-amber-600" />
              </div>
            </div>
          </div>

          {/* Earnings Card */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-green-100">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium mb-2">
                  Today's Earnings
                </p>
                <h2 className="text-4xl font-bold text-green-600 mb-2">
                  {earnings.currency}
                  {earnings.today.toLocaleString()}
                </h2>
                <p className="text-gray-500 text-sm">From 8 consultations</p>
              </div>
              <div className="bg-green-100 rounded-full p-4">
                <TrendingUp className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mb-8">
          <h3 className="text-lg font-bold text-gray-800 mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-4">
            <button className="bg-white border-2 border-blue-300 rounded-2xl p-6 text-center hover:bg-blue-50 transition-colors">
              <div className="bg-blue-100 rounded-full p-4 w-fit mx-auto mb-3">
                <Plus className="w-6 h-6 text-blue-600" />
              </div>
              <p className="font-semibold text-gray-800">New Patient</p>
              <p className="text-xs text-gray-500 mt-1">Register & consult</p>
            </button>

            <button className="bg-white border-2 border-purple-300 rounded-2xl p-6 text-center hover:bg-purple-50 transition-colors">
              <div className="bg-purple-100 rounded-full p-4 w-fit mx-auto mb-3">
                <Mic className="w-6 h-6 text-purple-600" />
              </div>
              <p className="font-semibold text-gray-800">Voice Note</p>
              <p className="text-xs text-gray-500 mt-1">Quick memo</p>
            </button>
          </div>
        </div>

        {/* Recent Activity */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-gray-800">Recent Activity</h3>
            <a href="/patients" className="text-blue-600 text-sm font-medium flex items-center gap-1 hover:text-blue-700">
              View All <ChevronRight className="w-4 h-4" />
            </a>
          </div>

          <div className="space-y-3">
            {recentPatients.map((patient) => (
              <div
                key={patient.id}
                className="bg-white rounded-xl p-4 border border-gray-100 hover:shadow-md transition-shadow cursor-pointer"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-800">
                      {patient.name}
                    </h4>
                    <p className="text-sm text-gray-600 mt-1">
                      {patient.age} yrs • {patient.condition}
                    </p>
                    <p className="text-xs text-gray-500 mt-2">{patient.lastVisit}</p>
                  </div>
                  <span
                    className={cn(
                      "px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap ml-2",
                      patient.status === "Critical"
                        ? "bg-red-100 text-red-700"
                        : patient.status === "Follow-up"
                        ? "bg-amber-100 text-amber-700"
                        : "bg-green-100 text-green-700"
                    )}
                  >
                    {patient.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good Morning";
  if (hour < 17) return "Good Afternoon";
  return "Good Evening";
}
