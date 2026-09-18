-- Seasonal, individually attributed evaluations. No real fixtures or backfill.
create table public.evaluations (
 id uuid primary key default gen_random_uuid(),
 candidacy_id uuid not null references public.candidacies(id) on delete restrict,
 evaluator_id uuid not null default auth.uid() references public.profiles(id) on delete restrict,
 evaluator_name text not null,
 athleticism smallint check (athleticism between 1 and 5),
 offensive_ability smallint check (offensive_ability between 1 and 5),
 defensive_ability smallint check (defensive_ability between 1 and 5),
 coachability smallint check (coachability between 1 and 5),
 on_field_vibes smallint check (on_field_vibes between 1 and 5),
 off_field_vibes smallint check (off_field_vibes between 1 and 5),
 version integer not null default 1,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(candidacy_id,evaluator_id)
);
create index evaluations_evaluator_lookup on public.evaluations(evaluator_id);
alter table public.evaluations enable row level security;
revoke all on public.evaluations from public,anon,authenticated;
grant select on public.evaluations to authenticated;
grant insert (candidacy_id,athleticism,offensive_ability,defensive_ability,coachability,on_field_vibes,off_field_vibes) on public.evaluations to authenticated;
grant update (athleticism,offensive_ability,defensive_ability,coachability,on_field_vibes,off_field_vibes) on public.evaluations to authenticated;
create policy leadership_evaluation_read on public.evaluations for select to authenticated
 using (exists(select 1 from public.profiles where id=(select auth.uid()) and is_active));
create policy own_evaluation_insert on public.evaluations for insert to authenticated
 with check (evaluator_id=(select auth.uid())
  and exists(select 1 from public.profiles where id=(select auth.uid()) and is_active)
  and exists(select 1 from public.candidacies c join public.seasons s on s.id=c.season_id where c.id=candidacy_id and s.status='active'));
create policy own_evaluation_update on public.evaluations for update to authenticated
 using (evaluator_id=(select auth.uid())
  and exists(select 1 from public.profiles where id=(select auth.uid()) and is_active)
  and exists(select 1 from public.candidacies c join public.seasons s on s.id=c.season_id where c.id=candidacy_id and s.status='active'))
 with check (evaluator_id=(select auth.uid())
  and exists(select 1 from public.profiles where id=(select auth.uid()) and is_active)
  and exists(select 1 from public.candidacies c join public.seasons s on s.id=c.season_id where c.id=candidacy_id and s.status='active'));

-- Private trigger privileges are necessary for approval/season locks and trusted names.
create function private.guard_evaluation() returns trigger
 language plpgsql security definer set search_path='' as $$
begin
 if current_setting('role',true) in ('authenticated','anon') then
  if auth.uid() is null or new.evaluator_id<>auth.uid() then
   raise exception 'Only your own evaluation can be changed' using errcode='42501';
  end if;
  perform 1 from public.profiles where id=auth.uid() and is_active for share;
  if not found then raise exception 'Leadership approval required' using errcode='42501';end if;
  perform 1 from public.seasons s join public.candidacies c on c.season_id=s.id
   where c.id=new.candidacy_id and s.status='active' for share of s;
  if not found then raise exception 'Historical seasons are read-only' using errcode='42501';end if;
 end if;
 if tg_op='INSERT' then
  select coalesce(nullif(full_name,''),'Leadership member') into new.evaluator_name from public.profiles where id=new.evaluator_id;
  new.version:=1;new.created_at:=clock_timestamp();new.updated_at:=new.created_at;
 else
  if (to_jsonb(new)-array['updated_at','version']) is distinct from (to_jsonb(old)-array['updated_at','version']) then
   new.version:=old.version+1;new.updated_at:=clock_timestamp();
  else new.version:=old.version;new.updated_at:=old.updated_at;end if;
 end if;
 return new;
end;
$$;
revoke all on function private.guard_evaluation() from public,anon,authenticated,service_role;
create trigger evaluation_guard before insert or update on public.evaluations
 for each row execute function private.guard_evaluation();

alter table public.prospect_activity drop constraint prospect_activity_event_type_check;
alter table public.prospect_activity add constraint prospect_activity_event_type_check check
 (event_type in ('prospect_created','prospect_updated','season_added','workflow_updated','evaluation_submitted','evaluation_updated'));
create function private.log_evaluation() returns trigger
 language plpgsql security definer set search_path='' as $$
