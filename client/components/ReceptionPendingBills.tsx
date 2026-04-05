import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-base";
import { Banknote, Loader2, Printer, RefreshCw } from "lucide-react";
import { toast } from "sonner";

type BillRow = {
  id: string;
  total_amount: number | string | null;
  payment_status: string;
  consultation_fee?: number | string | null;
  medicine_cost?: number | string | null;
  paid_at?: string | null;
  patients?: { name: string | null; phone: string | null } | { name: string | null; phone: string | null }[] | null;
};

function patientFromBill(b: BillRow): { name: string; phone: string } {
  const raw = b.patients;
  const p = Array.isArray(raw) ? raw[0] : raw;
  return { name: p?.name || "Patient", phone: p?.phone || "" };
}

function amountNum(v: number | string | null | undefined): number {
  if (v == null) return 0;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : 0;
}

function printReceipt(opts: { clinicLabel: string; patientName: string; phone: string; total: number; billId: string }) {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <title>Receipt</title>
      <style>
        body { font-family: system-ui, sans-serif; padding: 24px; max-width: 360px; margin: 0 auto; }
        h1 { font-size: 1.1rem; margin: 0 0 12px; }
        .muted { color: #555; font-size: 0.85rem; }
        .total { font-size: 1.25rem; font-weight: 700; margin-top: 16px; }
      </style>
    </head>
    <body>
      <h1>${opts.clinicLabel}</h1>
      <p class="muted">Bill #${opts.billId.slice(0, 8)}</p>
      <p><strong>${opts.patientName}</strong><br /><span class="muted">${opts.phone || "—"}</span></p>
      <p class="total">Total: ₹${opts.total.toFixed(2)}</p>
      <p class="muted">Thank you.</p>
    </body>
    </html>`;
  const w = window.open("", "_blank", "width=420,height=520");
  if (!w) {
    toast.error("Allow pop-ups to print the receipt");
    return;
  }
  w.document.write(html);
  w.document.close();
  w.focus();
  w.print();
  w.close();
}

export default function ReceptionPendingBills({
  clinicId,
  clinicName,
  onPaid,
}: {
  clinicId: string | null;
  clinicName?: string | null;
  onPaid?: () => void;
}) {
  const [bills, setBills] = useState<BillRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [payingId, setPayingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!clinicId) return;
    setLoading(true);
    try {
      const qs = new URLSearchParams({
        clinicId,
        paymentStatus: "pending",
        limit: "40",
      });
      const res = await apiFetch(`/api/billing?${qs.toString()}`);
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Failed to load bills");
      setBills(j.bills || []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load bills");
      setBills([]);
    } finally {
      setLoading(false);
    }
  }, [clinicId]);

  useEffect(() => {
    void load();
  }, [load]);

  const markPaid = async (billId: string) => {
    setPayingId(billId);
    try {
      const res = await apiFetch(`/api/billing/${billId}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentMethod: "cash" }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Payment failed");
      toast.success("Marked as paid");
      await load();
      onPaid?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Payment failed");
    } finally {
      setPayingId(null);
    }
  };

  if (!clinicId) return null;

  const label = clinicName?.trim() || "Clinic";

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <Banknote className="w-5 h-5 text-emerald-600" />
          <h2 className="text-lg font-bold text-gray-900">Pending billing</h2>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-800 disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Refresh
        </button>
      </div>
      <p className="text-sm text-gray-600 mb-4">
        After the doctor completes the visit, collect payment here, then print a receipt for the patient.
      </p>

      {loading && bills.length === 0 ? (
        <div className="flex items-center gap-2 text-sm text-gray-500 py-6 justify-center">
          <Loader2 className="w-5 h-5 animate-spin" />
          Loading bills…
        </div>
      ) : bills.length === 0 ? (
        <p className="text-sm text-gray-500 py-4 text-center">No pending bills. New visits appear when reception adds a patient.</p>
      ) : (
        <ul className="divide-y divide-gray-100 border border-gray-100 rounded-lg overflow-hidden">
          {bills.map((b) => {
            const { name, phone } = patientFromBill(b);
            const total = amountNum(b.total_amount);
            return (
              <li key={b.id} className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white">
                <div>
                  <p className="font-semibold text-gray-900">{name}</p>
                  <p className="text-sm text-gray-600">{phone || "—"}</p>
                  <p className="text-sm font-medium text-gray-800 mt-1">₹{total.toFixed(2)} pending</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      printReceipt({
                        clinicLabel: label,
                        patientName: name,
                        phone,
                        total,
                        billId: b.id,
                      })
                    }
                    className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-gray-300 text-gray-800 text-sm font-semibold hover:bg-gray-50"
                  >
                    <Printer className="w-4 h-4" />
                    Print
                  </button>
                  <button
                    type="button"
                    disabled={payingId === b.id}
                    onClick={() => void markPaid(b.id)}
                    className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-sm font-semibold"
                  >
                    {payingId === b.id ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    Mark paid
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
