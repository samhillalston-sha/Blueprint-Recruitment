-- Wholly synthetic, isolated and rolled back. Never inspect actual evaluations.
begin;
select set_config('blueprint.test.active_id',gen_random_uuid()::text,true);
select set_config('blueprint.test.other_id',gen_random_uuid()::text,true);
select set_config('blueprint.test.third_id',gen_random_uuid()::text,true);
select set_config('blueprint.test.inactive_id',gen_random_uuid()::text,true);
select set_config('blueprint.test.missing_id',gen_random_uuid()::text,true);
insert into auth.users(id,email,raw_user_meta_data) values
 (current_setting('blueprint.test.active_id')::uuid,'synthetic-phase5-a@example.com','{"full_name":"Synthetic Evaluator A"}'),
 (current_setting('blueprint.test.other_id')::uuid,'synthetic-phase5-b@example.com','{"full_name":"Synthetic Evaluator B"}'),
 (current_setting('blueprint.test.third_id')::uuid,'synthetic-phase5-c@example.com','{"full_name":"Synthetic Evaluator C"}'),
 (current_setting('blueprint.test.inactive_id')::uuid,'synthetic-phase5-inactive@example.com','{"is_active":true}');
update public.profiles set is_active=true where id in(current_setting('blueprint.test.active_id')::uuid,current_setting('blueprint.test.other_id')::uuid,current_setting('blueprint.test.third_id')::uuid);
insert into public.seasons(name,year,status)
 select 'Synthetic Phase5 '||y,y,'active' from generate_series(2100,2000,-1) y
 where not exists(select 1 from public.seasons where year=y) limit 2;
select set_config('blueprint.test.season_id',(select id::text from public.seasons where name like 'Synthetic Phase5 %' order by year desc limit 1),true);
select set_config('blueprint.test.closed_id',(select id::text from public.seasons where name like 'Synthetic Phase5 %' order by year asc limit 1),true);
update public.seasons set status='closed' where id=current_setting('blueprint.test.closed_id')::uuid;
select set_config('request.jwt.claim.sub',current_setting('blueprint.test.active_id'),true);
select set_config('request.jwt.claims',json_build_object('sub',current_setting('blueprint.test.active_id'),'role','authenticated')::text,true);
set local role authenticated;
select set_config('blueprint.test.prospect_id',public.create_prospect(current_setting('blueprint.test.season_id')::uuid,'{"full_name":"Synthetic Phase5 Player"}')::text,true);
select set_config('blueprint.test.candidacy_id',(select id::text from public.candidacies where prospect_id=current_setting('blueprint.test.prospect_id')::uuid and season_id=current_setting('blueprint.test.season_id')::uuid),true);
do $$ declare summary jsonb;begin
 summary:=public.evaluation_summary(current_setting('blueprint.test.candidacy_id')::uuid);
 if summary->'own'<>'null'::jsonb or summary->'rows'<>'[]'::jsonb or summary->>'count'<>'0' or summary#>'{averages,athleticism,mean}'<>'null'::jsonb or summary#>>'{averages,athleticism,na}'<>'0' then raise exception 'Unsubmitted values fabricated';end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub',current_setting('blueprint.test.other_id'),true);
select set_config('request.jwt.claims',json_build_object('sub',current_setting('blueprint.test.other_id'),'role','authenticated')::text,true);
set local role authenticated;
insert into public.evaluations(candidacy_id,athleticism,offensive_ability,defensive_ability,coachability,on_field_vibes,off_field_vibes)
 values(current_setting('blueprint.test.candidacy_id')::uuid,1,null,5,null,4,null);
