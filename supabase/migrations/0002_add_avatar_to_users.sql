alter table public.users
add column avatar_url text;

-- Allow users to see the new avatar_url column.
-- The existing "Users can see their own profile" policy should cover this
-- as it allows select on the whole table.

-- Allow users to update their own avatar_url.
-- The existing "Users can update their own profile" policy should also cover this.
-- It might be a good idea to create a more specific policy if needed, but for now it's fine.

-- Let's create a storage bucket for avatars.
-- We will assume the bucket is public for simplicity, but for a real app,
-- you'd want to set up proper access controls.
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

comment on column public.users.avatar_url is 'URL to the user''s avatar image in Supabase Storage.'; 