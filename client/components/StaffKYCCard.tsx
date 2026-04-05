import { AlertCircle, CheckCircle2, XCircle, FileText } from "lucide-react";

interface StaffKYCCardProps {
  id: string;
  name: string;
  role: "doctor" | "receptionist";
  licenseNumber?: string;
  registrationNumber?: string;
  specialization?: string;
  aadhaarLast4?: string;
  panLast4?: string;
  kycStatus: "pending" | "approved" | "rejected";
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
}

export default function StaffKYCCard({
  id,
  name,
  role,
  licenseNumber,
  registrationNumber,
  specialization,
  aadhaarLast4,
  panLast4,
  kycStatus,
  onApprove,
  onReject,
}: StaffKYCCardProps) {
  const getStatusBadge = () => {
    switch (kycStatus) {
      case "approved":
        return (
          <div className="flex items-center gap-2 px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-semibold">
            <CheckCircle2 className="w-4 h-4" />
            Approved
          </div>
        );
      case "rejected":
        return (
          <div className="flex items-center gap-2 px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-semibold">
            <XCircle className="w-4 h-4" />
            Rejected
          </div>
        );
      default:
        return (
          <div className="flex items-center gap-2 px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-sm font-semibold">
            <AlertCircle className="w-4 h-4" />
            Pending
          </div>
        );
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <FileText className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">{name}</h3>
              <p className="text-sm text-gray-600 capitalize">
                {role === "receptionist" ? "Receptionist" : role}
                {specialization && ` • ${specialization}`}
              </p>
            </div>
          </div>
        </div>
        {getStatusBadge()}
      </div>

      <div className="space-y-4 pt-4 border-t border-gray-200">
        {licenseNumber && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-600 font-semibold uppercase">License Number</p>
              <p className="text-sm font-mono text-gray-900 mt-1">{licenseNumber}</p>
            </div>
            {registrationNumber && (
              <div>
                <p className="text-xs text-gray-600 font-semibold uppercase">Registration Number</p>
                <p className="text-sm font-mono text-gray-900 mt-1">{registrationNumber}</p>
              </div>
            )}
          </div>
        )}

        {(aadhaarLast4 || panLast4) && (
          <div className="grid grid-cols-2 gap-4">
            {aadhaarLast4 && (
              <div>
                <p className="text-xs text-gray-600 font-semibold uppercase">Aadhaar</p>
                <p className="text-sm font-mono text-gray-900 mt-1">****-****-{aadhaarLast4}</p>
              </div>
            )}
            {panLast4 && (
              <div>
                <p className="text-xs text-gray-600 font-semibold uppercase">PAN</p>
                <p className="text-sm font-mono text-gray-900 mt-1">*****{panLast4}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {kycStatus === "pending" && (onApprove || onReject) && (
        <div className="flex gap-3 mt-6 pt-4 border-t border-gray-200">
          {onApprove && (
            <button
              onClick={() => onApprove(id)}
              className="flex-1 px-4 py-2 bg-green-100 hover:bg-green-200 text-green-700 font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              Approve
            </button>
          )}
          {onReject && (
            <button
              onClick={() => onReject(id)}
              className="flex-1 px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <XCircle className="w-4 h-4" />
              Reject
            </button>
          )}
        </div>
      )}

      <div className="mt-4">
        <button className="text-blue-600 hover:text-blue-700 font-semibold text-sm">
          View Full KYC Details
        </button>
      </div>
    </div>
  );
}
