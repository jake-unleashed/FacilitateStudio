-- B2 / Migration 007: Unified starter assets catalog for models and 360 backgrounds.
-- Starter assets are public, read-only catalog entries managed outside normal user asset flows.

create table if not exists public.starter_assets (
  id text primary key,
  type text not null check (type in ('model', 'background')),
  name text not null,
  description text,
  category text,
  storage_key text not null,
  thumbnail_url text,
  file_type text not null,
  file_size bigint,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_starter_assets_type_active_sort
  on public.starter_assets(type, is_active, sort_order, name);

comment on table public.starter_assets is
  'Public starter asset catalog for built-in models and 360 backgrounds.';
comment on column public.starter_assets.id is
  'Stable starter asset identifier (for example: starter:bulldozer or starter-bg:warehouse).';
comment on column public.starter_assets.storage_key is
  'Supabase Storage path in starter-assets bucket (for example: models/bulldozer.glb).';

alter table public.starter_assets enable row level security;

drop policy if exists starter_assets_select_public on public.starter_assets;
create policy starter_assets_select_public
on public.starter_assets
for select
to anon, authenticated
using (is_active = true);

insert into storage.buckets (id, name, public)
values ('starter-assets', 'starter-assets', true)
on conflict (id) do nothing;

drop policy if exists starter_assets_storage_select_public on storage.objects;
create policy starter_assets_storage_select_public
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'starter-assets');
