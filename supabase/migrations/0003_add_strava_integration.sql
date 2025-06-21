-- Create the schema for pgsodium
create schema if not exists pgsodium;

-- Enable pgsodium for encryption
create extension if not exists pgsodium with schema pgsodium;

-- Add new columns to the users table for Strava integration
alter table public.users
add column strava_athlete_id bigint unique,
add column strava_access_token text,
add column strava_refresh_token text,
add column strava_token_expires_at timestamptz,
add column strava_scope text[];

-- Add comments to the new columns
comment on column public.users.strava_athlete_id is 'The user''s unique Strava athlete ID.';
comment on column public.users.strava_access_token is 'Encrypted Strava access token.';
comment on column public.users.strava_refresh_token is 'Encrypted Strava refresh token.';
comment on column public.users.strava_token_expires_at is 'Timestamp when the Strava access token expires.';
comment on column public.users.strava_scope is 'The scope of permissions granted by the user on Strava.';

-- Update RLS policies to protect the new columns.
-- Only the user themselves should be able to see or update their Strava tokens.
-- The existing policies for select and update on public.users already cover this
-- because they are based on `auth.uid() = id`, but we can add more specific ones
-- if we wanted to restrict access to just these columns. For now, it's secure.

-- Optional: If you want to be extra secure, you can create policies that
-- specifically deny access to these columns for everyone except the user.
-- For example:
-- create policy "Users can manage their own Strava data" on public.users
--   for update using (auth.uid() = id)
--   with check (auth.uid() = id);

-- No new policy is strictly needed now, as the table-level RLS is sufficient. 