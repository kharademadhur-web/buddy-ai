import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useClinic, type UserRole } from "@/context/ClinicContext";
import { Stethoscope, LogIn } from "lucide-react";
import { cn } from "@/lib/utils";

export default function Login() {
  const navigate = useNavigate();
  const { setCurrentUser, setCurrentRole } = useClinic();
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);

  const roles: Array<{
    id: UserRole;
    name: string;
    description: string;
    color: string;
    icon: React.ReactNode;
  }> = [
    {
      id: "doctor",
      name: "Doctor",
      description: "Doctor with reception support",
      color: "blue",
      icon: <Stethoscope className="w-8 h-8" />,
    },
    {
      id: "reception",
      name: "Reception",
      description: "Patient registration & queue",
      color: "green",
      icon: <LogIn className="w-8 h-8" />,
    },
    {
      id: "solo-doctor",
      name: "Solo Doctor Mode",
      description: "All-in-one clinic mode",
      color: "purple",
      icon: <Stethoscope className="w-8 h-8" />,
    },
    {
      id: "admin",
      name: "Super Admin",
      description: "Clinic & user management",
      color: "red",
      icon: <LogIn className="w-8 h-8" />,
    },
  ];

  const colorMap = {
    blue: "border-blue-400 bg-blue-50 hover:bg-blue-100 text-blue-700",
    green: "border-green-400 bg-green-50 hover:bg-green-100 text-green-700",
    purple: "border-purple-400 bg-purple-50 hover:bg-purple-100 text-purple-700",
    red: "border-red-400 bg-red-50 hover:bg-red-100 text-red-700",
  };

  const handleLogin = (role: UserRole) => {
    const userData = {
      id: Date.now().toString(),
      name: `${role === "doctor" ? "Dr." : ""} Sharma`,
      role,
      clinicId: "1",
      active: true,
    };

    setCurrentUser(userData);
    setCurrentRole(role);

    // Navigate to appropriate dashboard
    const dashboardMap = {
      doctor: "/doctor-dashboard",
      reception: "/reception-dashboard",
      "solo-doctor": "/solo-dashboard",
      admin: "/admin-dashboard",
    };

    navigate(dashboardMap[role]);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex justify-center mb-4">
            <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl p-4">
              <Stethoscope className="w-8 h-8 text-white" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Smart Medical Clinic
          </h1>
          <p className="text-gray-600">
            Select your role to access the clinic management system
          </p>
        </div>

        {/* Role Selection */}
        <div className="space-y-3 mb-8">
          {roles.map((role) => (
            <button
              key={role.id}
              onClick={() => setSelectedRole(role.id)}
              className={cn(
                "w-full p-4 border-2 rounded-xl transition-all text-left flex items-center gap-4",
                selectedRole === role.id
                  ? colorMap[role.color as keyof typeof colorMap]
                  : "border-gray-200 bg-white hover:border-gray-300"
              )}
            >
              <div className="flex-shrink-0">{role.icon}</div>
              <div className="flex-1">
                <h3 className="font-semibold">{role.name}</h3>
                <p className="text-xs opacity-75">{role.description}</p>
              </div>
            </button>
          ))}
        </div>

        {/* Login Button */}
        <button
          onClick={() => selectedRole && handleLogin(selectedRole)}
          disabled={!selectedRole}
          className={cn(
            "w-full py-3 rounded-xl font-semibold transition-all flex items-center justify-center gap-2",
            selectedRole
              ? "bg-blue-600 hover:bg-blue-700 text-white shadow-lg cursor-pointer"
              : "bg-gray-200 text-gray-500 cursor-not-allowed"
          )}
        >
          <LogIn className="w-5 h-5" />
          Login as {selectedRole ? roles.find((r) => r.id === selectedRole)?.name : "Select Role"}
        </button>

        {/* Info */}
        <p className="text-center text-xs text-gray-500 mt-6">
          This is a demo application. Select any role to explore.
        </p>
      </div>
    </div>
  );
}
