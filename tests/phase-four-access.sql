-- Synthetic seasons, accounts and prospects only. Every fixture rolls back.
begin;
select set_config('blueprint.test.active_id',gen_random_uuid()::text,true);
select set_config('blueprint.test.inactive_id',gen_random_uuid()::text,true);
select set_config('blueprint.test.missing_id',gen_random_uuid()::text,true);
insert into auth.users(id,email,raw_user_meta_data) values
 (current_setting('blueprint.test.active_id')::uuid,'synthetic-phase4-active@example.com','{"full_name":"Synthetic Dashboard Captain"}'),
 (current_setting('blueprint.test.inactive_id')::uuid,'synthetic-phase4-inactive@example.com','{"is_active":true}');
update public.profiles set is_active=true where id=current_setting('blueprint.test.active_id')::uuid;
-- Choose unused years without changing existing seasons.
insert into public.seasons(name,year,status)
 select 'Synthetic Phase4 '||y,y,'active' from generate_series(2100,2000,-1) y
 where not exists(select 1 from public.seasons where year=y) limit 2;
select set_config('blueprint.test.season_id',(select id::text from public.seasons where name like 'Synthetic Phase4 %' order by year desc limit 1),true);
select set_config('blueprint.test.closed_id',(select id::text from public.seasons where name like 'Synthetic Phase4 %' order by year asc limit 1),true);
update public.seasons set status='closed' where id=current_setting('blueprint.test.closed_id')::uuid;
select set_config('request.jwt.claim.sub',current_setting('blueprint.test.active_id'),true);
select set_config('request.jwt.claims',json_build_object('sub',current_setting('blueprint.test.active_id'),'role','authenticated')::text,true);
set local role authenticated;
do $$ declare person uuid;i integer;today date:=(statement_timestamp() at time zone 'UTC')::date;begin
 for i in 0..15 loop
  person:=public.create_prospect(current_setting('blueprint.test.season_id')::uuid,jsonb_build_object('full_name','Synthetic Dashboard '||lpad(i::text,2,'0')));
  if i=0 then perform set_config('blueprint.test.prospect_id',person::text,true);end if;
  update public.candidacies set
   stage=(array['Unknown Prospect','Known Prospect','Confirmed for Tryouts'])[i%3+1],
   owner_id=case when i<2 then null else current_setting('blueprint.test.active_id')::uuid end,
   next_action=case when i=0 then null when i=1 then '' when i=2 then E' \t\n ' else 'Synthetic action '||i end,
   follow_up_date=case when i<13 then today-1 when i=13 then today when i=14 then today+1 else null end
   where prospect_id=person and season_id=current_setting('blueprint.test.season_id')::uuid;
 end loop;
 update public.prospects set location='Synthetic shared city' where id=current_setting('blueprint.test.prospect_id')::uuid;
end $$;
reset role;
insert into public.candidacies(prospect_id,season_id,created_by,stage,next_action)
 values(current_setting('blueprint.test.prospect_id')::uuid,current_setting('blueprint.test.closed_id')::uuid,current_setting('blueprint.test.active_id')::uuid,'Confirmed for Tryouts','Synthetic historical action');
insert into public.prospects(full_name,created_by) values('Synthetic historical-only person',current_setting('blueprint.test.active_id')::uuid);
insert into public.candidacies(prospect_id,season_id,created_by)
 select id,current_setting('blueprint.test.closed_id')::uuid,current_setting('blueprint.test.active_id')::uuid from public.prospects where full_name='Synthetic historical-only person' and created_by=current_setting('blueprint.test.active_id')::uuid;
