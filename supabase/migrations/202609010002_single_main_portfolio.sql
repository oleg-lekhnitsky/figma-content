with ranked_main_portfolios as (
  select
    id,
    row_number() over (
      partition by organization_id
      order by created_at asc, id asc
    ) as edition_number
  from public.public_collections
  where purpose = 'portfolio'
    and portfolio_kind = 'main'
)
update public.public_collections as collections
set
  portfolio_kind = 'client',
  portfolio_client = coalesce(nullif(collections.portfolio_client, ''), collections.title)
from ranked_main_portfolios
where collections.id = ranked_main_portfolios.id
  and ranked_main_portfolios.edition_number > 1;

create unique index if not exists public_collections_one_main_portfolio_per_organization
  on public.public_collections (organization_id)
  where purpose = 'portfolio'
    and portfolio_kind = 'main';
