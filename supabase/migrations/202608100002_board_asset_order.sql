alter table public.public_collection_assets
  add column if not exists position integer;

with ranked as (
  select collection_id, asset_id,
    row_number() over (partition by collection_id order by created_at, asset_id) - 1 as position
  from public.public_collection_assets
)
update public.public_collection_assets as items
set position = ranked.position
from ranked
where items.collection_id = ranked.collection_id
  and items.asset_id = ranked.asset_id
  and items.position is null;

create index if not exists public_collection_assets_position_idx
  on public.public_collection_assets(collection_id, position);
