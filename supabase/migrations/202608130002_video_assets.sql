alter table public.assets drop constraint if exists assets_mime_type_check;
alter table public.assets add constraint assets_mime_type_check
  check (mime_type in ('image/png', 'image/jpeg', 'video/mp4'));

alter table public.assets drop constraint if exists assets_image_format_check;
alter table public.assets add constraint assets_image_format_check
  check (image_format in ('png', 'jpg', 'mp4'));

alter table public.asset_versions drop constraint if exists asset_versions_mime_type_check;
alter table public.asset_versions add constraint asset_versions_mime_type_check
  check (mime_type in ('image/png', 'image/jpeg', 'video/mp4'));

update storage.buckets
set file_size_limit = 104857600,
    allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp', 'video/mp4']
where id = 'assets';
