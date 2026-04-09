# Deprecated / Legacy Route Modules

Legacy route files were removed from this repository during stabilization.

Use only the mounted route set in `server/index.ts`:
- `appointments.ts`
- `queue-v2.ts`
- `consultations-v2.ts`
- `billing-v2.ts`
- `patients-v2.ts`
- `staff.ts`

If you need to restore deprecated behavior, re-implement it in V2 modules with tests and explicit migration notes.

