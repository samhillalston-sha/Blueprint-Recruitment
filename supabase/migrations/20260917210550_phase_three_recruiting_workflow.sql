-- Phase 3 only. Existing people and candidacies are preserved; no private fixtures.
alter table public.candidacies
 add column stage text not null default 'Unknown Prospect'
   check (stage in ('Unknown Prospect','Known Prospect','Confirmed for Tryouts')),
 add column priority text check (priority in ('High','Medium','Low')),
 add column owner_id uuid references public.profiles(id) on delete restrict,
 add column next_action text check (char_length(next_action) <= 500),
 add column follow_up_date date check (follow_up_date between date '2000-01-01' and date '2100-12-31'),
 add column projection_year_one text check (char_length(projection_year_one) <= 1000),
 add column projection_year_two text check (char_length(projection_year_two) <= 1000),
 add column projection_year_three text check (char_length(projection_year_three) <= 1000),
 add column version integer not null default 1,
 add column updated_at timestamptz not null default now();
create index candidacies_owner_lookup on public.candidacies(owner_id);
create index candidacies_follow_up_lookup on public.candidacies(season_id,follow_up_date) where follow_up_date is not null;
grant update (stage,priority,owner_id,next_action,follow_up_date,projection_year_one,projection_year_two,projection_year_three)
 on public.candidacies to authenticated;
create policy leadership_candidacy_edit on public.candidacies for update to authenticated
 using (exists(select 1 from public.profiles where id=(select auth.uid()) and is_active)
   and exists(select 1 from public.seasons where id=season_id and status='active'))
 with check (exists(select 1 from public.profiles where id=(select auth.uid()) and is_active)
   and exists(select 1 from public.seasons where id=season_id and status='active'));

-- Minimal name directory for ownership. Full profiles (including emails) remain own-only.
-- Privileged lookup is private and checks current approval, not JWT metadata.
create function private.recruiting_leaders()
 returns table(id uuid,full_name text,is_active boolean)
 language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not exists(select 1 from public.profiles p where p.id=auth.uid() and p.is_active) then
  raise exception 'Leadership approval required' using errcode='42501';
 end if;
 return query select p.id,p.full_name,p.is_active from public.profiles p
  where p.is_active or exists(select 1 from public.candidacies c where c.owner_id=p.id)
  order by p.full_name,p.id;
end;
$$;
revoke all on function private.recruiting_leaders() from public,anon,authenticated,service_role;
grant usage on schema private to authenticated;
grant execute on function private.recruiting_leaders() to authenticated;
create function public.recruiting_leaders()
 returns table(id uuid,full_name text,is_active boolean)
 language sql stable security invoker set search_path='' as $$
 select * from private.recruiting_leaders();
$$;
revoke all on function public.recruiting_leaders() from public,anon,authenticated,service_role;
grant execute on function public.recruiting_leaders() to authenticated;

create function private.guard_recruiting_workflow() returns trigger
 language plpgsql security definer set search_path='' as $$
begin
 -- This lookup must see the target owner despite profiles' own-only RLS.
 if current_setting('role',true) in ('authenticated','anon') then
  if auth.uid() is null or not exists(select 1 from public.profiles p where p.id=auth.uid() and p.is_active) then
   raise exception 'Leadership approval required' using errcode='42501';
  end if;
  perform 1 from public.seasons s where s.id=new.season_id and s.status='active' for share;
  if not found then
   raise exception 'Historical seasons are read-only' using errcode='42501';
  end if;
 end if;
 if (tg_op='INSERT' and new.owner_id is not null) or
    (tg_op='UPDATE' and new.owner_id is distinct from old.owner_id and new.owner_id is not null) then
  -- Lock approval against concurrent revocation until the assignment completes.
  perform 1 from public.profiles p where p.id=new.owner_id and p.is_active for share;
  if not found then raise exception 'Owner must be active leadership' using errcode='23514'; end if;
 end if;
 if tg_op='UPDATE' then
  if (to_jsonb(new)-array['updated_at','version']) is distinct from (to_jsonb(old)-array['updated_at','version']) then
   new.version=old.version+1;
   new.updated_at=clock_timestamp();
  else
   new.version=old.version;
   new.updated_at=old.updated_at;
  end if;
 end if;
 return new;
