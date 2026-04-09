-- Atomically reserve the next numeric suffix for users.user_id (per clinic + role).
-- Fixes duplicate key on users_user_id_key from concurrent requests or failed post-insert increments.
CREATE OR REPLACE FUNCTION public.next_user_id_suffix(p_clinic_id uuid, p_role text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_suffix integer;
BEGIN
  INSERT INTO public.counters (clinic_id, role, current_count)
  VALUES (p_clinic_id, p_role, 10000)
  ON CONFLICT (clinic_id, role) DO NOTHING;

  UPDATE public.counters
  SET current_count = current_count + 1
  WHERE clinic_id = p_clinic_id AND role = p_role
  RETURNING current_count - 1 INTO v_suffix;

  IF v_suffix IS NULL THEN
    RAISE EXCEPTION 'counters row missing for clinic % role %', p_clinic_id, p_role;
  END IF;

  RETURN v_suffix;
END;
$$;

COMMENT ON FUNCTION public.next_user_id_suffix(uuid, text) IS
  'Increments counters and returns the suffix for the new users.user_id (same semantics as read-then-insert).';

GRANT EXECUTE ON FUNCTION public.next_user_id_suffix(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.next_user_id_suffix(uuid, text) TO authenticated;
