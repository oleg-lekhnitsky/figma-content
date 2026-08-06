alter table public.assets
  add column if not exists thumbnail_2x_path text;

alter table public.asset_versions
  add column if not exists thumbnail_2x_path text;
