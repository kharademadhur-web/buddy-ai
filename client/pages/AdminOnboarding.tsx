import { useMemo, useState } from "react";
import { CreateClinic } from "./onboarding/CreateClinic";
import { AddDoctor } from "./onboarding/AddDoctor";
import { AddReceptionist } from "./onboarding/AddReceptionist";
import { useAdminAuth } from "@/context/AdminAuthContext";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, AlertTriangle } from "lucide-react";
import { apiFetch, getAccessToken } from "@/lib/api-base";

type Step = 1 | 2 | 3;

export default function AdminOnboarding() {
  const { tokens } = useAdminAuth();
  const [step, setStep] = useState<Step>(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [createdClinic, setCreatedClinic] = useState<any>(null);
  const [doctorCredentials, setDoctorCredentials] = useState<any>(null);
  const [receptionistCredentials, setReceptionistCredentials] = useState<any>(null);
  /** Set when the user account was created but KYC upload/attach failed (e.g. schema mismatch). */
  const [doctorKycWarning, setDoctorKycWarning] = useState("");
  const [receptionistKycWarning, setReceptionistKycWarning] = useState("");

  const getApiErrorMessage = (json: any, fallback: string) => {
    const msg =
      json?.error?.message ??
      json?.message ??
      (typeof json?.error === "string" ? json.error : null) ??
      (typeof json === "string" ? json : null);
    return msg || fallback;
  };

  const headers = useMemo(() => {
    const accessToken = tokens?.accessToken || sessionStorage.getItem("admin_access_token") || "";
    return {
      Authorization: `Bearer ${accessToken}`,
    };
  }, [tokens?.accessToken]);

  const createClinic = async (data: any) => {
    setIsLoading(true);
    setError("");
    try {
      const token = getAccessToken() || tokens?.accessToken || "";
      if (!token) {
        throw new Error("You are not logged in. Open Admin Login and sign in as Super Admin, then try again.");
      }

      // Separate the letterhead file from the JSON payload
      const { letterheadFile, ...clinicJson } = data;

      const res = await apiFetch("/api/admin/clinics", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...headers,
        },
        body: JSON.stringify(clinicJson),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(getApiErrorMessage(json, "Failed to create clinic"));
      const clinic = json.clinic;
      setCreatedClinic(clinic);

      // Upload letterhead if provided
      if (letterheadFile instanceof File && clinic?.id) {
        try {
          const fd = new FormData();
          fd.append("kind", "letterhead");
          fd.append("file", letterheadFile);
          const uploadRes = await apiFetch(`/api/admin/clinics/${clinic.id}/clinic-asset`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
            body: fd,
          });
          const uploadJson = await uploadRes.json().catch(() => ({}));
          if (!uploadRes.ok || !uploadJson.success) {
            console.warn("Letterhead upload failed:", uploadJson);
          }
        } catch (uploadErr) {
          console.warn("Letterhead upload error:", uploadErr);
        }
      }

      setStep(2);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create clinic");
    } finally {
      setIsLoading(false);
    }
  };

  const addUser = async (role: "doctor" | "receptionist", data: any) => {
    if (!createdClinic?.id || !createdClinic?.clinic_code) {
      throw new Error("Clinic not created yet");
    }

    const payload: any = {
      name: data.name,
      phone: data.phone,
      email: data.email,
      role,
      clinic_id: createdClinic.id,
      clinic_code: createdClinic.clinic_code,
      license_number: role === "doctor" ? data.licenseNumber : undefined,
    };

    const res = await apiFetch("/api/admin/users", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(getApiErrorMessage(json, "Failed to create user"));
    return json;
  };

  const uploadKycDoc = async (userId: string, file: File) => {
    const accessToken = tokens?.accessToken || sessionStorage.getItem("admin_access_token") || "";
    const fd = new FormData();
    fd.append("userId", userId);
    fd.append("file", file);

    const res = await apiFetch("/api/admin/kyc/upload", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: fd,
    });
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(getApiErrorMessage(json, "Failed to upload document"));
    return json.document as { path: string };
  };

  const attachKycDocs = async (
    userId: string,
    role: "doctor" | "receptionist",
    docs: { panPath?: string; aadhaarPath?: string; signaturePath?: string }
  ) => {
    const res = await apiFetch(`/api/admin/users/${userId}/kyc-documents`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
      body: JSON.stringify({ role, documents: docs }),
    });
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(getApiErrorMessage(json, "Failed to attach KYC documents"));
    return json;
  };

  const createDoctor = async (data: any) => {
    setIsLoading(true);
    setError("");
    setDoctorKycWarning("");
    try {
      const json = await addUser("doctor", data);
      setDoctorCredentials(json.credentials);

      const userId = json.user?.id as string | undefined;
      if (userId) {
        try {
          const pan = data.panDocumentUrl ? await uploadKycDoc(userId, data.panDocumentUrl) : null;
          const aadhaar = data.aadhaarDocumentUrl ? await uploadKycDoc(userId, data.aadhaarDocumentUrl) : null;
          const signature = data.signatureUrl ? await uploadKycDoc(userId, data.signatureUrl) : null;

          if (pan || aadhaar || signature) {
            await attachKycDocs(userId, "doctor", {
              panPath: pan?.path,
              aadhaarPath: aadhaar?.path,
              signaturePath: signature?.path,
            });
          }
        } catch (kycErr) {
          const msg = kycErr instanceof Error ? kycErr.message : "KYC step failed";
          setDoctorKycWarning(msg);
        }
      }

      setStep(3);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create doctor");
    } finally {
      setIsLoading(false);
    }
  };

  const createReceptionist = async (data: any) => {
    setIsLoading(true);
    setError("");
    setReceptionistKycWarning("");
    try {
      const json = await addUser("receptionist", data);
      setReceptionistCredentials(json.credentials);

      const userId = json.user?.id as string | undefined;
      if (userId) {
        try {
          const pan = data.panDocumentUrl ? await uploadKycDoc(userId, data.panDocumentUrl) : null;
          const aadhaar = data.aadhaarDocumentUrl ? await uploadKycDoc(userId, data.aadhaarDocumentUrl) : null;
          const signature = data.signatureUrl ? await uploadKycDoc(userId, data.signatureUrl) : null;

          if (pan || aadhaar || signature) {
            await attachKycDocs(userId, "receptionist", {
              panPath: pan?.path,
              aadhaarPath: aadhaar?.path,
              signaturePath: signature?.path,
            });
          }
        } catch (kycErr) {
          const msg = kycErr instanceof Error ? kycErr.message : "KYC step failed";
          setReceptionistKycWarning(msg);
        }
      }

      setStep(3);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create receptionist");
    } finally {
      setIsLoading(false);
    }
  };

  const kycOpsHint =
    "If the database is missing KYC columns, run migrations 009–010; if you see errors about updated_at on doctors, run 012 as well. Then re-attach documents from clinic settings or contact support.";

  return (
    <div className="space-y-6">
      {error ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {doctorKycWarning ? (
        <Alert className="border-amber-500/50 bg-amber-50 text-amber-950 dark:border-amber-600/40 dark:bg-amber-950/25 dark:text-amber-100">
          <AlertTriangle className="h-4 w-4 text-amber-700 dark:text-amber-400" />
          <AlertDescription className="space-y-1">
            <p>
              <span className="font-semibold">Partial success:</span> The doctor account was created and the login
              details below are valid. KYC could not be saved on the server.
            </p>
            <p className="text-sm opacity-90">{doctorKycWarning}</p>
            <p className="text-xs opacity-80">{kycOpsHint}</p>
          </AlertDescription>
        </Alert>
      ) : null}

      {receptionistKycWarning ? (
        <Alert className="border-amber-500/50 bg-amber-50 text-amber-950 dark:border-amber-600/40 dark:bg-amber-950/25 dark:text-amber-100">
          <AlertTriangle className="h-4 w-4 text-amber-700 dark:text-amber-400" />
          <AlertDescription className="space-y-1">
            <p>
              <span className="font-semibold">Partial success:</span> The receptionist account was created and the login
              details below are valid. KYC could not be saved on the server.
            </p>
            <p className="text-sm opacity-90">{receptionistKycWarning}</p>
            <p className="text-xs opacity-80">{kycOpsHint}</p>
          </AlertDescription>
        </Alert>
      ) : null}

      {step === 1 && <CreateClinic onNext={createClinic} isLoading={isLoading} error={error} />}
      {step === 2 && (
        <AddDoctor
          onNext={createDoctor}
          onBack={() => setStep(1)}
          isLoading={isLoading}
          error={error}
        />
      )}
      {step === 3 && (
        <AddReceptionist
          onNext={createReceptionist}
          onBack={() => setStep(2)}
          isLoading={isLoading}
          error={error}
        />
      )}

      {(doctorCredentials || receptionistCredentials) && (
        <div className="rounded-lg border bg-white p-4 space-y-2">
          <div className="font-semibold text-gray-900">Generated credentials (shown once)</div>
          {doctorKycWarning || receptionistKycWarning ? (
            <p className="text-xs text-amber-800 dark:text-amber-200/90">
              The accounts above were created successfully. See the warning above if KYC did not save.
            </p>
          ) : null}
          {doctorCredentials ? (
            <div className="text-sm">
              <div>Doctor User ID: <span className="font-mono">{doctorCredentials.user_id}</span></div>
              <div>Doctor Password: <span className="font-mono">{doctorCredentials.password}</span></div>
            </div>
          ) : null}
          {receptionistCredentials ? (
            <div className="text-sm">
              <div>Receptionist User ID: <span className="font-mono">{receptionistCredentials.user_id}</span></div>
              <div>Receptionist Password: <span className="font-mono">{receptionistCredentials.password}</span></div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

