-- No real prospect reads. Fully synthetic import fixtures, all rolled back.
begin;
select set_config('blueprint.test.actor',gen_random_uuid()::text,true);
select set_config('blueprint.test.inactive',gen_random_uuid()::text,true);
insert into auth.users(id,email,raw_user_meta_data) values
 (current_setting('blueprint.test.actor')::uuid,'synthetic-phase7@example.com','{"full_name":"Synthetic Import Leader"}'),
 (current_setting('blueprint.test.inactive')::uuid,'synthetic-phase7-inactive@example.com','{"is_active":true}');
update public.profiles set is_active=true where id=current_setting('blueprint.test.actor')::uuid;
select set_config('blueprint.test.year',(select (coalesce(max(year),1999)+1)::text from public.seasons),true);
select set_config('request.jwt.claim.sub',current_setting('blueprint.test.actor'),true);
select set_config('request.jwt.claims',json_build_object('sub',current_setting('blueprint.test.actor'),'role','authenticated')::text,true);
set local role authenticated;
select set_config('blueprint.test.season',public.start_season(current_setting('blueprint.test.year')::integer)::text,true);
select set_config('blueprint.test.rows',(select jsonb_agg(jsonb_build_object('source_id',i::text,'facts',jsonb_build_object('full_name','Synthetic Phase7 Player '||i,'position',case when i%2=0 then 'Handler' else null end)))::text from generate_series(1,10) i),true);
do $$ declare result jsonb;person uuid;rows jsonb;n integer;begin
 rows:=current_setting('blueprint.test.rows')::jsonb;
 result:=public.import_prospects(current_setting('blueprint.test.season')::uuid,'synthetic-phase7',rows);
 if result<> '{"processed":10,"created":10,"reused":0,"skipped":0,"memberships_added":10}'::jsonb then raise exception 'Initial batch counts incorrect';end if;
 if (select count(*) from public.candidacies where season_id=current_setting('blueprint.test.season')::uuid and stage='Unknown Prospect' and outcome is null and owner_id is null and next_action is null and projection_year_one is null)<>10 then raise exception 'Import invented workflow defaults';end if;
 if exists(select 1 from public.evaluations e join public.candidacies c on e.candidacy_id=c.id where c.season_id=current_setting('blueprint.test.season')::uuid) then raise exception 'Import invented evaluations';end if;
 if (select count(*) from public.prospect_activity where season_id=current_setting('blueprint.test.season')::uuid and actor_id=auth.uid() and actor_name='Synthetic Import Leader' and event_type='season_added')<>10 then raise exception 'Import authorship not trusted';end if;
 select prospect_id into person from public.candidacies where season_id=current_setting('blueprint.test.season')::uuid limit 1;
 if not exists(select 1 from public.prospects where id=person and email is null and age is null and height_cm is null) then raise exception 'Missing source facts fabricated';end if;
 select count(*) into n from public.prospect_activity where season_id=current_setting('blueprint.test.season')::uuid;
 result:=public.import_prospects(current_setting('blueprint.test.season')::uuid,'synthetic-phase7',rows);
 if result->>'skipped'<>'10' or result->>'created'<>'0' or (select count(*) from public.prospect_activity where season_id=current_setting('blueprint.test.season')::uuid)<>n then raise exception 'Repeat import was not idempotent';end if;
 begin perform public.import_prospects(current_setting('blueprint.test.season')::uuid,'synthetic-phase7',jsonb_set(rows,'{0,facts,location}','"Synthetic changed input"'));raise exception 'Changed receipt overwrote existing input';exception when invalid_parameter_value then null;end;
 begin perform public.import_prospects(current_setting('blueprint.test.season')::uuid,'new-source',jsonb_build_array(rows->0));raise exception 'Unresolved duplicate name imported';exception when invalid_parameter_value then null;end;
 begin perform public.import_prospects(current_setting('blueprint.test.season')::uuid,'bad-field','[{"source_id":"a","facts":{"full_name":"Synthetic Bad Field","is_active":true}}]');raise exception 'Unsupported field imported';exception when invalid_parameter_value then null;end;
 begin perform public.import_prospects(current_setting('blueprint.test.season')::uuid,'bad-position','[{"source_id":"a","facts":{"full_name":"Synthetic Bad Position","position":"Hybrid"}}]');raise exception 'Invalid position imported';exception when invalid_parameter_value then null;end;
 begin perform public.import_prospects(current_setting('blueprint.test.season')::uuid,'bad-fraction','[{"source_id":"a","facts":{"full_name":"Synthetic Bad Fraction","age":21.5}}]');raise exception 'Fraction imported';exception when invalid_parameter_value then null;end;
 begin perform public.import_prospects(current_setting('blueprint.test.season')::uuid,'duplicate-ids',jsonb_build_array(rows->0,rows->0));raise exception 'Duplicate source IDs allowed';exception when invalid_parameter_value then null;end;
 begin perform public.import_prospects(current_setting('blueprint.test.season')::uuid,'oversized',rows||rows);raise exception 'Oversized import permitted';exception when invalid_parameter_value then null;end;
 -- A late bad row rolls back the entire batch, including people/activity/receipts.
 begin perform public.import_prospects(current_setting('blueprint.test.season')::uuid,'atomic-failure','[{"source_id":"a","facts":{"full_name":"Synthetic Atomic New Person"}},{"source_id":"b","facts":{"full_name":"Synthetic Invalid Late Person","age":1}}]');raise exception 'Bad late row allowed';exception when invalid_parameter_value then null;end;
 if exists(select 1 from public.prospects where full_name='Synthetic Atomic New Person') or (select count(*) from public.candidacies where season_id=current_setting('blueprint.test.season')::uuid)<>10 then raise exception 'Partial import persisted';end if;
 begin perform count(*) from private.prospect_import_rows;raise exception 'Private receipts exposed';exception when insufficient_privilege then null;end;
