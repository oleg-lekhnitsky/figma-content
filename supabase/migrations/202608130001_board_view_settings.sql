alter table public.public_collections
  add column if not exists view_settings jsonb not null default '{"showText":true,"radius":"default","gap":"default","columns":"auto"}'::jsonb;
