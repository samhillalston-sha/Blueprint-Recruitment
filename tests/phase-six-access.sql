-- Synthetic permissions/continuity checks only. All mutations roll back.
begin;
select set_config('blueprint.test.actor',gen_random_uuid()::text,true);
select set_config('blueprint.test.inactive',gen_random_uuid()::text,true);
insert into auth.users(id,email,raw_user_meta_data) values
 (current_setting('blueprint.test.actor')::uuid,'synthetic-phase6@example.com','{"full_name":"Synthetic Phase6 Leader"}'),
 (current_setting('blueprint.test.inactive')::uuid,'synthetic-phase6-inactive@example.com','{"is_active":true}');
update public.profiles set is_active=true where id=current_setting('blueprint.test.actor')::uuid;
select set_config('blueprint.test.year',(select (coalesce(max(year),1999)+1)::text from public.seasons),true);
select set_config('request.jwt.claim.sub',current_setting('blueprint.test.actor'),true);
select set_config('request.jwt.claims',json_build_object('sub',current_setting('blueprint.test.actor'),'role','authenticated')::text,true);
set local role authenticated;
select set_config('blueprint.test.season',public.start_season(current_setting('blueprint.test.year')::integer)::text,true);
select set_config('blueprint.test.person',public.create_prospect(current_setting('blueprint.test.season')::uuid,'{"full_name":"Synthetic Phase6 Player"}')::text,true);
select set_config('blueprint.test.candidacy',(select id::text from public.candidacies where prospect_id=current_setting('blueprint.test.person')::uuid),true);
do $$ declare c public.candidacies;n integer;item text;begin
 select * into c from public.candidacies where id=current_setting('blueprint.test.candidacy')::uuid;
 if c.outcome is not null or c.stage<>'Unknown Prospect' then raise exception 'New season invented defaults';end if;
 foreach item in array array['Still Active','Rostered','Practice Player','Cut–Encourage to Return','Cut–Closed','Withdrew/Chose Another Team','Did Not Attend'] loop
  update public.candidacies set outcome=item where id=c.id;
 end loop;
 select * into c from public.candidacies where id=c.id;
 if c.version<>8 or c.stage<>'Unknown Prospect' then raise exception 'Outcomes altered stages or did not version';end if;
 if not exists(select 1 from public.prospect_activity where candidacy_id=c.id and actor_id=auth.uid() and actor_name='Synthetic Phase6 Leader' and changes#>>'{outcome,to}'='Did Not Attend') then raise exception 'Outcome not atomically attributed';end if;
 select count(*) into n from public.prospect_activity where candidacy_id=c.id;
 update public.candidacies set outcome=c.outcome where id=c.id;
 if (select version from public.candidacies where id=c.id)<>8 or (select count(*) from public.prospect_activity where candidacy_id=c.id)<>n then raise exception 'No-op outcome changed history';end if;
 update public.candidacies set outcome='Rostered' where id=c.id and version=1;
 if found then raise exception 'Stale outcome overwrote history';end if;
 begin update public.candidacies set outcome='Confirmed for Tryouts' where id=c.id;raise exception 'Stage accepted as outcome';exception when check_violation then null;end;
 begin update public.seasons set status='closed' where id=c.season_id;raise exception 'Direct season write permitted';exception when insufficient_privilege then null;end;
 begin insert into public.seasons(name,year) values('Forged Season',2000);raise exception 'Direct season insert permitted';exception when insufficient_privilege then null;end;
 begin delete from public.seasons where id=c.season_id;raise exception 'Season deletion permitted';exception when insufficient_privilege then null;end;
 begin perform public.close_season(c.season_id,1999);raise exception 'Wrong confirmation allowed';exception when invalid_parameter_value then null;end;
 begin perform public.start_season(current_setting('blueprint.test.year')::integer);raise exception 'Season reused/reopened';exception when check_violation then null;end;
 begin perform public.start_season(2101);raise exception 'Out-of-range year allowed';exception when check_violation then null;end;
 update public.candidacies set stage='Confirmed for Tryouts',owner_id=auth.uid(),priority='High',next_action='Synthetic previous action',projection_year_one='Synthetic previous outlook' where id=c.id;
 insert into public.evaluations(candidacy_id,athleticism) values(c.id,5);
end $$;
select set_config('blueprint.test.new_season',public.start_season(current_setting('blueprint.test.year')::integer+1)::text,true);
do $$ begin
 if not exists(select 1 from public.seasons where id=current_setting('blueprint.test.new_season')::uuid and is_current and status='active') then raise exception 'New current season missing';end if;
 if not exists(select 1 from public.seasons where id=current_setting('blueprint.test.season')::uuid and not is_current and status='active') then raise exception 'Starting new season silently closed older season';end if;
end $$;
select public.close_season(current_setting('blueprint.test.season')::uuid,current_setting('blueprint.test.year')::integer);
do $$ declare s public.seasons;c public.candidacies;stamp timestamptz;begin
 select * into s from public.seasons where id=current_setting('blueprint.test.season')::uuid;
 if s.status<>'closed' or s.is_current or s.closed_at is null or s.closed_by<>auth.uid() or s.closed_by_name<>'Synthetic Phase6 Leader' then raise exception 'Closure metadata not trusted';end if;
 stamp:=s.closed_at;
 perform public.close_season(s.id,s.year);
 if (select closed_at from public.seasons where id=s.id)<>stamp then raise exception 'Repeated closure rewrote author/time';end if;
 select * into c from public.candidacies where id=current_setting('blueprint.test.candidacy')::uuid;
 update public.candidacies set outcome='Rostered',stage='Unknown Prospect' where id=c.id;
 if found then raise exception 'Closed candidacy edited';end if;
 update public.evaluations set athleticism=1 where candidacy_id=c.id;
 if found then raise exception 'Closed evaluation edited';end if;
 begin insert into public.candidacies(prospect_id,season_id) values(c.prospect_id,s.id);raise exception 'Closed membership inserted';exception when insufficient_privilege then null;end;
 if (public.evaluation_summary(c.id)#>>'{averages,athleticism,mean}')<>'5.00' then raise exception 'Closed evaluation lost';end if;
 insert into public.candidacies(prospect_id,season_id) values(c.prospect_id,current_setting('blueprint.test.new_season')::uuid);
 if not exists(select 1 from public.candidacies where prospect_id=c.prospect_id and season_id=current_setting('blueprint.test.new_season')::uuid and stage='Unknown Prospect' and outcome is null and owner_id is null and priority is null and next_action is null and follow_up_date is null and projection_year_one is null and projection_year_two is null and projection_year_three is null and version=1) then raise exception 'New membership copied previous fields';end if;
 if exists(select 1 from public.evaluations e join public.candidacies fresh on fresh.id=e.candidacy_id where fresh.season_id=current_setting('blueprint.test.new_season')::uuid) then raise exception 'Evaluations copied';end if;
 if not exists(select 1 from public.candidacies where id=c.id and outcome='Did Not Attend' and stage='Confirmed for Tryouts' and next_action='Synthetic previous action') then raise exception 'Previous membership changed';end if;
 begin insert into public.candidacies(prospect_id,season_id) values(c.prospect_id,current_setting('blueprint.test.new_season')::uuid);raise exception 'Duplicate membership allowed';exception when unique_violation then null;end;
 begin update public.candidacies set season_id=current_setting('blueprint.test.new_season')::uuid where id=c.id;raise exception 'History moved';exception when insufficient_privilege then null;end;
 begin delete from public.candidacies where id=c.id;raise exception 'History deleted';exception when insufficient_privilege then null;end;
 -- Shared person facts remain current across memberships.
 update public.prospects set location='Synthetic current shared location' where id=c.prospect_id;
 if not found then raise exception 'Shared facts could not update in active context';end if;
end $$;
reset role;
update public.profiles set is_active=false where id=current_setting('blueprint.test.actor')::uuid;
set local role authenticated;
do $$ begin
 if exists(select 1 from public.candidacies where prospect_id=current_setting('blueprint.test.person')::uuid) then raise exception 'Revoked leader read history';end if;
 begin perform public.close_season(current_setting('blueprint.test.new_season')::uuid,current_setting('blueprint.test.year')::integer+1);raise exception 'Revoked leader closed season';exception when insufficient_privilege then null;end;
 begin perform private.start_season(current_setting('blueprint.test.year')::integer+2);raise exception 'Private helper bypassed approval';exception when insufficient_privilege then null;end;
end $$;
reset role;
select set_config('request.jwt.claim.sub',current_setting('blueprint.test.inactive'),true);
select set_config('request.jwt.claims',json_build_object('sub',current_setting('blueprint.test.inactive'),'role','authenticated')::text,true);
set local role authenticated;
do $$ begin
 begin perform public.start_season(current_setting('blueprint.test.year')::integer+2);raise exception 'Metadata forged approval';exception when insufficient_privilege then null;end;
 begin perform private.close_season(current_setting('blueprint.test.new_season')::uuid,current_setting('blueprint.test.year')::integer+1);raise exception 'Private closure bypassed approval';exception when insufficient_privilege then null;end;
end $$;
reset role;
select set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
set local role authenticated;
do $$ begin
 begin perform public.start_season(current_setting('blueprint.test.year')::integer+2);raise exception 'Missing profile started season';exception when insufficient_privilege then null;end;
end $$;
reset role;
set local role anon;
do $$ begin
 begin perform public.start_season(2028);raise exception 'Anonymous season creation';exception when insufficient_privilege then null;end;
 begin perform public.close_season(gen_random_uuid(),2028);raise exception 'Anonymous closure';exception when insufficient_privilege then null;end;
end $$;
reset role;
do $$ begin
 if exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in('start_season','close_season') and p.prosecdef) then raise exception 'Privileged exposed RPC';end if;
 if has_column_privilege('authenticated','public.seasons','closed_by','UPDATE') then raise exception 'Closure author forgeable';end if;
end $$;
rollback;
select 'Phase 6 hosted permissions and continuity verified; synthetic transaction rolled back' as verification;
