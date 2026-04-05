import React, { useState } from "react";
import { AlertTriangle, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface DeviceApprovalModalProps {
  isOpen: boolean;
  deviceId?: string;
  userAgent?: string;
  ipAddress?: string;
  onRetry?: () => void;
  onClose?: () => void;
}

export function DeviceApprovalModal({
  isOpen,
  deviceId,
  userAgent,
  ipAddress,
  onRetry,
  onClose,
}: DeviceApprovalModalProps) {
  const [isRetrying, setIsRetrying] = useState(false);

  const handleRetry = async () => {
    try {
      setIsRetrying(true);
      // Wait a moment before retrying
      await new Promise((resolve) => setTimeout(resolve, 1000));
      onRetry?.();
    } catch (error) {
      toast.error("Failed to retry device approval");
    } finally {
      setIsRetrying(false);
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-6">
        {/* Icon */}
        <div className="flex justify-center mb-4">
          <div className="bg-yellow-100 rounded-full p-3">
            <AlertTriangle className="w-8 h-8 text-yellow-600" />
          </div>
        </div>

        {/* Content */}
        <h2 className="text-xl font-semibold text-gray-900 text-center mb-2">
          Device Approval Required
        </h2>

        <p className="text-gray-600 text-sm text-center mb-4">
          Your device is pending admin approval. This is a security measure to
          protect your account.
        </p>

        {/* Device Info */}
        <div className="bg-gray-50 rounded-lg p-3 mb-4">
          <p className="text-xs text-gray-600 font-semibold mb-2">
            Device Information
          </p>
          <div className="space-y-1 text-xs text-gray-700">
            {deviceId && (
              <p>
                <strong>Device ID:</strong>{" "}
                <span className="font-mono break-all">{deviceId.slice(0, 12)}...</span>
              </p>
            )}
            {ipAddress && (
              <p>
                <strong>IP Address:</strong> {ipAddress}
              </p>
            )}
            {userAgent && (
              <p>
                <strong>Browser:</strong>{" "}
                <span className="font-mono">{userAgent.slice(0, 40)}...</span>
              </p>
            )}
          </div>
        </div>

        {/* Message */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
          <p className="text-sm text-blue-900">
            The admin has been notified about this new device. You will be able
            to login once your device is approved.
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <Button
            onClick={handleRetry}
            disabled={isRetrying}
            className="flex-1 bg-blue-600 hover:bg-blue-700"
          >
            {isRetrying ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Checking...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 mr-2" />
                Retry
              </>
            )}
          </Button>

          {onClose && (
            <Button
              onClick={onClose}
              variant="outline"
              className="flex-1"
            >
              Close
            </Button>
          )}
        </div>

        {/* Help Text */}
        <p className="text-xs text-gray-600 text-center mt-4">
          Questions? Contact your admin for assistance.
        </p>
      </div>
    </div>
  );
}
