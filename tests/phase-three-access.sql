-- Entirely synthetic and rolled back. Never inspect or mutate real prospects.
begin;
select set_config('blueprint.test.active_id',gen_random_uuid()::text,true);
select set_config('blueprint.test.owner_id',gen_random_uuid()::text,true);
select set_config('blueprint.test.inactive_id',gen_random_uuid()::text,true);
insert into auth.users(id,email,raw_user_meta_data) values
 (current_setting('blueprint.test.active_id')::uuid,'synthetic-phase3-active@example.com','{"full_name":"Synthetic Captain","is_active":true}'),
 (current_setting('blueprint.test.owner_id')::uuid,'synthetic-phase3-owner@example.com','{"full_name":"Synthetic Owner"}'),
 (current_setting('blueprint.test.inactive_id')::uuid,'synthetic-phase3-inactive@example.com','{"is_active":true}');
update public.profiles set is_active=true where id in(current_setting('blueprint.test.active_id')::uuid,current_setting('blueprint.test.owner_id')::uuid);
select set_config('blueprint.test.season_id',(select id::text from public.seasons where status='active' order by year desc limit 1),true);
select set_config('blueprint.test.closed_id',(select id::text from public.seasons where status='closed' limit 1),true);
set local role anon;
do $$ begin
 begin perform * from public.prospect_activity;raise exception 'Anonymous activity read allowed';exception when insufficient_privilege then null;end;
 begin perform public.recruiting_leaders();raise exception 'Anonymous directory allowed';exception when insufficient_privilege then null;end;
