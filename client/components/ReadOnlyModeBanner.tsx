import React from "react";
import { AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ReadOnlyModeBannerProps {
  reason?: string;
  onClose?: () => void;
  showPaymentLink?: boolean;
}

export function ReadOnlyModeBanner({
  reason,
  onClose,
  showPaymentLink = false,
}: ReadOnlyModeBannerProps) {
  return (
    <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />

        <div className="flex-1">
          <h3 className="font-semibold text-yellow-900">Account in Read-Only Mode</h3>
          <p className="text-sm text-yellow-800 mt-1">
            Your account is currently in read-only mode. You can view data but cannot
            create, edit, or delete records.
          </p>

          {reason && (
            <p className="text-sm text-yellow-800 mt-2">
              <strong>Reason:</strong> {reason}
            </p>
          )}

          <div className="mt-3 flex items-center gap-2">
            {showPaymentLink && (
              <Button
                variant="outline"
                className="text-sm bg-yellow-100 border-yellow-300 text-yellow-900 hover:bg-yellow-200"
              >
                Make Payment
              </Button>
            )}

            {onClose && (
              <button
                onClick={onClose}
                className="text-sm text-yellow-700 hover:text-yellow-900 font-medium"
              >
                Dismiss
              </button>
            )}
          </div>
        </div>

        {onClose && (
          <button
            onClick={onClose}
            className="text-yellow-600 hover:text-yellow-900"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>
    </div>
  );
}
