-- Phase 2: persistent people and independent season membership. No private data.
create table public.prospects (
 id uuid primary key default gen_random_uuid(),
 full_name text not null check (char_length(btrim(full_name)) between 1 and 120),
 normalized_name text generated always as (lower(regexp_replace(btrim(full_name), '\s+', ' ', 'g'))) stored,
 email text check (char_length(email) <= 254),
 phone text check (char_length(phone) <= 40),
 social_url text check (char_length(social_url) <= 500 and social_url ~ '^https?://'),
 location text check (char_length(location) <= 120),
 teams text check (char_length(teams) <= 500),
 age integer check (age between 16 and 100),
 height_cm integer check (height_cm between 100 and 250),
 position text check (position in ('Handler','Cutter')),
 created_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index prospects_name_lookup on public.prospects(normalized_name);
create table public.candidacies (
 id uuid primary key default gen_random_uuid(),
 prospect_id uuid not null references public.prospects(id) on delete restrict,
 season_id uuid not null references public.seasons(id) on delete restrict,
 created_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
 created_at timestamptz not null default now(),
 unique(prospect_id, season_id)
);
create index candidacies_season_lookup on public.candidacies(season_id);
create index candidacies_author_lookup on public.candidacies(created_by);
create index prospects_author_lookup on public.prospects(created_by);
alter table public.prospects enable row level security;
alter table public.candidacies enable row level security;
revoke all on public.prospects, public.candidacies from public, anon, authenticated;
grant select on public.prospects, public.candidacies to authenticated;
grant insert (full_name,email,phone,social_url,location,teams,age,height_cm,position) on public.prospects to authenticated;
grant insert (prospect_id,season_id) on public.candidacies to authenticated;
grant update (full_name,email,phone,social_url,location,teams,age,height_cm,position) on public.prospects to authenticated;
create policy leadership_prospect_read on public.prospects for select to authenticated using (
 exists(select 1 from public.profiles where id=(select auth.uid()) and is_active)
);
create policy leadership_prospect_create on public.prospects for insert to authenticated with check (
 created_by=(select auth.uid()) and exists(select 1 from public.profiles where id=(select auth.uid()) and is_active)
);
create policy leadership_prospect_edit on public.prospects for update to authenticated using (
 exists(select 1 from public.profiles where id=(select auth.uid()) and is_active)
) with check (exists(select 1 from public.profiles where id=(select auth.uid()) and is_active));
create policy leadership_candidacy_read on public.candidacies for select to authenticated using (
 exists(select 1 from public.profiles where id=(select auth.uid()) and is_active)
);
create policy leadership_candidacy_create on public.candidacies for insert to authenticated with check (
 created_by=(select auth.uid()) and exists(select 1 from public.profiles where id=(select auth.uid()) and is_active)
 and exists(select 1 from public.seasons where id=season_id and status='active')
);
create function private.touch_prospect() returns trigger language plpgsql set search_path='' as $$
begin new.updated_at=now(); return new; end;
$$;
revoke all on function private.touch_prospect() from public,anon,authenticated,service_role;
create trigger prospect_updated before update on public.prospects for each row execute function private.touch_prospect();
-- Invoker RPC: RLS and column grants still apply; person + candidacy are atomic.
create function public.create_prospect(p_season_id uuid, p_facts jsonb) returns uuid
language plpgsql security invoker set search_path='' as $$
declare person_id uuid;
begin
 insert into public.prospects(full_name,email,phone,social_url,location,teams,age,height_cm,position)
 values(p_facts->>'full_name',p_facts->>'email',p_facts->>'phone',p_facts->>'social_url',
 p_facts->>'location',p_facts->>'teams',(p_facts->>'age')::integer,(p_facts->>'height_cm')::integer,p_facts->>'position')
 returning id into person_id;
 insert into public.candidacies(prospect_id,season_id) values(person_id,p_season_id);
 return person_id;
end;
$$;
revoke all on function public.create_prospect(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.create_prospect(uuid,jsonb) to authenticated;
