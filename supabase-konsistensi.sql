-- Jalankan sekali di Supabase: SQL Editor > New query > paste > Run.
alter table public.drafts add column if not exists consistency jsonb;
alter table public.script_versions add column if not exists consistency jsonb;
