-- Jalankan sekali di Supabase: SQL Editor > New query > paste > Run.
alter table public.ai_provider_settings
  add column if not exists models jsonb not null default '{}'::jsonb;

-- Lepas batasan lama yang hanya mengizinkan gemini/openai pada kolom default_provider (jika ada).
do $$
declare c text;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.ai_provider_settings'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%default_provider%'
  loop
    execute format('alter table public.ai_provider_settings drop constraint %I', c);
  end loop;
end $$;
