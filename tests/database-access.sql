-- Run in Supabase SQL editor or the execute_sql connector.
-- Synthetic Auth users exist ONLY inside this transaction. No emails are sent.
-- Every fixture is rolled back; assertions throw on failure.
begin;
select set_config('blueprint.test.active_id', gen_random_uuid()::text, true);
select set_config('blueprint.test.inactive_id', gen_random_uuid()::text, true);
insert into auth.users (id, email, raw_user_meta_data) values
  (current_setting('blueprint.test.active_id')::uuid, 'synthetic-active@example.com', '{"full_name":"Synthetic Captain","is_active":true}'),
  (current_setting('blueprint.test.inactive_id')::uuid, 'synthetic-inactive@example.com', '{"is_active":true}');

do $$ begin
  if (select count(*) from public.profiles where id in (current_setting('blueprint.test.active_id')::uuid, current_setting('blueprint.test.inactive_id')::uuid) and not is_active) <> 2 then
    raise exception 'Profile trigger must ignore metadata activation';
  end if;
end $$;
update public.profiles set is_active = true where id = current_setting('blueprint.test.active_id')::uuid;

set local role anon;
do $$ begin
  begin
    perform * from public.seasons;
    raise exception 'Anonymous season access must fail';
  exception when insufficient_privilege then null;
  end;
  begin
    perform * from public.profiles;
    raise exception 'Anonymous profile access must fail';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

select set_config('request.jwt.claim.sub', current_setting('blueprint.test.active_id'), true);
select set_config('request.jwt.claims', json_build_object('sub', current_setting('blueprint.test.active_id'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$ begin
  if (select count(*) from public.profiles) <> 1 then raise exception 'Leadership may read only own profile'; end if;
  if (select count(*) from public.seasons) <> 2 then raise exception 'Active leadership must see both seasons'; end if;
  begin
    perform private.bootstrap_profile();
    raise exception 'Trigger function must not be callable';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.profiles set is_active = false;
    raise exception 'Client profile update must fail';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.seasons (name,year,status) values ('Forbidden',2028,'active');
    raise exception 'Client season insert must fail';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

select set_config('request.jwt.claim.sub', current_setting('blueprint.test.inactive_id'), true);
select set_config('request.jwt.claims', json_build_object('sub', current_setting('blueprint.test.inactive_id'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$ begin
  if (select count(*) from public.profiles) <> 1 then raise exception 'Inactive account must see only own profile'; end if;
  if (select count(*) from public.seasons) <> 0 then raise exception 'Inactive account must not read seasons'; end if;
end $$;
reset role;

select set_config('request.jwt.claim.sub', gen_random_uuid()::text, true);
select set_config('request.jwt.claims', json_build_object('sub', current_setting('request.jwt.claim.sub'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$ begin
  if (select count(*) from public.profiles) <> 0 then raise exception 'Missing profile must not read other profiles'; end if;
  if (select count(*) from public.seasons) <> 0 then raise exception 'Missing profile must not read seasons'; end if;
end $$;
reset role;

do $$ begin
  begin
    insert into public.seasons (name, year, is_current, status) values ('Invalid Second Current',2028,true,'active');
    raise exception 'Two current seasons must fail';
  exception when unique_violation then null;
  end;
  begin
    insert into public.seasons (name, year, is_current, status) values ('Invalid Closed Current',2028,true,'closed');
    raise exception 'Closed current season must fail';
  exception when check_violation then null;
  end;
end $$;
rollback;
select 'PASS: anonymous, active, inactive, missing-profile, metadata, writes, and season constraints; fixtures rolled back' as result;