end;
$$;
revoke all on function private.guard_recruiting_workflow() from public,anon,authenticated,service_role;
create trigger candidacy_workflow_guard before insert or update on public.candidacies
 for each row execute function private.guard_recruiting_workflow();

create table public.prospect_activity (
 id uuid primary key default gen_random_uuid(),
 prospect_id uuid not null references public.prospects(id) on delete restrict,
 candidacy_id uuid references public.candidacies(id) on delete restrict,
 season_id uuid references public.seasons(id) on delete restrict,
 actor_id uuid references public.profiles(id) on delete restrict,
 actor_name text not null,
 event_type text not null check (event_type in ('prospect_created','prospect_updated','season_added','workflow_updated')),
 changes jsonb not null check (jsonb_typeof(changes)='object'),
 created_at timestamptz not null default clock_timestamp()
);
create index prospect_activity_timeline on public.prospect_activity(prospect_id,created_at desc,id desc);
create index prospect_activity_candidacy on public.prospect_activity(candidacy_id);
create index prospect_activity_season on public.prospect_activity(season_id);
create index prospect_activity_actor on public.prospect_activity(actor_id);
alter table public.prospect_activity enable row level security;
revoke all on public.prospect_activity from public,anon,authenticated;
grant select on public.prospect_activity to authenticated;
create policy leadership_activity_read on public.prospect_activity for select to authenticated
 using (exists(select 1 from public.profiles where id=(select auth.uid()) and is_active));

-- Only trigger execution can write the timeline. The event and field edit share a transaction.
create function private.log_recruiting_activity() returns trigger
 language plpgsql security definer set search_path='' as $$
declare
 actor uuid:=auth.uid(); author text; fields text[]; field text;
 before_row jsonb:='{}'::jsonb; after_row jsonb:=to_jsonb(new); delta jsonb:='{}'::jsonb;
 person uuid; candidacy uuid; season uuid; kind text; item jsonb;
begin
 if current_setting('role',true) in ('authenticated','anon') and
   (actor is null or not exists(select 1 from public.profiles p where p.id=actor and p.is_active)) then
  raise exception 'Leadership approval required' using errcode='42501';
 end if;
 select coalesce(nullif(p.full_name,''),'Leadership member') into author from public.profiles p where p.id=actor;
 author:=coalesce(author,'Workspace administrator');
 if tg_op='UPDATE' then before_row:=to_jsonb(old); end if;
 if tg_table_name='prospects' then
  person:=new.id;
  kind:=case when tg_op='INSERT' then 'prospect_created' else 'prospect_updated' end;
  fields:=array['full_name','email','phone','social_url','location','teams','age','height_cm','position'];
 else
  person:=new.prospect_id; candidacy:=new.id; season:=new.season_id;
  kind:=case when tg_op='INSERT' then 'season_added' else 'workflow_updated' end;
  fields:=array['stage','priority','owner_id','next_action','follow_up_date','projection_year_one','projection_year_two','projection_year_three'];
 end if;
 foreach field in array fields loop
  if coalesce(before_row->field,'null'::jsonb) is distinct from coalesce(after_row->field,'null'::jsonb) then
   item:=jsonb_build_object('from',before_row->field,'to',after_row->field);
   if field='owner_id' then
    item:=item || jsonb_build_object(
     'from_label',(select coalesce(nullif(p.full_name,''),'Leadership member') from public.profiles p where p.id=(before_row->>field)::uuid),
     'to_label',(select coalesce(nullif(p.full_name,''),'Leadership member') from public.profiles p where p.id=(after_row->>field)::uuid));
   end if;
   delta:=delta || jsonb_build_object(field,item);
  end if;
 end loop;
 if tg_op='UPDATE' and delta='{}'::jsonb then return new; end if;
 insert into public.prospect_activity(prospect_id,candidacy_id,season_id,actor_id,actor_name,event_type,changes)
 values(person,candidacy,season,actor,author,kind,delta);
 return new;
end;
$$;
revoke all on function private.log_recruiting_activity() from public,anon,authenticated,service_role;
create trigger prospect_activity_log after insert or update on public.prospects
 for each row execute function private.log_recruiting_activity();
create trigger candidacy_activity_log after insert or update on public.candidacies
 for each row execute function private.log_recruiting_activity();
-- Do not fabricate retrospective events or overwrite existing user facts/history.
