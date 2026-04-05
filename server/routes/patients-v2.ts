import { Router, Request, Response } from "express";
import { z } from "zod";
import { getSupabaseClient, getSupabaseRlsClient } from "../config/supabase";
import { signSupabaseRlsJwt } from "../config/supabase-jwt";
import { authMiddleware } from "../middleware/auth-jwt.middleware";
import { requireRole } from "../middleware/rbac.middleware";

const router = Router();

const createSchema = z.object({
  clinicId: z.string().uuid(),
  name: z.string().min(1),
  phone: z.string().min(6),
  email: z.string().email().optional(),
  dateOfBirth: z.string().optional(), // YYYY-MM-DD
  gender: z.enum(["male", "female", "other"]).optional(),
  medicalHistory: z.string().optional(),
  allergies: z.string().optional(),
  emergencyContact: z.string().optional(),
});

router.post(
  "/",
  authMiddleware,
  requireRole("receptionist", "super-admin"),
  async (req: Request, res: Response) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    if (req.user?.role !== "super-admin" && req.user?.clinicId !== parsed.data.clinicId) {
      return res.status(403).json({ error: "Clinic access denied" });
    }

    const supabase =
      req.user?.role === "super-admin"
        ? getSupabaseClient()
        : getSupabaseRlsClient(signSupabaseRlsJwt(req.user!));

    // Upsert by unique (clinic_id, phone) behavior
    const { data, error } = await supabase
      .from("patients")
      .upsert(
        {
          clinic_id: parsed.data.clinicId,
          name: parsed.data.name,
          phone: parsed.data.phone,
          email: parsed.data.email ?? null,
          date_of_birth: parsed.data.dateOfBirth ?? null,
          gender: parsed.data.gender ?? null,
          medical_history: parsed.data.medicalHistory ?? null,
          allergies: parsed.data.allergies ?? null,
          emergency_contact: parsed.data.emergencyContact ?? null,
          created_by: req.user?.userId ?? null,
        },
        { onConflict: "clinic_id,phone" }
      )
      .select("*")
      .single();

    if (error || !data) return res.status(500).json({ error: error?.message || "Failed to save patient" });
    return res.status(201).json({ success: true, patient: data });
  }
);

router.get(
  "/",
  authMiddleware,
  requireRole("doctor", "receptionist", "independent", "super-admin"),
  async (req: Request, res: Response) => {
    const { query, clinicId, limit } = req.query as {
      query?: string;
      clinicId?: string;
      limit?: string;
    };

    const effectiveClinicId = clinicId || req.user?.clinicId;
    if (!effectiveClinicId) return res.status(400).json({ error: "clinicId is required" });
    if (req.user?.role !== "super-admin" && req.user?.clinicId !== effectiveClinicId) {
      return res.status(403).json({ error: "Clinic access denied" });
    }

    const supabase =
      req.user?.role === "super-admin"
        ? getSupabaseClient()
        : getSupabaseRlsClient(signSupabaseRlsJwt(req.user!));

    let q = supabase.from("patients").select("*").eq("clinic_id", effectiveClinicId);
    if (query) {
      // naive: search by name or phone contains
      const like = `%${query}%`;
      q = q.or(`name.ilike.${like},phone.ilike.${like}`);
    }
    const take = Math.min(parseInt(limit || "20", 10) || 20, 50);
    const { data, error } = await q.order("updated_at", { ascending: false }).limit(take);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ success: true, patients: data ?? [] });
  }
);

router.get(
  "/:id",
  authMiddleware,
  requireRole("doctor", "receptionist", "independent", "super-admin"),
  async (req: Request, res: Response) => {
    const clinicId = (req.query as any).clinicId || req.user?.clinicId;
    if (!clinicId) return res.status(400).json({ error: "clinicId is required" });
    if (req.user?.role !== "super-admin" && req.user?.clinicId !== clinicId) {
      return res.status(403).json({ error: "Clinic access denied" });
    }

    const supabase =
      req.user?.role === "super-admin"
        ? getSupabaseClient()
        : getSupabaseRlsClient(signSupabaseRlsJwt(req.user!));
    const { data, error } = await supabase
      .from("patients")
      .select("*")
      .eq("clinic_id", clinicId)
      .eq("id", req.params.id)
      .single();

    if (error || !data) return res.status(404).json({ error: "Patient not found" });
    return res.json({ success: true, patient: data });
  }
);

export default router;

