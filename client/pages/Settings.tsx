import { User, Lock, Globe, CreditCard, Database, ChevronRight } from "lucide-react";

export default function Settings() {
  const settingsSections = [
    {
      title: "Doctor Profile",
      icon: User,
      description: "Update your profile information",
      color: "blue",
    },
    {
      title: "Clinic Info",
      icon: User,
      description: "Manage clinic details and contact",
      color: "purple",
    },
    {
      title: "Language Preferences",
      icon: Globe,
      description: "Set preferred languages for patient communication",
      color: "green",
    },
    {
      title: "Pricing & Fees",
      icon: CreditCard,
      description: "Configure consultation fees and services",
      color: "orange",
    },
    {
      title: "Payment Integration",
      icon: CreditCard,
      description: "Connect UPI, cards, and other payment methods",
      color: "red",
    },
    {
      title: "Data & Security",
      icon: Lock,
      description: "Backup data, privacy settings, and security",
      color: "gray",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 pt-6 pb-8 rounded-b-3xl">
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-blue-100 text-sm mt-2">
          Configure your clinic and preferences
        </p>
      </div>

      <div className="px-4 py-6 max-w-2xl mx-auto">
        <div className="space-y-3">
          {settingsSections.map((section, index) => {
            const Icon = section.icon;
            const colorMap = {
              blue: "bg-blue-100 text-blue-600",
              purple: "bg-purple-100 text-purple-600",
              green: "bg-green-100 text-green-600",
              orange: "bg-orange-100 text-orange-600",
              red: "bg-red-100 text-red-600",
              gray: "bg-gray-100 text-gray-600",
            };

            return (
              <button
                key={index}
                className="w-full bg-white rounded-xl p-4 border border-gray-100 hover:shadow-md hover:border-gray-200 transition-all text-left flex items-center justify-between group"
              >
                <div className="flex items-start gap-4">
                  <div className={`rounded-lg p-3 ${colorMap[section.color as keyof typeof colorMap]}`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-800">
                      {section.title}
                    </h3>
                    <p className="text-sm text-gray-600 mt-1">
                      {section.description}
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-gray-600 transition-colors flex-shrink-0 ml-2" />
              </button>
            );
          })}
        </div>

        {/* Danger Zone */}
        <div className="mt-8 pt-8 border-t border-gray-200">
          <h3 className="text-sm font-semibold text-gray-800 mb-4">
            Danger Zone
          </h3>
          <button className="w-full bg-red-50 border-2 border-red-200 rounded-xl p-4 text-red-700 font-semibold hover:bg-red-100 transition-colors">
            Delete Account
          </button>
        </div>
      </div>
    </div>
  );
}
