-- Fix: "permission denied for schema app" when PostgREST evaluates RLS policies.
-- The `app` schema holds helper functions (app.jwt_claim, app.current_clinic_id, …) used by policies.
-- Without USAGE on the schema and EXECUTE on functions, the `authenticated` role cannot invoke them.

GRANT USAGE ON SCHEMA app TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA app TO authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA app
GRANT EXECUTE ON FUNCTIONS TO authenticated;
