-- CLI-created migration, aligned with the hosted migration's recorded version.
-- Phase 1 only. No prospect, candidacy, evaluation, or interaction tables.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  email text,
  is_active boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.seasons (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  year integer not null unique check (year between 2000 and 2100),
  is_current boolean not null default false,
  status text not null check (status in ('active', 'closed')),
  created_at timestamptz not null default now(),
  constraint current_season_is_active check (not is_current or status = 'active')
);
create unique index seasons_one_current on public.seasons (is_current) where is_current;

alter table public.profiles enable row level security;
alter table public.seasons enable row level security;
revoke all on public.profiles, public.seasons from public, anon, authenticated;
grant select on public.profiles, public.seasons to authenticated;

create policy own_profile on public.profiles for select to authenticated
  using (id = (select auth.uid()));
create policy leadership_seasons on public.seasons for select to authenticated
  using (exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and is_active = true
  ));

-- Auth inserts need a privileged trigger because clients cannot create profiles.
-- This trigger-only function is private, has no arguments, and is not an RPC.
-- Never copy an authorization flag from user-editable metadata.
create function private.bootstrap_profile()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name, email, is_active)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''), new.email, false);
  return new;
end;
$$;
revoke all on function private.bootstrap_profile() from public, anon, authenticated, service_role;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.bootstrap_profile();

insert into public.profiles (id, full_name, email, is_active)
select id, coalesce(raw_user_meta_data ->> 'full_name', ''), email, false from auth.users
on conflict (id) do nothing;

insert into public.seasons (name, year, is_current, status) values
  ('2026 Season', 2026, false, 'closed'),
  ('2027 Season', 2027, true, 'active');