end $$;
reset role;
select set_config('request.jwt.claim.sub',current_setting('blueprint.test.active_id'),true);
select set_config('request.jwt.claims',json_build_object('sub',current_setting('blueprint.test.active_id'),'role','authenticated')::text,true);
set local role authenticated;
select set_config('blueprint.test.prospect_id',public.create_prospect(current_setting('blueprint.test.season_id')::uuid,'{"full_name":"Synthetic Phase3 Player"}')::text,true);
do $$ declare row public.candidacies;event public.prospect_activity;n integer;begin
 select * into row from public.candidacies where prospect_id=current_setting('blueprint.test.prospect_id')::uuid;
 if row.stage<>'Unknown Prospect' or row.priority is not null or row.owner_id is not null or row.version<>1 then raise exception 'Invented workflow defaults';end if;
 if(select count(*) from public.prospect_activity where prospect_id=row.prospect_id)<>2 then raise exception 'Creation events not atomic';end if;
 if(select count(*) from public.profiles)<>1 then raise exception 'Owner directory widened full profile access';end if;
 if not exists(select 1 from public.recruiting_leaders() where id=current_setting('blueprint.test.owner_id')::uuid and full_name='Synthetic Owner' and is_active) then raise exception 'Approved owner not discoverable';end if;
 if exists(select 1 from public.recruiting_leaders() where id=current_setting('blueprint.test.inactive_id')::uuid) then raise exception 'Unassigned inactive directory leak';end if;
 update public.candidacies set stage='Known Prospect',priority='High',owner_id=current_setting('blueprint.test.owner_id')::uuid,next_action='Synthetic outreach',follow_up_date='2027-01-15',projection_year_one='Synthetic year one',projection_year_two='Synthetic year two',projection_year_three='Synthetic year three' where id=row.id;
 select * into event from public.prospect_activity where prospect_id=row.prospect_id and event_type='workflow_updated';
 if event.actor_id<>current_setting('blueprint.test.active_id')::uuid or event.actor_name<>'Synthetic Captain' or event.season_id<>row.season_id or event.candidacy_id<>row.id or (select count(*) from jsonb_object_keys(event.changes))<>8 then raise exception 'Incomplete attributed change event';end if;
 if event.changes->'stage'<>'{"from":"Unknown Prospect","to":"Known Prospect"}'::jsonb or event.changes#>>'{owner_id,to_label}'<>'Synthetic Owner' or event.changes#>>'{projection_year_three,to}'<>'Synthetic year three' then raise exception 'Wrong before/after values';end if;
 if(select version from public.candidacies where id=row.id)<>2 then raise exception 'Version not incremented';end if;
 select count(*) into n from public.prospect_activity where prospect_id=row.prospect_id;
 update public.candidacies set stage='Known Prospect' where id=row.id;
 update public.prospects set full_name='Synthetic Phase3 Player' where id=row.prospect_id;
 if(select count(*) from public.prospect_activity where prospect_id=row.prospect_id)<>n or(select version from public.candidacies where id=row.id)<>2 then raise exception 'No-op creates activity/version';end if;
 update public.prospects set location='Synthetic City' where id=row.prospect_id;
 if not exists(select 1 from public.prospect_activity where prospect_id=row.prospect_id and event_type='prospect_updated' and season_id is null and changes->'location'='{"from":null,"to":"Synthetic City"}'::jsonb) then raise exception 'Shared facts not logged';end if;
 begin update public.candidacies set stage='Rostered' where id=row.id;raise exception 'Outcome allowed as stage';exception when check_violation then null;end;
 begin update public.candidacies set priority='Urgent' where id=row.id;raise exception 'Invalid priority allowed';exception when check_violation then null;end;
 begin update public.candidacies set next_action=repeat('x',501) where id=row.id;raise exception 'Oversized next action allowed';exception when check_violation then null;end;
 begin update public.candidacies set projection_year_three=repeat('x',1001) where id=row.id;raise exception 'Oversized projection allowed';exception when check_violation then null;end;
 begin update public.candidacies set owner_id=current_setting('blueprint.test.inactive_id')::uuid where id=row.id;raise exception 'Inactive owner assigned';exception when check_violation then null;end;
 begin update public.candidacies set owner_id=gen_random_uuid() where id=row.id;raise exception 'Missing owner assigned';exception when check_violation then null;end;
 begin update public.candidacies set version=100 where id=row.id;raise exception 'Version can be forged';exception when insufficient_privilege then null;end;
 begin update public.candidacies set updated_at=now() where id=row.id;raise exception 'Timestamp can be forged';exception when insufficient_privilege then null;end;
 begin insert into public.prospect_activity(prospect_id,actor_name,event_type,changes) values(row.prospect_id,'Forged','workflow_updated','{}');raise exception 'Event can be forged';exception when insufficient_privilege then null;end;
 begin update public.prospect_activity set actor_name='Forged' where prospect_id=row.prospect_id;raise exception 'Event can be rewritten';exception when insufficient_privilege then null;end;
 begin delete from public.prospect_activity where prospect_id=row.prospect_id;raise exception 'Event can be deleted';exception when insufficient_privilege then null;end;
 begin perform private.log_recruiting_activity();raise exception 'Logging callable directly';exception when insufficient_privilege then null;end;
 begin perform private.guard_recruiting_workflow();raise exception 'Guard callable directly';exception when insufficient_privilege then null;end;
