-- B2 / Migration 002: Create assets table with owner-enforced RLS.
-- Binary files live in Storage; this table tracks metadata and storage keys.

create table if not exists public.assets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  storage_key text not null,
  filename text not null,
  file_type text not null,
  file_size bigint not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_assets_owner_id on public.assets(owner_id);
create index if not exists idx_assets_project_id on public.assets(project_id);
create index if not exists idx_assets_storage_key on public.assets(storage_key);

comment on table public.assets is
  'User-owned uploaded model assets. RLS restricts CRUD to the row owner.';
comment on column public.assets.storage_key is
  'Supabase Storage object path, convention: {userId}/{projectId}/{assetId}/{filename}.';

alter table public.assets enable row level security;

drop policy if exists assets_select_own on public.assets;
create policy assets_select_own
on public.assets
for select
to authenticated
using (auth.uid() = owner_id);

drop policy if exists assets_insert_own on public.assets;
create policy assets_insert_own
on public.assets
for insert
to authenticated
with check (auth.uid() = owner_id);

drop policy if exists assets_update_own on public.assets;
create policy assets_update_own
on public.assets
for update
to authenticated
using (auth.uid() = owner_id)
with check (auth.uid() = owner_id);

drop policy if exists assets_delete_own on public.assets;
create policy assets_delete_own
on public.assets
for delete
to authenticated
using (auth.uid() = owner_id);