set local role authenticated;
do $$ declare dashboard jsonb;queue text;before_count integer;begin
 select count(*) into before_count from public.prospect_activity where prospect_id=current_setting('blueprint.test.prospect_id')::uuid;
 dashboard:=public.recruiting_dashboard(current_setting('blueprint.test.season_id')::uuid);
 if dashboard->'stages'<>'[6,5,5]'::jsonb then raise exception 'Wrong season stage counts';end if;
 if (dashboard#>>'{queues,overdue,count}')::integer<>13 or (dashboard#>>'{queues,upcoming,count}')::integer<>2 then raise exception 'UTC date boundary incorrect';end if;
 if (dashboard#>>'{queues,owners,count}')::integer<>2 or (dashboard#>>'{queues,actions,count}')::integer<>3 then raise exception 'Missing owner/whitespace action incorrect';end if;
 if (dashboard#>>'{activity,count}')::integer<>49 then raise exception 'Season/shared activity isolation incorrect';end if;
 if jsonb_array_length(dashboard#>'{queues,overdue,rows}')<>10 or jsonb_array_length(dashboard#>'{activity,rows}')<>10 then raise exception 'Unbounded dashboard page';end if;
 for queue in select value from jsonb_array_elements_text('["overdue","upcoming","owners","actions"]') loop
  if exists(select 1 from jsonb_array_elements(dashboard#>array['queues',queue,'rows']) r where r->>'full_name'='Synthetic historical-only person') then raise exception 'Other-season prospect leaked';end if;
 end loop;
 dashboard:=public.recruiting_dashboard(current_setting('blueprint.test.season_id')::uuid,'{"overdue":2,"activity":2}');
 if jsonb_array_length(dashboard#>'{queues,overdue,rows}')<>3 or dashboard#>>'{queues,overdue,page}'<>'2' or dashboard#>>'{activity,page}'<>'2' then raise exception 'Pagination lost rows';end if;
 dashboard:=public.recruiting_dashboard(current_setting('blueprint.test.season_id')::uuid,'{"overdue":999999,"activity":"bad","owners":-1,"actions":9999999999999999999}');
 if dashboard#>>'{queues,overdue,page}'<>'2' or dashboard#>>'{activity,page}'<>'1' or dashboard#>>'{queues,actions,page}'<>'1' then raise exception 'Page inputs not bounded/clamped';end if;
 dashboard:=public.recruiting_dashboard(current_setting('blueprint.test.closed_id')::uuid);
 if dashboard->'stages'<>'[1,0,1]'::jsonb or dashboard#>>'{activity,count}'<>'5' then raise exception 'Historical dashboard isolated incorrectly';end if;
 if (select count(*) from public.profiles)<>1 then raise exception 'Profile access widened';end if;
 if (select count(*) from public.prospect_activity where prospect_id=current_setting('blueprint.test.prospect_id')::uuid)<>before_count then raise exception 'Dashboard writes activity';end if;
 begin perform public.recruiting_dashboard(gen_random_uuid());raise exception 'Unavailable season accepted';exception when invalid_parameter_value then null;end;
end $$;
reset role;
do $$ declare identity text;begin
 foreach identity in array array[current_setting('blueprint.test.inactive_id'),current_setting('blueprint.test.missing_id')] loop
  perform set_config('request.jwt.claim.sub',identity,true);
  perform set_config('request.jwt.claims',json_build_object('sub',identity,'role','authenticated')::text,true);
  set local role authenticated;
  begin perform public.recruiting_dashboard(current_setting('blueprint.test.season_id')::uuid);raise exception 'Unapproved dashboard access';exception when insufficient_privilege then null;end;
  reset role;
 end loop;
end $$;
update public.profiles set is_active=false where id=current_setting('blueprint.test.active_id')::uuid;
select set_config('request.jwt.claim.sub',current_setting('blueprint.test.active_id'),true);
select set_config('request.jwt.claims',json_build_object('sub',current_setting('blueprint.test.active_id'),'role','authenticated')::text,true);
set local role authenticated;
do $$ begin
 begin perform public.recruiting_dashboard(current_setting('blueprint.test.season_id')::uuid);raise exception 'Revoked leadership allowed';exception when insufficient_privilege then null;end;
end $$;
reset role;
set local role anon;
do $$ begin
 begin perform public.recruiting_dashboard(current_setting('blueprint.test.season_id')::uuid);raise exception 'Anonymous dashboard allowed';exception when insufficient_privilege then null;end;
end $$;
reset role;
do $$ begin
 if exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='recruiting_dashboard' and p.prosecdef) then raise exception 'Dashboard bypasses caller RLS';end if;
end $$;
select 'Phase 4 dashboard access, counts, pagination and history passed; fixtures rolled back.' as verification;
rollback;