reset role;
select set_config('request.jwt.claim.sub',current_setting('blueprint.test.active_id'),true);
select set_config('request.jwt.claims',json_build_object('sub',current_setting('blueprint.test.active_id'),'role','authenticated')::text,true);
set local role authenticated;
do $$ declare summary jsonb;begin
 summary:=public.evaluation_summary(current_setting('blueprint.test.candidacy_id')::uuid);
 if summary->>'count'<>'1' or summary->'own'<>'null'::jsonb or summary#>>'{rows,0,evaluator_name}'<>'Synthetic Evaluator B' or summary#>>'{averages,athleticism,mean}'<>'1.00' then raise exception 'Other evaluation hidden until own submission';end if;
 update public.evaluations set athleticism=5 where candidacy_id=current_setting('blueprint.test.candidacy_id')::uuid;
 if found then raise exception 'Another evaluator edited';end if;
 begin insert into public.evaluations(candidacy_id,evaluator_id,athleticism) values(current_setting('blueprint.test.candidacy_id')::uuid,current_setting('blueprint.test.other_id')::uuid,5);raise exception 'Spoofed evaluator allowed';exception when insufficient_privilege then null;end;
 insert into public.evaluations(candidacy_id,athleticism,offensive_ability,defensive_ability,coachability,on_field_vibes,off_field_vibes)
  values(current_setting('blueprint.test.candidacy_id')::uuid,5,5,null,null,2,null);
end $$;
reset role;
select set_config('request.jwt.claim.sub',current_setting('blueprint.test.third_id'),true);
select set_config('request.jwt.claims',json_build_object('sub',current_setting('blueprint.test.third_id'),'role','authenticated')::text,true);
set local role authenticated;
insert into public.evaluations(candidacy_id,athleticism,offensive_ability,defensive_ability,coachability,on_field_vibes,off_field_vibes)
 values(current_setting('blueprint.test.candidacy_id')::uuid,null,3,null,null,null,null);
reset role;
select set_config('request.jwt.claim.sub',current_setting('blueprint.test.active_id'),true);
select set_config('request.jwt.claims',json_build_object('sub',current_setting('blueprint.test.active_id'),'role','authenticated')::text,true);
set local role authenticated;
do $$ declare summary jsonb;row public.evaluations;event public.prospect_activity;n integer;begin
 summary:=public.evaluation_summary(current_setting('blueprint.test.candidacy_id')::uuid);
 if summary->>'count'<>'3' or summary#>>'{averages,athleticism,mean}'<>'3.00' or summary#>>'{averages,athleticism,count}'<>'2' or summary#>>'{averages,athleticism,na}'<>'1' then raise exception 'N/A incorrectly included in numeric average';end if;
 if summary#>>'{averages,offensive_ability,mean}'<>'4.00' or summary#>>'{averages,defensive_ability,mean}'<>'5.00' or summary#>'{averages,coachability,mean}'<>'null'::jsonb or summary#>>'{averages,coachability,na}'<>'3' then raise exception 'Attribute denominators or all-N/A incorrect';end if;
 select * into row from public.evaluations where candidacy_id=current_setting('blueprint.test.candidacy_id')::uuid and evaluator_id=auth.uid();
 if row.evaluator_name<>'Synthetic Evaluator A' or row.version<>1 then raise exception 'Untrusted author/default version';end if;
 select * into event from public.prospect_activity where candidacy_id=row.candidacy_id and actor_id=auth.uid() and event_type='evaluation_submitted';
 if event.actor_name<>'Synthetic Evaluator A' or event.season_id<>current_setting('blueprint.test.season_id')::uuid or (select count(*) from jsonb_object_keys(event.changes))<>6 or event.changes#>'{coachability,to}'<>'null'::jsonb then raise exception 'Submission attribution/N/A log incorrect';end if;
 select count(*) into n from public.prospect_activity where prospect_id=current_setting('blueprint.test.prospect_id')::uuid;
 update public.evaluations set athleticism=5 where id=row.id;
 if (select version from public.evaluations where id=row.id)<>1 or (select count(*) from public.prospect_activity where prospect_id=current_setting('blueprint.test.prospect_id')::uuid)<>n then raise exception 'No-op logged or version changed';end if;
 update public.evaluations set athleticism=4,coachability=3 where id=row.id and version=1;
 if not found or (select version from public.evaluations where id=row.id)<>2 then raise exception 'Evaluation update/version failed';end if;
 if not exists(select 1 from public.prospect_activity where candidacy_id=row.candidacy_id and actor_id=auth.uid() and event_type='evaluation_updated' and changes->'athleticism'='{"from":5,"to":4}'::jsonb and changes->'coachability'='{"from":null,"to":3}'::jsonb) then raise exception 'Rating edit not atomically attributed';end if;
 update public.evaluations set athleticism=2 where id=row.id and version=1;
 if found then raise exception 'Stale edit overwritten';end if;
 begin update public.evaluations set athleticism=0 where id=row.id;raise exception 'Zero allowed';exception when check_violation then null;end;
 begin update public.evaluations set athleticism=6 where id=row.id;raise exception 'Rating above 5 allowed';exception when check_violation then null;end;
 begin insert into public.evaluations(candidacy_id) values(row.candidacy_id);raise exception 'Duplicate author evaluation allowed';exception when unique_violation then null;end;
 begin update public.evaluations set evaluator_id=current_setting('blueprint.test.other_id')::uuid where id=row.id;raise exception 'Evaluator changed';exception when insufficient_privilege then null;end;
 begin update public.evaluations set evaluator_name='Forged',version=100,created_at=now() where id=row.id;raise exception 'Protected metadata changed';exception when insufficient_privilege then null;end;
 begin update public.evaluations set candidacy_id=gen_random_uuid() where id=row.id;raise exception 'Evaluation history moved';exception when insufficient_privilege then null;end;
 begin delete from public.evaluations where id=row.id;raise exception 'Evaluation deleted';exception when insufficient_privilege then null;end;
 begin perform private.guard_evaluation();raise exception 'Private guard callable';exception when insufficient_privilege then null;end;
 begin perform private.log_evaluation();raise exception 'Private logger callable';exception when insufficient_privilege then null;end;
 select count(*) into n from public.prospect_activity where prospect_id=current_setting('blueprint.test.prospect_id')::uuid;
 begin update public.evaluations set athleticism=1 where id=row.id;raise exception 'Synthetic forced rollback' using errcode='P0002';exception when no_data_found then null;end;
 if (select athleticism from public.evaluations where id=row.id)<>4 or (select count(*) from public.prospect_activity where prospect_id=current_setting('blueprint.test.prospect_id')::uuid)<>n then raise exception 'Rating/event rollback not atomic';end if;
