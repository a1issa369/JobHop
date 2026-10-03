-- Adds job location + work type (remote/hybrid/onsite) to applications, and
-- sets up a public "avatars" storage bucket so Settings can upload an actual
-- profile picture instead of only entering text fields.

alter table applications
  add column if not exists location text check (char_length(location) <= 100),
  add column if not exists work_type text check (work_type in ('remote', 'hybrid', 'onsite'));

-- Public bucket: unlike resumes, avatar images aren't sensitive, so they're
-- served straight from a public URL rather than needing a signed URL on
-- every page load.
insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true)
  on conflict (id) do update set public = true;

create policy "avatars_owner_write"
  on storage.objects for insert
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- Needed to replace an existing avatar (upload with upsert).
create policy "avatars_owner_update"
  on storage.objects for update
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "avatars_owner_delete"
  on storage.objects for delete
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- Public bucket flag handles the public URL endpoint, but the storage API
-- itself still checks RLS for direct object reads - so this grants that
-- read to everyone, not just the owner or friends (an avatar isn't private).
create policy "avatars_public_read"
  on storage.objects for select
  using (bucket_id = 'avatars');
