-- Align counters with max existing users.user_id for a clinic+role (bypasses RLS).
-- Use when the API client cannot SELECT all users (anon key + RLS).
CREATE OR REPLACE FUNCTION public.repair_user_id_counter(p_clinic_id uuid, p_role text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code text;
  v_prefix text;
  v_max int;
  v_target int;
BEGIN
  SELECT clinic_code INTO v_code FROM public.clinics WHERE id = p_clinic_id;
  IF v_code IS NULL THEN
    RAISE EXCEPTION 'clinic not found';
  END IF;

  v_prefix :=
    v_code || '-' || (
      CASE p_role
        WHEN 'doctor' THEN 'DOC'
        WHEN 'receptionist' THEN 'REC'
        WHEN 'independent' THEN 'IND'
        ELSE upper(left(p_role, 3))
      END
    ) || '-';

  SELECT COALESCE(
    MAX(substring(u.user_id FROM length(v_prefix) + 1)::int),
    9999
  ) INTO v_max
  FROM public.users u
  WHERE u.clinic_id = p_clinic_id
    AND u.role = p_role
    AND u.user_id LIKE v_prefix || '%';

  v_target := v_max + 1;

  INSERT INTO public.counters (clinic_id, role, current_count)
  VALUES (p_clinic_id, p_role, v_target)
  ON CONFLICT (clinic_id, role) DO UPDATE
  SET current_count = GREATEST(counters.current_count, EXCLUDED.current_count);
END;
$$;

COMMENT ON FUNCTION public.repair_user_id_counter(uuid, text) IS
  'Sets counters.current_count to at least max(users.user_id suffix)+1 for the clinic role prefix.';

GRANT EXECUTE ON FUNCTION public.repair_user_id_counter(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.repair_user_id_counter(uuid, text) TO authenticated;