declare field text;before_row jsonb:='{}'::jsonb;after_row jsonb:=to_jsonb(new);delta jsonb:='{}'::jsonb;person uuid;season uuid;author text;
begin
 if current_setting('role',true) in ('authenticated','anon') and
  (auth.uid() is null or new.evaluator_id<>auth.uid() or not exists(select 1 from public.profiles where id=auth.uid() and is_active)) then
  raise exception 'Leadership approval required' using errcode='42501';
 end if;
 if tg_op='UPDATE' then before_row:=to_jsonb(old);end if;
 foreach field in array array['athleticism','offensive_ability','defensive_ability','coachability','on_field_vibes','off_field_vibes'] loop
  if tg_op='INSERT' or coalesce(before_row->field,'null'::jsonb) is distinct from coalesce(after_row->field,'null'::jsonb) then
   delta:=delta||jsonb_build_object(field,jsonb_build_object('from',before_row->field,'to',after_row->field));
  end if;
 end loop;
 if tg_op='UPDATE' and delta='{}'::jsonb then return new;end if;
 select c.prospect_id,c.season_id into person,season from public.candidacies c where c.id=new.candidacy_id;
 select coalesce(nullif(full_name,''),'Leadership member') into author from public.profiles where id=new.evaluator_id;
 insert into public.prospect_activity(prospect_id,candidacy_id,season_id,actor_id,actor_name,event_type,changes)
 values(person,new.candidacy_id,season,new.evaluator_id,author,
  case when tg_op='INSERT' then 'evaluation_submitted' else 'evaluation_updated' end,delta);
 return new;
end;
$$;
revoke all on function private.log_evaluation() from public,anon,authenticated,service_role;
create trigger evaluation_activity_log after insert or update on public.evaluations
 for each row execute function private.log_evaluation();

-- One RLS-protected snapshot: all-evaluator averages, bounded comparison, own row.
create function public.evaluation_summary(p_candidacy_id uuid,p_page integer default 1)
 returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare result jsonb;
begin
 if auth.uid() is null or not exists(select 1 from public.profiles where id=auth.uid() and is_active) then
  raise exception 'Leadership approval required' using errcode='42501';
 end if;
 if not exists(select 1 from public.candidacies where id=p_candidacy_id) then
  raise exception 'Season record unavailable' using errcode='22023';
 end if;
 with ratings as materialized (
  select id,candidacy_id,evaluator_id,evaluator_name,athleticism,offensive_ability,defensive_ability,coachability,on_field_vibes,off_field_vibes,version,created_at,updated_at from public.evaluations where candidacy_id=p_candidacy_id
 ), totals as (
  select count(*)::integer as count,greatest(1,least(greatest(1,(count(*)::integer+24)/25),coalesce(p_page,1))) as page from ratings
 ), comparison as (
  select * from ratings order by lower(evaluator_name),evaluator_id
  limit 25 offset (select (page-1)*25 from totals)
 )
 select jsonb_build_object('count',t.count,'page',t.page,
  'rows',coalesce((select jsonb_agg(to_jsonb(comparison) order by lower(evaluator_name),evaluator_id) from comparison),'[]'::jsonb),
  'own',(select to_jsonb(ratings) from ratings where evaluator_id=auth.uid()),
  'averages',(select jsonb_build_object(
'athleticism',jsonb_build_object('mean',round(avg(athleticism),2),'count',count(athleticism),'na',count(*) filter(where athleticism is null)),'offensive_ability',jsonb_build_object('mean',round(avg(offensive_ability),2),'count',count(offensive_ability),'na',count(*) filter(where offensive_ability is null)),'defensive_ability',jsonb_build_object('mean',round(avg(defensive_ability),2),'count',count(defensive_ability),'na',count(*) filter(where defensive_ability is null)),'coachability',jsonb_build_object('mean',round(avg(coachability),2),'count',count(coachability),'na',count(*) filter(where coachability is null)),'on_field_vibes',jsonb_build_object('mean',round(avg(on_field_vibes),2),'count',count(on_field_vibes),'na',count(*) filter(where on_field_vibes is null)),'off_field_vibes',jsonb_build_object('mean',round(avg(off_field_vibes),2),'count',count(off_field_vibes),'na',count(*) filter(where off_field_vibes is null))
  ) from ratings)) into result from totals t;
 return result;
end;
$$;
revoke all on function public.evaluation_summary(uuid,integer) from public,anon,authenticated,service_role;
grant execute on function public.evaluation_summary(uuid,integer) to authenticated;
