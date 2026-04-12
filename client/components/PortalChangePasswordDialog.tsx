import { useState } from "react";
import { Loader2 } from "lucide-react";
import { apiFetch, apiErrorMessage } from "@/lib/api-base";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * Portal password change: current password → registered phone → OTP → new password.
 * User ID is never changed (handled elsewhere).
 */
export default function PortalChangePasswordDialog({ open, onOpenChange }: Props) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [otp, setOtp] = useState("");
  const [pwNew, setPwNew] = useState("");
  const [pwNew2, setPwNew2] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const reset = () => {
    setCurrentPassword("");
    setPhone("");
    setSessionId(null);
    setOtp("");
    setPwNew("");
    setPwNew2("");
    setError("");
  };

  const sendOtp = async () => {
    setError("");
    if (!currentPassword.trim()) {
      setError("Enter your current password.");
      return;
    }
    if (!phone.trim()) {
      setError("Enter the phone number registered to your account.");
      return;
    }
    setLoading(true);
    try {
      const res = await apiFetch("/api/auth/password-change/request-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, phone: phone.trim() }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(apiErrorMessage(j) || "Failed to send OTP");
      setSessionId(j.sessionId ?? null);
      toast.success("OTP sent to your registered number.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setLoading(false);
    }
  };

  const complete = async () => {
    setError("");
    if (!sessionId) {
      setError("Send OTP first.");
      return;
    }
    if (!otp.trim()) {
      setError("Enter the OTP from your phone.");
      return;
    }
    if (pwNew.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }
    if (pwNew !== pwNew2) {
      setError("New passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      const res = await apiFetch("/api/auth/password-change/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, otp: otp.trim(), newPassword: pwNew }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(apiErrorMessage(j) || "Failed to update password");
      toast.success("Password updated.");
      reset();
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Change password</DialogTitle>
          <DialogDescription>
            Enter your current password and the phone number on file. We will send an OTP; then set your new
            password. Your login User ID cannot be changed.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <div className="space-y-1">
            <Label htmlFor="pcp-cur">Current password</Label>
            <Input
              id="pcp-cur"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="pcp-phone">Registered phone number</Label>
            <Input
              id="pcp-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Same as on your account"
              autoComplete="tel"
            />
          </div>
          <Button type="button" variant="secondary" className="w-full" onClick={() => void sendOtp()} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Send OTP
          </Button>
          {sessionId ? (
            <>
              <div className="space-y-1">
                <Label htmlFor="pcp-otp">OTP</Label>
                <Input
                  id="pcp-otp"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  autoComplete="one-time-code"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="pcp-n1">New password</Label>
                <Input
                  id="pcp-n1"
                  type="password"
                  value={pwNew}
                  onChange={(e) => setPwNew(e.target.value)}
                  autoComplete="new-password"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="pcp-n2">Confirm new password</Label>
                <Input
                  id="pcp-n2"
                  type="password"
                  value={pwNew2}
                  onChange={(e) => setPwNew2(e.target.value)}
                  autoComplete="new-password"
                />
              </div>
            </>
          ) : null}
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          {sessionId ? (
            <Button type="button" onClick={() => void complete()} disabled={loading}>
              Update password
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
