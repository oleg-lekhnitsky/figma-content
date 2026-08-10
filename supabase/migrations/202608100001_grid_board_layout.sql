alter table public.public_collections
  drop constraint if exists public_collections_layout_check;

alter table public.public_collections
  add constraint public_collections_layout_check
  check (layout in ('masonry', 'column', 'presentation', 'grid'));
