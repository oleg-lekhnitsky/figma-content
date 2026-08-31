alter table public.projects
  add column if not exists created_by uuid references public.allowed_users(id) on delete set null;

update public.projects as project
set created_by = (
  select allowed_user.id
  from public.allowed_users as allowed_user
  where allowed_user.organization_id = project.organization_id
  order by
    allowed_user.is_active desc,
    case allowed_user.role when 'admin' then 0 when 'editor' then 1 else 2 end,
    allowed_user.created_at
  limit 1
)
where project.created_by is null
  and exists (
    select 1
    from public.allowed_users as allowed_user
    where allowed_user.organization_id = project.organization_id
  );

alter table public.public_collections
  add column if not exists source_project_id uuid;

alter table public.public_collections
  drop constraint if exists public_collections_source_project_id_fkey;

alter table public.public_collections
  add constraint public_collections_source_project_id_fkey
  foreign key (source_project_id, organization_id)
  references public.projects(id, organization_id)
  on delete cascade;

create unique index if not exists public_collections_source_project_idx
  on public.public_collections(source_project_id)
  where source_project_id is not null;

create or replace function public.project_board_filters(project_id uuid)
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object(
    'search', '',
    'projectId', project_id,
    'tagId', null,
    'projectIds', jsonb_build_array(project_id),
    'tagIds', '[]'::jsonb,
    'uploadedBy', null,
    'dateFrom', null,
    'dateTo', null
  );
$$;

create or replace function public.create_linked_project_board()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  board_id uuid;
begin
  if new.created_by is null then
    return new;
  end if;

  insert into public.public_collections (
    organization_id,
    created_by,
    title,
    purpose,
    mode,
    filters,
    publication_enabled,
    content_strategy,
    source_project_id
  ) values (
    new.organization_id,
    new.created_by,
    new.name,
    'showcase',
    'dynamic',
    public.project_board_filters(new.id),
    false,
    'dynamic',
    new.id
  )
  on conflict (source_project_id) where source_project_id is not null do nothing
  returning id into board_id;

  if board_id is not null then
    insert into public.public_collection_members (
      collection_id,
      organization_id,
      user_id,
      role,
      invited_by
    ) values (
      board_id,
      new.organization_id,
      new.created_by,
      'owner',
      new.created_by
    ) on conflict (collection_id, user_id) do update set role = 'owner';
  end if;

  return new;
end;
$$;

create or replace function public.sync_linked_project_board()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.public_collections
  set
    title = new.name,
    filters = public.project_board_filters(new.id),
    publication_enabled = case when new.archived_at is not null then false else publication_enabled end,
    revoked_at = case when new.archived_at is not null then coalesce(revoked_at, now()) else revoked_at end
  where source_project_id = new.id
    and organization_id = new.organization_id;
  return new;
end;
$$;

drop trigger if exists projects_create_linked_board on public.projects;
create trigger projects_create_linked_board
  after insert on public.projects
  for each row execute function public.create_linked_project_board();

drop trigger if exists projects_sync_linked_board on public.projects;
create trigger projects_sync_linked_board
  after update of name, archived_at on public.projects
  for each row execute function public.sync_linked_project_board();

with matching_existing_board as (
  select distinct on (project.id)
    project.id as project_id,
    collection.id as collection_id
  from public.projects as project
  join public.public_collections as collection
    on collection.organization_id = project.organization_id
    and collection.title = project.name
    and collection.purpose = 'showcase'
    and collection.mode = 'dynamic'
    and collection.source_project_id is null
  where coalesce(collection.filters ->> 'search', '') = ''
    and coalesce(collection.filters -> 'tagIds', '[]'::jsonb) = '[]'::jsonb
    and coalesce(collection.filters ->> 'tagId', '') = ''
    and coalesce(collection.filters ->> 'uploadedBy', '') = ''
    and coalesce(collection.filters ->> 'dateFrom', '') = ''
    and coalesce(collection.filters ->> 'dateTo', '') = ''
    and coalesce(collection.filters -> 'projectIds', '[]'::jsonb) in ('[]'::jsonb, jsonb_build_array(project.id))
    and coalesce(collection.filters ->> 'projectId', project.id::text) = project.id::text
    and (
      collection.filters ->> 'projectId' = project.id::text
      or collection.filters -> 'projectIds' = jsonb_build_array(project.id)
    )
  order by project.id, collection.created_at
)
update public.public_collections as collection
set
  source_project_id = matching.project_id,
  filters = public.project_board_filters(matching.project_id),
  content_strategy = 'dynamic'
from matching_existing_board as matching
where collection.id = matching.collection_id;

insert into public.public_collections (
  organization_id,
  created_by,
  title,
  purpose,
  mode,
  filters,
  publication_enabled,
  content_strategy,
  source_project_id,
  created_at,
  updated_at
)
select
  project.organization_id,
  project.created_by,
  project.name,
  'showcase',
  'dynamic',
  public.project_board_filters(project.id),
  false,
  'dynamic',
  project.id,
  project.created_at,
  project.created_at
from public.projects as project
where project.created_by is not null
  and not exists (
    select 1
    from public.public_collections as collection
    where collection.source_project_id = project.id
  );

insert into public.public_collection_members (
  collection_id,
  organization_id,
  user_id,
  role,
  invited_by
)
select
  collection.id,
  collection.organization_id,
  collection.created_by,
  'owner',
  collection.created_by
from public.public_collections as collection
where collection.source_project_id is not null
on conflict (collection_id, user_id) do update set role = 'owner';

update public.public_collections as collection
set
  publication_enabled = false,
  revoked_at = coalesce(collection.revoked_at, now())
from public.projects as project
where collection.source_project_id = project.id
  and project.archived_at is not null;