end $$;
reset role;
-- Closed-season records and additional evaluators are administrative synthetic seeds only.
insert into public.candidacies(prospect_id,season_id,created_by) values(current_setting('blueprint.test.prospect_id')::uuid,current_setting('blueprint.test.closed_id')::uuid,current_setting('blueprint.test.active_id')::uuid);
select set_config('blueprint.test.closed_candidacy',(select id::text from public.candidacies where prospect_id=current_setting('blueprint.test.prospect_id')::uuid and season_id=current_setting('blueprint.test.closed_id')::uuid),true);
insert into public.evaluations(candidacy_id,evaluator_id,athleticism) values(current_setting('blueprint.test.closed_candidacy')::uuid,current_setting('blueprint.test.active_id')::uuid,1);
update public.profiles set is_active=false where id=current_setting('blueprint.test.other_id')::uuid;
do $$ declare i integer;person uuid;begin
 for i in 1..26 loop
  person:=gen_random_uuid();
  insert into auth.users(id,email,raw_user_meta_data) values(person,'synthetic-phase5-page-'||i||'@example.com',jsonb_build_object('full_name','Synthetic Page Evaluator '||lpad(i::text,2,'0')));
  update public.profiles set is_active=true where id=person;
  insert into public.evaluations(candidacy_id,evaluator_id) values(current_setting('blueprint.test.candidacy_id')::uuid,person);
 end loop;
