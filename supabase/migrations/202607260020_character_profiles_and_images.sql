-- PAYAW player-editable character profiles and private character images.
-- The character data itself remains inside each safe player projection. This
-- migration only grants players access to their own image folder in the
-- existing private payaw-player-assets bucket.

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values (
  'payaw-player-assets',
  'payaw-player-assets',
  false,
  26214400,
  array['image/png','image/jpeg','image/webp','image/gif','audio/mpeg','audio/ogg','application/pdf','text/plain']
)
on conflict(id) do update set
  public=false,
  file_size_limit=excluded.file_size_limit,
  allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists "players upload own character images" on storage.objects;
drop policy if exists "players update own character images" on storage.objects;
drop policy if exists "players delete own character images" on storage.objects;

create policy "players upload own character images"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'payaw-player-assets'
  and private.is_campaign_member(((storage.foldername(name))[1])::uuid)
  and (storage.foldername(name))[2] = auth.uid()::text
  and (storage.foldername(name))[3] = 'character'
);

create policy "players update own character images"
on storage.objects for update to authenticated
using (
  bucket_id = 'payaw-player-assets'
  and private.is_campaign_member(((storage.foldername(name))[1])::uuid)
  and (storage.foldername(name))[2] = auth.uid()::text
  and (storage.foldername(name))[3] = 'character'
)
with check (
  bucket_id = 'payaw-player-assets'
  and private.is_campaign_member(((storage.foldername(name))[1])::uuid)
  and (storage.foldername(name))[2] = auth.uid()::text
  and (storage.foldername(name))[3] = 'character'
);

create policy "players delete own character images"
on storage.objects for delete to authenticated
using (
  bucket_id = 'payaw-player-assets'
  and private.is_campaign_member(((storage.foldername(name))[1])::uuid)
  and (storage.foldername(name))[2] = auth.uid()::text
  and (storage.foldername(name))[3] = 'character'
);

notify pgrst, 'reload schema';
