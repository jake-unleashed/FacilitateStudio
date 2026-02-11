-- B2 / Migration 004: Configure storage buckets and RLS policies.
-- Private buckets are owner-scoped by path prefix; published bucket is publicly readable.

insert into storage.buckets (id, name, public)
values
  ('user-assets', 'user-assets', false),
  ('thumbnails', 'thumbnails', false),
  ('published-assets', 'published-assets', true)
on conflict (id) do nothing;

-- ----------------------------
-- user-assets (private)
-- ----------------------------
drop policy if exists user_assets_select_own on storage.objects;
create policy user_assets_select_own
on storage.objects
for select
to authenticated
using (
  bucket_id = 'user-assets'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists user_assets_insert_own on storage.objects;
create policy user_assets_insert_own
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'user-assets'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists user_assets_update_own on storage.objects;
create policy user_assets_update_own
on storage.objects
for update
to authenticated
using (
  bucket_id = 'user-assets'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'user-assets'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists user_assets_delete_own on storage.objects;
create policy user_assets_delete_own
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'user-assets'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- ----------------------------
-- thumbnails (private)
-- ----------------------------
drop policy if exists thumbnails_select_own on storage.objects;
create policy thumbnails_select_own
on storage.objects
for select
to authenticated
using (
  bucket_id = 'thumbnails'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists thumbnails_insert_own on storage.objects;
create policy thumbnails_insert_own
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'thumbnails'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists thumbnails_update_own on storage.objects;
create policy thumbnails_update_own
on storage.objects
for update
to authenticated
using (
  bucket_id = 'thumbnails'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'thumbnails'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists thumbnails_delete_own on storage.objects;
create policy thumbnails_delete_own
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'thumbnails'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- ----------------------------
-- published-assets (public read)
-- ----------------------------
drop policy if exists published_assets_select_public on storage.objects;
create policy published_assets_select_public
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'published-assets');

drop policy if exists published_assets_insert_own on storage.objects;
create policy published_assets_insert_own
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'published-assets'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists published_assets_update_own on storage.objects;
create policy published_assets_update_own
on storage.objects
for update
to authenticated
using (
  bucket_id = 'published-assets'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'published-assets'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists published_assets_delete_own on storage.objects;
create policy published_assets_delete_own
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'published-assets'
  and (storage.foldername(name))[1] = auth.uid()::text
);
