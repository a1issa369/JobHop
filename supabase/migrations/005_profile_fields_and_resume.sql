-- Adds the profile fields needed for the Settings "Edit profile" section,
-- and the storage policies needed to replace/remove an uploaded resume
-- (the original schema only ever granted insert, so uploading a second
-- resume - which uses upsert, i.e. an UPDATE under the hood - would have
-- been silently blocked by RLS).
alter table profiles
  add column if not exists full_name text check (char_length(full_name) <= 100),
  add column if not exists school text check (char_length(school) <= 100),
  add column if not exists linkedin_url text check (char_length(linkedin_url) <= 200),
  add column if not exists github_url text check (char_length(github_url) <= 200);

create policy "resumes_owner_update"
  on storage.objects for update
  using (bucket_id = 'resumes' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'resumes' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "resumes_owner_delete"
  on storage.objects for delete
  using (bucket_id = 'resumes' and (storage.foldername(name))[1] = auth.uid()::text);
