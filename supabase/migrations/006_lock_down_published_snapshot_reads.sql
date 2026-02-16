-- B2 / Migration 006: Lock down published snapshot reads to token-scoped RPC.
-- Prevent broad anon table reads while keeping token-based viewer access.

drop policy if exists published_projects_select_active_public on public.published_projects;

create or replace function public.get_published_snapshot(p_share_token text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select snapshot
  from public.published_projects
  where is_active = true
    and share_token = p_share_token
  limit 1;
$$;

revoke all on function public.get_published_snapshot(text) from public;
grant execute on function public.get_published_snapshot(text) to anon, authenticated;

comment on function public.get_published_snapshot(text) is
  'Returns active published snapshot JSON by share token; used by public viewer.';