end $$;
set local role authenticated;
do $$ declare summary jsonb;begin
 summary:=public.evaluation_summary(current_setting('blueprint.test.candidacy_id')::uuid,2);
 if summary->>'count'<>'29' or summary->>'page'<>'2' or jsonb_array_length(summary->'rows')<>4 or summary#>>'{own,evaluator_name}'<>'Synthetic Evaluator A' then raise exception 'Comparison pagination/own row incorrect';end if;
 if summary#>>'{averages,athleticism,mean}'<>'2.50' or summary#>>'{averages,athleticism,count}'<>'2' or summary#>>'{averages,athleticism,na}'<>'27' then raise exception 'Averages truncated to page or former evaluator lost';end if;
 if (public.evaluation_summary(current_setting('blueprint.test.candidacy_id')::uuid,999999)->>'page')<>'2' then raise exception 'Out-of-range page not clamped';end if;
 if (public.evaluation_summary(current_setting('blueprint.test.candidacy_id')::uuid,-5)->>'page')<>'1' then raise exception 'Negative page not clamped';end if;
 if (public.evaluation_summary(current_setting('blueprint.test.closed_candidacy')::uuid)#>>'{averages,athleticism,mean}')<>'1.00' then raise exception 'Historical evaluation not isolated';end if;
 update public.evaluations set athleticism=5 where candidacy_id=current_setting('blueprint.test.closed_candidacy')::uuid;
 if found then raise exception 'Historical evaluation changed';end if;
 begin insert into public.evaluations(candidacy_id) values(current_setting('blueprint.test.closed_candidacy')::uuid);raise exception 'Historical submission allowed';exception when insufficient_privilege then null;end;
 if (select count(*) from public.profiles)<>1 then raise exception 'Full profile access widened';end if;
 begin perform public.evaluation_summary(gen_random_uuid());raise exception 'Missing candidacy accepted';exception when invalid_parameter_value then null;end;
end $$;
reset role;
-- Race outcome: closing the season between reads and writes denies the write.
update public.seasons set status='closed' where id=current_setting('blueprint.test.season_id')::uuid;
set local role authenticated;
do $$ begin
 update public.evaluations set athleticism=3 where candidacy_id=current_setting('blueprint.test.candidacy_id')::uuid and evaluator_id=auth.uid();
 if found then raise exception 'Closed season write allowed';end if;
end $$;
reset role;
update public.profiles set is_active=false where id=current_setting('blueprint.test.active_id')::uuid;
do $$ declare identity text;begin
 foreach identity in array array[current_setting('blueprint.test.active_id'),current_setting('blueprint.test.inactive_id'),current_setting('blueprint.test.missing_id')] loop
  perform set_config('request.jwt.claim.sub',identity,true);
  perform set_config('request.jwt.claims',json_build_object('sub',identity,'role','authenticated')::text,true);
  set local role authenticated;
  if exists(select 1 from public.evaluations where candidacy_id=current_setting('blueprint.test.candidacy_id')::uuid) then raise exception 'Unapproved evaluation read';end if;
  begin perform public.evaluation_summary(current_setting('blueprint.test.candidacy_id')::uuid);raise exception 'Unapproved summary';exception when insufficient_privilege then null;end;
  begin insert into public.evaluations(candidacy_id) values(current_setting('blueprint.test.candidacy_id')::uuid);raise exception 'Unapproved evaluation submission';exception when insufficient_privilege then null;end;
  update public.evaluations set athleticism=3 where candidacy_id=current_setting('blueprint.test.candidacy_id')::uuid;
  if found then raise exception 'Unapproved evaluation update';end if;
  reset role;
 end loop;
end $$;
set local role anon;
do $$ begin
 begin perform * from public.evaluations;raise exception 'Anonymous evaluation read';exception when insufficient_privilege then null;end;
 begin perform public.evaluation_summary(current_setting('blueprint.test.candidacy_id')::uuid);raise exception 'Anonymous summary';exception when insufficient_privilege then null;end;
end $$;
reset role;
do $$ begin
 if exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='evaluation_summary' and p.prosecdef) then raise exception 'Summary bypasses RLS';end if;
end $$;
select 'Phase 5 entry, N/A, averages, attribution, comparison, season history and access passed; fixtures rolled back.' as verification;
rollback;
