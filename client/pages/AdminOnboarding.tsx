import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CreateClinic } from "./onboarding/CreateClinic";
import { AddDoctor } from "./onboarding/AddDoctor";
import { AddReceptionist } from "./onboarding/AddReceptionist";
import { useAdminAuth } from "@/context/AdminAuthContext";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, AlertTriangle, Building2, CheckCircle2, Stethoscope, UserPlus } from "lucide-react";
import { apiFetch, getAccessToken } from "@/lib/api-base";
import { Button } from "@/components/ui/button";

type Step = 1 | 2 | 3;

export default function AdminOnboarding() {
  const navigate = useNavigate();
  const { tokens } = useAdminAuth();
  const [step, setStep] = useState<Step>(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [createdClinic, setCreatedClinic] = useState<any>(null);
  const [doctorCredentials, setDoctorCredentials] = useState<any>(null);
  const [receptionistCredentials, setReceptionistCredentials] = useState<any>(null);
  const [doctorCredentialsList, setDoctorCredentialsList] = useState<Array<{ user_id: string; password: string }>>([]);
  const [receptionistCredentialsList, setReceptionistCredentialsList] = useState<Array<{ user_id: string; password: string }>>(
    []
  );
  const [doctorFormKey, setDoctorFormKey] = useState(0);
  const [receptionistFormKey, setReceptionistFormKey] = useState(0);
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

      // Separate uploaded files from the JSON payload
      const { letterheadFile, paymentQrFile, ...clinicJson } = data;

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

      const uploadAsset = async (kind: "letterhead" | "payment_qr", file: File) => {
        const fd = new FormData();
        fd.append("kind", kind);
        fd.append("file", file);
        const uploadRes = await apiFetch(`/api/admin/clinics/${clinic.id}/clinic-asset`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: fd,
        });
        const uploadJson = await uploadRes.json().catch(() => ({}));
        if (!uploadRes.ok || !uploadJson.success) {
          console.warn(`${kind} upload failed:`, uploadJson);
        }
      };

      if (clinic?.id) {
        try {
          if (letterheadFile instanceof File) await uploadAsset("letterhead", letterheadFile);
        } catch (uploadErr) {
          console.warn("Letterhead upload error:", uploadErr);
        }
        try {
          if (paymentQrFile instanceof File) await uploadAsset("payment_qr", paymentQrFile);
        } catch (uploadErr) {
          console.warn("Payment QR upload error:", uploadErr);
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
      if (json.credentials?.user_id && json.credentials?.password) {
        setDoctorCredentialsList((prev) => [json.credentials, ...prev]);
      }

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

      setDoctorFormKey((k) => k + 1);
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
      if (json.credentials?.user_id && json.credentials?.password) {
        setReceptionistCredentialsList((prev) => [json.credentials, ...prev]);
      }

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

      setReceptionistFormKey((k) => k + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create receptionist");
    } finally {
      setIsLoading(false);
    }
  };

  const kycOpsHint =
    "If the database is missing KYC columns, run migrations 009–010; if you see errors about updated_at on doctors, run 012 as well. Then re-attach documents from clinic settings or contact support.";

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-text-primary">Clinic onboarding</h2>
            <p className="text-sm text-text-secondary">Create a clinic, add staff, and hand over credentials in one guided flow.</p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-xs font-semibold">
            {[
              { n: 1, label: "Clinic", icon: Building2 },
              { n: 2, label: "Doctor", icon: Stethoscope },
              { n: 3, label: "Reception", icon: UserPlus },
            ].map((s) => (
              <div
                key={s.n}
                className={`rounded-2xl border px-3 py-2 text-center transition-all ${
                  step === s.n ? "border-primary bg-primary/10 text-primary" : "border-border bg-surface text-text-secondary"
                }`}
              >
                <s.icon className="mx-auto mb-1 h-4 w-4" />
                {s.label}
              </div>
            ))}
          </div>
        </div>
      </div>
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
          key={`doctor-form-${doctorFormKey}`}
          onNext={createDoctor}
          onBack={() => setStep(1)}
          isLoading={isLoading}
          error={error}
          primaryLabel="+ Add doctor"
          secondaryActionLabel="Continue to receptionists"
          onSecondaryAction={() => setStep(3)}
        />
      )}
      {step === 3 && (
        <AddReceptionist
          key={`reception-form-${receptionistFormKey}`}
          onNext={createReceptionist}
          onBack={() => setStep(2)}
          isLoading={isLoading}
          error={error}
          primaryLabel="+ Add receptionist"
          secondaryActionLabel="Finish onboarding"
          onSecondaryAction={() => navigate(createdClinic?.id ? `/admin-dashboard/clinic/${createdClinic.id}` : "/admin-dashboard/users")}
        />
      )}

      {(doctorCredentials || receptionistCredentials) && (
        <div className="space-y-3 rounded-2xl border border-success/20 bg-success/10 p-4">
          <div className="flex items-center gap-2 font-semibold text-text-primary">
            <CheckCircle2 className="h-5 w-5 text-success" />
            Generated credentials (shown once)
          </div>
          {doctorKycWarning || receptionistKycWarning ? (
            <p className="text-xs text-amber-800 dark:text-amber-200/90">
              The accounts above were created successfully. See the warning above if KYC did not save.
            </p>
          ) : null}
          {doctorCredentialsList.length > 0 ? (
            <div className="space-y-2 text-sm">
              <div className="font-medium text-text-primary">Doctors added</div>
              {doctorCredentialsList.map((cred) => (
                <div key={cred.user_id} className="rounded-xl bg-card p-3">
                  Doctor User ID: <span className="font-mono">{cred.user_id}</span> · Password:{" "}
                  <span className="font-mono">{cred.password}</span>
                </div>
              ))}
            </div>
          ) : null}
          {receptionistCredentialsList.length > 0 ? (
            <div className="space-y-2 text-sm">
              <div className="font-medium text-text-primary">Receptionists added</div>
              {receptionistCredentialsList.map((cred) => (
                <div key={cred.user_id} className="rounded-xl bg-card p-3">
                  Receptionist User ID: <span className="font-mono">{cred.user_id}</span> · Password:{" "}
                  <span className="font-mono">{cred.password}</span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      )}

      {createdClinic?.id ? (
        <div className="flex flex-wrap gap-2 rounded-2xl border border-border bg-card p-4 shadow-sm">
          <Button type="button" variant="outline" onClick={() => navigate(`/admin-dashboard/clinic/${createdClinic.id}`)}>
            Open clinic detail
          </Button>
          <Button type="button" variant="outline" onClick={() => navigate("/admin-dashboard/users")}>
            Open users (add later)
          </Button>
        </div>
      ) : null}
    </div>
  );
}

