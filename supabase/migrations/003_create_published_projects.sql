-- B2 / Migration 003: Create published_projects table and mixed RLS model.
-- Owners manage published snapshots; public readers can fetch active snapshots by share token.

create table if not exists public.published_projects (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  share_token text not null unique,
  snapshot jsonb not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_published_projects_owner_id on public.published_projects(owner_id);
create index if not exists idx_published_projects_project_id on public.published_projects(project_id);
create index if not exists idx_published_projects_share_token on public.published_projects(share_token);
create index if not exists idx_published_projects_is_active on public.published_projects(is_active);

comment on table public.published_projects is
  'Read-only share snapshots. Owner has full CRUD. Public can read active records.';
comment on column public.published_projects.share_token is
  'High-entropy public token used to resolve published snapshots.';
comment on column public.published_projects.snapshot is
  'Published project snapshot (JSONB) without private user fields.';

alter table public.published_projects enable row level security;

drop policy if exists published_projects_select_own on public.published_projects;
create policy published_projects_select_own
on public.published_projects
for select
to authenticated
using (auth.uid() = owner_id);

drop policy if exists published_projects_insert_own on public.published_projects;
create policy published_projects_insert_own
on public.published_projects
for insert
to authenticated
with check (auth.uid() = owner_id);

drop policy if exists published_projects_update_own on public.published_projects;
create policy published_projects_update_own
on public.published_projects
for update
to authenticated
using (auth.uid() = owner_id)
with check (auth.uid() = owner_id);

drop policy if exists published_projects_delete_own on public.published_projects;
create policy published_projects_delete_own
on public.published_projects
for delete
to authenticated
using (auth.uid() = owner_id);

-- Public read-only policy for published viewer. Application queries by share_token.
drop policy if exists published_projects_select_active_public on public.published_projects;
create policy published_projects_select_active_public
on public.published_projects
for select
to anon, authenticated
using (is_active = true);
