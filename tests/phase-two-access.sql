-- Synthetic fixtures only; every mutation is rolled back, including Auth users.
begin;
select set_config('blueprint.test.active_id',gen_random_uuid()::text,true);
select set_config('blueprint.test.inactive_id',gen_random_uuid()::text,true);
insert into auth.users(id,email,raw_user_meta_data) values
 (current_setting('blueprint.test.active_id')::uuid,'synthetic-phase2-active@example.com','{"is_active":true}'),
 (current_setting('blueprint.test.inactive_id')::uuid,'synthetic-phase2-inactive@example.com','{"is_active":true}');
update public.profiles set is_active=true where id=current_setting('blueprint.test.active_id')::uuid;
select set_config('blueprint.test.season_id',(select id::text from public.seasons where status='active' order by year desc limit 1),true);
select set_config('blueprint.test.closed_id',(select id::text from public.seasons where status='closed' limit 1),true);

set local role anon;
do $$ begin
 begin perform * from public.prospects; raise exception 'Anonymous prospect read allowed'; exception when insufficient_privilege then null; end;
 begin perform * from public.candidacies; raise exception 'Anonymous candidacy read allowed'; exception when insufficient_privilege then null; end;
 begin perform public.create_prospect(current_setting('blueprint.test.season_id')::uuid,'{"full_name":"Forbidden"}'); raise exception 'Anonymous RPC allowed'; exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claim.sub',current_setting('blueprint.test.active_id'),true);
select set_config('request.jwt.claims',json_build_object('sub',current_setting('blueprint.test.active_id'),'role','authenticated')::text,true);
set local role authenticated;
select set_config('blueprint.test.prospect_id',public.create_prospect(current_setting('blueprint.test.season_id')::uuid,'{"full_name":"  Synthetic   Phase2 Player ","position":"Handler"}')::text,true);
do $$ begin
 if not exists(select 1 from public.prospects where id=current_setting('blueprint.test.prospect_id')::uuid and normalized_name='synthetic phase2 player') then raise exception 'Normalized name mismatch'; end if;
 if (select count(*) from public.candidacies where prospect_id=current_setting('blueprint.test.prospect_id')::uuid)<>1 then raise exception 'Atomic creation failed'; end if;
 update public.prospects set location='Synthetic City' where id=current_setting('blueprint.test.prospect_id')::uuid;
 begin update public.prospects set created_by=current_setting('blueprint.test.inactive_id')::uuid; raise exception 'Author can be forged'; exception when insufficient_privilege then null; end;
 begin insert into public.prospects(full_name,created_by) values('Forged author',current_setting('blueprint.test.inactive_id')::uuid); raise exception 'Insert author can be forged'; exception when insufficient_privilege then null; end;
 begin delete from public.prospects; raise exception 'Person deletion allowed'; exception when insufficient_privilege then null; end;
 begin delete from public.candidacies; raise exception 'History deletion allowed'; exception when insufficient_privilege then null; end;
 begin update public.candidacies set season_id=current_setting('blueprint.test.closed_id')::uuid; raise exception 'History can be moved'; exception when insufficient_privilege then null; end;
 begin insert into public.candidacies(prospect_id,season_id) values(current_setting('blueprint.test.prospect_id')::uuid,current_setting('blueprint.test.season_id')::uuid); raise exception 'Duplicate season membership allowed'; exception when unique_violation then null; end;
 begin perform public.create_prospect(current_setting('blueprint.test.closed_id')::uuid,'{"full_name":"Synthetic Failed Creation"}'); raise exception 'Closed season write allowed'; exception when insufficient_privilege then null; end;
 if exists(select 1 from public.prospects where full_name='Synthetic Failed Creation') then raise exception 'RPC left orphan after failure'; end if;
 begin update public.prospects set position='Hybrid'; raise exception 'Invalid position allowed'; exception when check_violation then null; end;
 begin update public.prospects set social_url='javascript:alert(1)'; raise exception 'Unsafe link allowed'; exception when check_violation then null; end;
end $$;
reset role;
-- Seed historical membership as administrator and a second active season, inside rollback.
insert into public.candidacies(prospect_id,season_id,created_by) values(current_setting('blueprint.test.prospect_id')::uuid,current_setting('blueprint.test.closed_id')::uuid,current_setting('blueprint.test.active_id')::uuid);
insert into public.seasons(name,year,status) values('Synthetic Future Season',2099,'active');
select set_config('blueprint.test.future_id',(select id::text from public.seasons where year=2099),true);
set local role authenticated;
insert into public.candidacies(prospect_id,season_id) values(current_setting('blueprint.test.prospect_id')::uuid,current_setting('blueprint.test.future_id')::uuid);
do $$ begin
 if (select count(*) from public.candidacies where prospect_id=current_setting('blueprint.test.prospect_id')::uuid)<>3 then raise exception 'History across seasons lost'; end if;
end $$;
reset role;

select set_config('request.jwt.claim.sub',current_setting('blueprint.test.inactive_id'),true);
select set_config('request.jwt.claims',json_build_object('sub',current_setting('blueprint.test.inactive_id'),'role','authenticated')::text,true);
set local role authenticated;
do $$ begin
 if exists(select 1 from public.prospects) or exists(select 1 from public.candidacies) then raise exception 'Inactive data access allowed'; end if;
 begin perform public.create_prospect(current_setting('blueprint.test.season_id')::uuid,'{"full_name":"Forbidden"}'); raise exception 'Inactive creation allowed'; exception when insufficient_privilege then null; end;
 update public.prospects set full_name='Forbidden'; if found then raise exception 'Inactive edit allowed'; end if;
end $$;
reset role;
update public.profiles set is_active=false where id=current_setting('blueprint.test.active_id')::uuid;
select set_config('request.jwt.claim.sub',current_setting('blueprint.test.active_id'),true);
select set_config('request.jwt.claims',json_build_object('sub',current_setting('blueprint.test.active_id'),'role','authenticated')::text,true);
set local role authenticated;
do $$ begin
 if exists(select 1 from public.prospects) or exists(select 1 from public.candidacies) then raise exception 'Revoked data access allowed'; end if;
 begin insert into public.candidacies(prospect_id,season_id) values(current_setting('blueprint.test.prospect_id')::uuid,current_setting('blueprint.test.future_id')::uuid); raise exception 'Revoked membership creation allowed'; exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
select set_config('request.jwt.claims',json_build_object('sub',current_setting('request.jwt.claim.sub'),'role','authenticated')::text,true);
set local role authenticated;
do $$ begin
 if exists(select 1 from public.prospects) or exists(select 1 from public.candidacies) then raise exception 'Missing profile data access allowed'; end if;
end $$;
reset role;
rollback;
select 'PASS: Phase 2 RLS, minimal grants, atomic create, read-only history, reuse, constraints and revocation; fixtures rolled back' as result;