end $$;
reset role;
-- Administrative historical seed and future season exist only within this transaction.
insert into public.candidacies(prospect_id,season_id,created_by,stage,priority,projection_year_one) values(current_setting('blueprint.test.prospect_id')::uuid,current_setting('blueprint.test.closed_id')::uuid,current_setting('blueprint.test.active_id')::uuid,'Confirmed for Tryouts','Low','Synthetic historical outlook');
insert into public.seasons(name,year,status) values('Synthetic Phase3 Future',2099,'active');
select set_config('blueprint.test.future_id',(select id::text from public.seasons where year=2099),true);
update public.profiles set is_active=false where id=current_setting('blueprint.test.owner_id')::uuid;
set local role authenticated;
do $$ declare n integer;begin
 if not exists(select 1 from public.recruiting_leaders() where id=current_setting('blueprint.test.owner_id')::uuid and not is_active) then raise exception 'Revoked owner lost from history';end if;
 update public.candidacies set next_action='Retain historical owner' where prospect_id=current_setting('blueprint.test.prospect_id')::uuid and season_id=current_setting('blueprint.test.season_id')::uuid;
 if not found then raise exception 'Unchanged revoked owner prevents other edits';end if;
 update public.candidacies set stage='Unknown Prospect' where prospect_id=current_setting('blueprint.test.prospect_id')::uuid and season_id=current_setting('blueprint.test.closed_id')::uuid;
 if found then raise exception 'Closed workflow editable';end if;
 insert into public.candidacies(prospect_id,season_id) values(current_setting('blueprint.test.prospect_id')::uuid,current_setting('blueprint.test.future_id')::uuid);
 update public.candidacies set priority='Medium',projection_year_one='Synthetic future outlook' where prospect_id=current_setting('blueprint.test.prospect_id')::uuid and season_id=current_setting('blueprint.test.future_id')::uuid;
 if not exists(select 1 from public.candidacies where prospect_id=current_setting('blueprint.test.prospect_id')::uuid and season_id=current_setting('blueprint.test.closed_id')::uuid and stage='Confirmed for Tryouts' and priority='Low' and projection_year_one='Synthetic historical outlook') then raise exception 'Historical outlook overwritten';end if;
 if not exists(select 1 from public.candidacies where prospect_id=current_setting('blueprint.test.prospect_id')::uuid and season_id=current_setting('blueprint.test.season_id')::uuid and stage='Known Prospect' and priority='High' and projection_year_one='Synthetic year one') then raise exception 'Current season contaminated';end if;
 begin update public.candidacies set owner_id=current_setting('blueprint.test.owner_id')::uuid where prospect_id=current_setting('blueprint.test.prospect_id')::uuid and season_id=current_setting('blueprint.test.future_id')::uuid;raise exception 'New revoked assignment allowed';exception when check_violation then null;end;
 update public.candidacies set owner_id=null where prospect_id=current_setting('blueprint.test.prospect_id')::uuid and season_id=current_setting('blueprint.test.season_id')::uuid;
 if not found then raise exception 'Cannot clear revoked owner';end if;
 -- A failed later statement rolls back its workflow change AND triggered activity.
 select count(*) into n from public.prospect_activity where prospect_id=current_setting('blueprint.test.prospect_id')::uuid;
 begin
  update public.candidacies set next_action='Should roll back' where prospect_id=current_setting('blueprint.test.prospect_id')::uuid and season_id=current_setting('blueprint.test.season_id')::uuid;
  raise exception 'Synthetic transaction failure' using errcode='23514';
 exception when check_violation then null;end;
 if(select count(*) from public.prospect_activity where prospect_id=current_setting('blueprint.test.prospect_id')::uuid)<>n or exists(select 1 from public.candidacies where prospect_id=current_setting('blueprint.test.prospect_id')::uuid and next_action='Should roll back') then raise exception 'Edit/log rollback not atomic';end if;
end $$;
reset role;
-- Inactive, revoked and missing profiles cannot read workflow/activity or use either directory entry point.
update public.profiles set is_active=false where id=current_setting('blueprint.test.active_id')::uuid;
select set_config('blueprint.test.missing_id',gen_random_uuid()::text,true);
do $$ declare person text;begin
 foreach person in array array[current_setting('blueprint.test.inactive_id'),current_setting('blueprint.test.active_id'),current_setting('blueprint.test.missing_id')] loop
  perform set_config('request.jwt.claim.sub',person,true);
  perform set_config('request.jwt.claims',json_build_object('sub',person,'role','authenticated')::text,true);
  set local role authenticated;
  if exists(select 1 from public.candidacies) or exists(select 1 from public.prospect_activity) then raise exception 'Unapproved recruiting read allowed';end if;
  update public.candidacies set next_action='Forbidden' where prospect_id=current_setting('blueprint.test.prospect_id')::uuid;
  if found then raise exception 'Unapproved workflow write allowed';end if;
  begin perform public.recruiting_leaders();raise exception 'Unapproved directory allowed';exception when insufficient_privilege then null;end;
  begin perform private.recruiting_leaders();raise exception 'Private directory bypass';exception when insufficient_privilege then null;end;
  reset role;
 end loop;
end $$;
rollback;
select 'PASS: Phase 3 seasonal isolation, owners, versions, immutable attributed events, no-op suppression, rollback, historical read-only and approval-only access; all fixtures rolled back' as result;
