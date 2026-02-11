-- B2 / Migration 001: Create projects table with owner-enforced RLS.
-- This table stores project metadata in columns and heavy editor payload in JSONB.

create extension if not exists pgcrypto;

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  data jsonb not null default '{}'::jsonb,
  thumbnail_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists idx_projects_owner_id on public.projects(owner_id);
create index if not exists idx_projects_updated_at on public.projects(updated_at desc);
create index if not exists idx_projects_deleted_at on public.projects(deleted_at);

comment on table public.projects is
  'User-owned projects. RLS restricts CRUD to the row owner.';
comment on column public.projects.data is
  'Serialized project payload JSONB containing objects and steps.';

alter table public.projects enable row level security;

drop policy if exists projects_select_own on public.projects;
create policy projects_select_own
on public.projects
for select
to authenticated
using (auth.uid() = owner_id);

drop policy if exists projects_insert_own on public.projects;
create policy projects_insert_own
on public.projects
for insert
to authenticated
with check (auth.uid() = owner_id);

drop policy if exists projects_update_own on public.projects;
create policy projects_update_own
on public.projects
for update
to authenticated
using (auth.uid() = owner_id)
with check (auth.uid() = owner_id);

drop policy if exists projects_delete_own on public.projects;
create policy projects_delete_own
on public.projects
for delete
to authenticated
using (auth.uid() = owner_id);
