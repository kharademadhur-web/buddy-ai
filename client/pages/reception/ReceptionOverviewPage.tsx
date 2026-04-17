import { useAdminAuth } from "@/context/AdminAuthContext";
import { useReceptionPortal } from "@/context/ReceptionPortalContext";
import { Users, TrendingUp } from "lucide-react";

export default function ReceptionOverviewPage() {
  const { user } = useAdminAuth();
  const { clinicId, queue, summary, paymentQrUrl, onlineDoctors, offlineDoctors, error } = useReceptionPortal();

  const completedToday = summary?.completedToday ?? 0;
  const totalCollected = summary?.totalCollected ?? 0;

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-4 sm:mb-8 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Reception Dashboard</h1>
          {user?.name ? (
            <p className="mt-1 text-sm text-gray-600">
              Signed in as <span className="font-medium text-gray-800">{user.name}</span>
              {user.user_id ? (
                <span className="ml-2 font-mono text-xs text-gray-500">{user.user_id}</span>
              ) : null}
            </p>
          ) : null}
          <p className="mt-1 text-sm text-gray-500">Overview</p>
        </div>
      </div>

      {!clinicId && (
        <div className="mb-4 p-4 bg-amber-50 border border-amber-200 text-amber-900 rounded-lg text-sm">
          No clinic is assigned to this account. Contact your administrator to attach this user to a clinic.
        </div>
      )}

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-800 rounded-lg text-sm">{error}</div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 mb-6 md:mb-8">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium">Patients in Queue</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{queue.length}</p>
            </div>
            <Users className="w-12 h-12 text-blue-600 opacity-10" />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium">Completed Today</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{completedToday}</p>
            </div>
            <TrendingUp className="w-12 h-12 text-green-600 opacity-10" />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium">Collected Today (paid)</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">₹{totalCollected}</p>
            </div>
            <TrendingUp className="w-12 h-12 text-green-600 opacity-10" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 flex flex-col md:flex-row gap-6 items-center">
        <div className="text-center md:text-left flex-1">
          <h2 className="text-lg font-semibold text-gray-900">Payments & OTP</h2>
          <p className="text-sm text-gray-600 mt-1">
            Clinic letterhead is uploaded in Admin (onboarding or clinic detail) and appears on the patient intake
            form. UPI / QR for collections. OTP contact:{" "}
            <a
              className="text-blue-600 font-medium"
              href={`tel:+91${import.meta.env.VITE_OTP_PHONE || "9137295344"}`}
            >
              +91 {import.meta.env.VITE_OTP_PHONE || "9137295344"}
            </a>
          </p>
        </div>
        <div className="shrink-0">
          {paymentQrUrl ? (
            <img
              src={paymentQrUrl}
              alt="Clinic payment QR"
              className="w-40 h-40 rounded-lg border border-gray-200 bg-white object-contain"
            />
          ) : (
            <div className="w-40 h-40 rounded-lg border border-dashed border-gray-300 bg-gray-50 flex items-center justify-center text-center text-xs text-gray-500 p-2">
              Upload clinic payment QR in Admin → clinic (onboarding or clinic detail).
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mt-6">
        <h2 className="text-lg font-semibold text-gray-900">Doctor live status</h2>
        <p className="text-sm text-gray-600 mt-1">
          Online means doctor is accepting patients and active in doctor portal.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-xs font-semibold uppercase text-emerald-700">Online</p>
            <p className="text-2xl font-bold text-emerald-900 mt-1">{onlineDoctors.length}</p>
            <div className="mt-2 space-y-1 text-sm text-emerald-900">
              {onlineDoctors.length > 0 ? (
                onlineDoctors.map((d) => <p key={d.id}>• {d.name}</p>)
              ) : (
                <p className="text-emerald-700">No doctors online right now.</p>
              )}
            </div>
          </div>
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-4">
            <p className="text-xs font-semibold uppercase text-rose-700">Offline</p>
            <p className="text-2xl font-bold text-rose-900 mt-1">{offlineDoctors.length}</p>
            <div className="mt-2 space-y-1 text-sm text-rose-900">
              {offlineDoctors.length > 0 ? (
                offlineDoctors.map((d) => <p key={d.id}>• {d.name}</p>)
              ) : (
                <p className="text-rose-700">All listed doctors are online.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
