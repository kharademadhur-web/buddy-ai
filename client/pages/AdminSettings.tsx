import { Settings } from "lucide-react";

export default function AdminSettings() {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 text-center">
        <Settings className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Admin Settings</h2>
        <p className="text-gray-600">
          Manage system-wide settings, configuration, and preferences.
        </p>
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-blue-50 rounded-lg p-6 border border-blue-200">
            <p className="text-sm text-blue-600 font-semibold mb-2">Coming Soon</p>
            <p className="text-gray-700 text-sm">System Configuration</p>
          </div>
          <div className="bg-green-50 rounded-lg p-6 border border-green-200">
            <p className="text-sm text-green-600 font-semibold mb-2">Coming Soon</p>
            <p className="text-gray-700 text-sm">Notification Settings</p>
          </div>
          <div className="bg-purple-50 rounded-lg p-6 border border-purple-200">
            <p className="text-sm text-purple-600 font-semibold mb-2">Coming Soon</p>
            <p className="text-gray-700 text-sm">User Permissions</p>
          </div>
        </div>
      </div>
    </div>
  );
}
