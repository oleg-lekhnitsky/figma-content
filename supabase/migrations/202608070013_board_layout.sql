alter table public.public_collections
  add column if not exists layout text not null default 'masonry'
  check (layout in ('masonry', 'column', 'presentation'));
