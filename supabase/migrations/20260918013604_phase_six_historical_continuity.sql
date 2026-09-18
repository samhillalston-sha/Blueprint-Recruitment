-- Phase 6: preserve existing seasons, people, evaluations and unknown outcomes.
alter table public.candidacies add column outcome text check (outcome in
 ('Still Active','Rostered','Practice Player','Cut–Encourage to Return','Cut–Closed','Withdrew/Chose Another Team','Did Not Attend'));
grant update (outcome) on public.candidacies to authenticated;
alter table public.seasons
 add column closed_at timestamptz,
 add column closed_by uuid references public.profiles(id) on delete restrict,
 add column closed_by_name text,
 add constraint season_closure_metadata check (
  (closed_at is null and closed_by is null and closed_by_name is null) or
  (status='closed' and not is_current and closed_at is not null and closed_by is not null and closed_by_name is not null));
create index seasons_closed_by_lookup on public.seasons(closed_by);
-- Legacy closed seasons retain unknown closure dates/authors. No retrospective events.
create or replace function private.log_recruiting_activity() returns trigger
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
  fields:=array['outcome','stage','priority','owner_id','next_action','follow_up_date','projection_year_one','projection_year_two','projection_year_three'];
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

-- Direct season writes remain revoked. Small guarded private helpers perform only
-- the permitted transitions; public RPCs are invoker wrappers, never generic edits.
create function private.start_season(p_year integer) returns uuid
 language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); result uuid;
begin
 perform 1 from public.profiles p where p.id=actor and p.is_active for share;
 if actor is null or not found then raise exception 'Leadership approval required' using errcode='42501'; end if;
 -- Serialize season management and the unique current-season transition.
 perform pg_catalog.pg_advisory_xact_lock(621840601);
 if p_year is null or p_year < 2000 or p_year > 2100 then
  raise exception 'Season year must be between 2000 and 2100' using errcode='23514';
 end if;
 if exists(select 1 from public.seasons s where s.year>=p_year) then
  raise exception 'Choose a year after the latest existing season' using errcode='23514';
 end if;
 update public.seasons set is_current=false where is_current;
 insert into public.seasons(name,year,is_current,status)
 values(p_year::text || ' Season',p_year,true,'active') returning id into result;
 return result;
end;
$$;
create function private.close_season(p_season_id uuid,p_confirm_year integer) returns uuid
 language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); author text; target public.seasons%rowtype;
begin
 select coalesce(nullif(p.full_name,''),'Leadership member') into author
 from public.profiles p where p.id=actor and p.is_active for share;
 if actor is null or not found then raise exception 'Leadership approval required' using errcode='42501'; end if;
 perform pg_catalog.pg_advisory_xact_lock(621840601);
 -- Candidacy and evaluation guards hold SHARE on this same row. A closure
 -- waits for in-flight writes and all later writes reject the closed season.
 select * into target from public.seasons s where s.id=p_season_id for update;
 if not found then raise exception 'Season unavailable' using errcode='22023'; end if;
 if p_confirm_year is distinct from target.year then
  raise exception 'Confirm the exact season year' using errcode='22023';
 end if;
 if target.status='closed' then return target.id; end if;
 update public.seasons set status='closed',is_current=false,
  closed_at=clock_timestamp(),closed_by=actor,closed_by_name=author where id=target.id;
 return target.id;
end;
$$;
revoke all on function private.start_season(integer) from public,anon,authenticated,service_role;
revoke all on function private.close_season(uuid,integer) from public,anon,authenticated,service_role;
grant execute on function private.start_season(integer),private.close_season(uuid,integer) to authenticated;
create function public.start_season(p_year integer) returns uuid
 language sql security invoker set search_path='' as $$ select private.start_season(p_year); $$;
create function public.close_season(p_season_id uuid,p_confirm_year integer) returns uuid
 language sql security invoker set search_path='' as $$ select private.close_season(p_season_id,p_confirm_year); $$;
revoke all on function public.start_season(integer) from public,anon,authenticated,service_role;
revoke all on function public.close_season(uuid,integer) from public,anon,authenticated,service_role;
grant execute on function public.start_season(integer),public.close_season(uuid,integer) to authenticated;
