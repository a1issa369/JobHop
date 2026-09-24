-- Run this in the Supabase SQL editor if you already ran the original
-- schema.sql and are seeing "permission denied for table X" errors, or
-- want to drop the recruiter fields that were removed from the app.

-- Fix: RLS policies alone don't grant table access. Postgres checks
-- table-level privileges first, separately from RLS. Without these grants,
-- every query returns "permission denied" no matter how permissive the
-- RLS policies are.
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to anon, authenticated;
grant usage, select on all sequences in schema public to anon, authenticated;
alter default privileges in schema public
  grant select, insert, update, delete on tables to anon, authenticated;
alter default privileges in schema public
  grant usage, select on sequences to anon, authenticated;

-- Drop the recruiter fields (removed from the app UI).
alter table applications drop column if exists recruiter_name;
alter table applications drop column if exists recruiter_contact;
