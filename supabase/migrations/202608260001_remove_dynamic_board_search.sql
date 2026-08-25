update public.public_collections
set filters = jsonb_set(coalesce(filters, '{}'::jsonb), '{search}', '""'::jsonb, true)
where mode = 'dynamic'
  and coalesce(filters->>'search', '') <> '';
