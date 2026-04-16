import { useAdminAuth } from "@/context/AdminAuthContext";
import { useReceptionPortal } from "@/context/ReceptionPortalContext";
import PatientForm from "@/components/PatientForm";
import ReceptionPendingBills from "@/components/ReceptionPendingBills";
import { toast } from "sonner";

export default function ReceptionIntakePage() {
  const { user } = useAdminAuth();
  const { clinicId, refetch, refetchSummary } = useReceptionPortal();

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Patient intake</h1>
        <p className="mt-1 text-sm text-gray-600">
          Register patients and manage pending bills
          {user?.name ? (
            <>
              {" "}
              · <span className="font-medium text-gray-800">{user.name}</span>
            </>
          ) : null}
        </p>
      </div>

      {!clinicId && (
        <div className="mb-4 p-4 bg-amber-50 border border-amber-200 text-amber-900 rounded-lg text-sm">
          No clinic is assigned to this account. Contact your administrator to attach this user to a clinic.
        </div>
      )}

      <div className="max-w-3xl">
        <PatientForm
          onSuccess={() => {
            toast.success("Patient registered and checked in");
            void refetch();
            void refetchSummary();
          }}
        />
        <ReceptionPendingBills clinicId={clinicId} onPaid={() => void refetchSummary()} />
      </div>
    </div>
  );
}
