-- Jalankan sekali di Supabase: SQL Editor > New query > paste > Run.
alter table public.episodes add column if not exists publish_date date, add column if not exists assignee text;

create table if not exists public.extractions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  images jsonb, status text not null default 'menunggu', result jsonb, error text,
  created_at timestamptz not null default now()
);
alter table public.extractions enable row level security;
drop policy if exists extractions_owner on public.extractions;
create policy extractions_owner on public.extractions for all
  using (exists (select 1 from public.projects p where p.id = project_id and p.owner_id = auth.uid()))
  with check (exists (select 1 from public.projects p where p.id = project_id and p.owner_id = auth.uid()));
