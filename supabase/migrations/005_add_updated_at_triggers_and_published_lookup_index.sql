-- B2 / Migration 005: Add updated_at triggers and optimized public lookup index.
-- Ensures updated_at reflects real modification time and improves active share-token query performance.

create or replace function public.update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_projects_updated_at on public.projects;
create trigger trg_projects_updated_at
before update on public.projects
for each row
execute function public.update_updated_at_column();

drop trigger if exists trg_published_projects_updated_at on public.published_projects;
create trigger trg_published_projects_updated_at
before update on public.published_projects
for each row
execute function public.update_updated_at_column();

create index if not exists idx_published_projects_active_token
on public.published_projects (share_token)
where is_active = true;
