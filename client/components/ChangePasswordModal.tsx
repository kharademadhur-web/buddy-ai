import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { changePasswordSchema, type ChangePasswordInput } from "../lib/validation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { useToast } from "../hooks/use-toast";
import { apiFetch, apiErrorMessage, errorMessageFromUnknown } from "@/lib/api-base";

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

/**
 * ChangePasswordModal component
 * Allows authenticated users to change their password
 */
export function ChangePasswordModal({
  isOpen,
  onClose,
  onSuccess,
}: ChangePasswordModalProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
  } = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
  });

  const newPassword = watch("newPassword");

  const onSubmit = async (data: ChangePasswordInput) => {
    setIsLoading(true);
    try {
      const response = await apiFetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          oldPassword: data.oldPassword,
          newPassword: data.newPassword,
        }),
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: "Password changed successfully",
        });
        reset();
        onClose();
        onSuccess?.();
      } else {
        const error = await response.json().catch(() => ({}));
        toast({
          title: "Error",
          description: apiErrorMessage(error) || "Failed to change password",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: errorMessageFromUnknown(error, "An error occurred while changing password"),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change Password</DialogTitle>
          <DialogDescription>
            Enter your current password and choose a new one
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Current Password */}
          <div>
            <label className="text-sm font-medium text-gray-700">
              Current Password
            </label>
            <Input
              {...register("oldPassword")}
              type="password"
              placeholder="Enter current password"
              disabled={isLoading}
              className="mt-1"
            />
            {errors.oldPassword && (
              <p className="mt-1 text-sm text-red-600">
                {errors.oldPassword.message}
              </p>
            )}
          </div>

          {/* New Password */}
          <div>
            <label className="text-sm font-medium text-gray-700">
              New Password
            </label>
            <div className="relative">
              <Input
                {...register("newPassword")}
                type={showPassword ? "text" : "password"}
                placeholder="Enter new password (8+ chars, letters & numbers)"
                disabled={isLoading}
                className="mt-1 pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                disabled={isLoading}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
            {errors.newPassword && (
              <p className="mt-1 text-sm text-red-600">
                {errors.newPassword.message}
              </p>
            )}
            {newPassword && (
              <div className="mt-2 p-2 bg-gray-50 rounded text-xs text-gray-600">
                <p>Password must have:</p>
                <ul className="list-disc list-inside">
                  <li
                    className={
                      newPassword.length >= 8 ? "text-green-600" : "text-red-600"
                    }
                  >
                    At least 8 characters
                  </li>
                  <li
                    className={
                      /[a-zA-Z]/.test(newPassword)
                        ? "text-green-600"
                        : "text-red-600"
                    }
                  >
                    Letters
                  </li>
                  <li
                    className={
                      /\d/.test(newPassword) ? "text-green-600" : "text-red-600"
                    }
                  >
                    Numbers
                  </li>
                </ul>
              </div>
            )}
          </div>

          {/* Confirm Password */}
          <div>
            <label className="text-sm font-medium text-gray-700">
              Confirm New Password
            </label>
            <Input
              {...register("confirmPassword")}
              type="password"
              placeholder="Confirm new password"
              disabled={isLoading}
              className="mt-1"
            />
            {errors.confirmPassword && (
              <p className="mt-1 text-sm text-red-600">
                {errors.confirmPassword.message}
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 justify-end pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Changing..." : "Change Password"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
