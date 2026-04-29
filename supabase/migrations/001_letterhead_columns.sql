-- Clinic asset columns for branded prescription and payment workflows.
-- letterhead_storage_path stores the private Supabase Storage object path for the clinic's uploaded letterhead image/PDF.
-- letterhead_file_type stores the uploaded letterhead MIME/file type so the app can render images and handle PDFs safely.
-- payment_qr_storage_path stores the private Supabase Storage object path for the clinic's payment QR image.

alter table public.clinics
  add column if not exists letterhead_storage_path text,
  add column if not exists letterhead_file_type text,
  add column if not exists payment_qr_storage_path text;