end $$;
select set_config('blueprint.test.new_season',public.start_season(current_setting('blueprint.test.year')::integer+1)::text,true);
do $$ declare person public.prospects; result jsonb;begin
 select p.* into person from public.prospects p join public.candidacies c on c.prospect_id=p.id where c.season_id=current_setting('blueprint.test.season')::uuid limit 1;
 update public.candidacies set outcome='Practice Player' where prospect_id=person.id and season_id=current_setting('blueprint.test.season')::uuid;
 result:=public.import_prospects(current_setting('blueprint.test.new_season')::uuid,'synthetic-reuse',jsonb_build_array(jsonb_build_object('source_id','explicit-reference','prospect_id',person.id,'facts',jsonb_build_object('full_name',person.full_name,'location','Synthetic source must not overwrite'))));
 if result->>'reused'<>'1' or result->>'created'<>'0' or result->>'memberships_added'<>'1' then raise exception 'Explicit person reuse failed';end if;
 if (select location from public.prospects where id=person.id) is not null or not exists(select 1 from public.candidacies where prospect_id=person.id and season_id=current_setting('blueprint.test.new_season')::uuid and outcome is null) then raise exception 'Reuse overwrote shared facts or copied outcome';end if;
 begin perform public.import_prospects(current_setting('blueprint.test.new_season')::uuid,'wrong-reference',jsonb_build_array(jsonb_build_object('source_id','wrong','prospect_id',person.id,'facts',jsonb_build_object('full_name','Synthetic Mismatched Person'))));raise exception 'Mismatched person reused';exception when invalid_parameter_value then null;end;
 perform public.close_season(current_setting('blueprint.test.season')::uuid,current_setting('blueprint.test.year')::integer);
 begin perform public.import_prospects(current_setting('blueprint.test.season')::uuid,'synthetic-phase7',current_setting('blueprint.test.rows')::jsonb);raise exception 'Closed-season import allowed';exception when insufficient_privilege then null;end;
end $$;
reset role;
do $$ begin
 if (select count(*) from private.prospect_import_rows where source='synthetic-phase7')<>10 or exists(select 1 from private.prospect_import_rows where source='atomic-failure') then raise exception 'Receipt batch not atomic';end if;
end $$;
update public.profiles set is_active=false where id=current_setting('blueprint.test.actor')::uuid;
set local role authenticated;
do $$ begin
 begin perform public.import_prospects(current_setting('blueprint.test.new_season')::uuid,'revoked',current_setting('blueprint.test.rows')::jsonb);raise exception 'Revoked leader imported';exception when insufficient_privilege then null;end;
 begin perform private.import_prospects(current_setting('blueprint.test.new_season')::uuid,'revoked-private','[]');raise exception 'Private helper bypass';exception when insufficient_privilege then null;end;
end $$;
reset role;
select set_config('request.jwt.claim.sub',current_setting('blueprint.test.inactive'),true);
select set_config('request.jwt.claims',json_build_object('sub',current_setting('blueprint.test.inactive'),'role','authenticated')::text,true);
set local role authenticated;
do $$ begin
 begin perform public.import_prospects(current_setting('blueprint.test.new_season')::uuid,'inactive','[]');raise exception 'Metadata activated import';exception when insufficient_privilege then null;end;
end $$;
reset role;
select set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
set local role authenticated;
do $$ begin
 begin perform public.import_prospects(current_setting('blueprint.test.new_season')::uuid,'missing','[]');raise exception 'Missing profile imported';exception when insufficient_privilege then null;end;
end $$;
reset role;
set local role anon;
do $$ begin
 begin perform public.import_prospects(gen_random_uuid(),'anon','[]');raise exception 'Anonymous import';exception when insufficient_privilege then null;end;
end $$;
reset role;
do $$ begin
 if exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='import_prospects' and p.prosecdef) then raise exception 'Privileged public RPC';end if;
 if has_table_privilege('authenticated','private.prospect_import_rows','INSERT') or has_table_privilege('anon','private.prospect_import_rows','SELECT') then raise exception 'Private import grants unsafe';end if;
end $$;
rollback;
select 'Phase 7 atomic private import, ten synthetic rows, defaults, reuse, retries and permissions verified; rolled back' as verification;
