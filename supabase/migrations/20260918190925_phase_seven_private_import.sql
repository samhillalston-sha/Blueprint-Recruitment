-- Private import receipts contain no source facts and are not a public Data API.
create table private.prospect_import_rows (
 source text not null,
 source_id text not null,
 season_id uuid not null references public.seasons(id) on delete restrict,
 prospect_id uuid not null references public.prospects(id) on delete restrict,
 input_hash text not null,
 created_by uuid not null references public.profiles(id) on delete restrict,
 created_at timestamptz not null default clock_timestamp(),
 primary key(source,source_id,season_id)
);
create index import_rows_season on private.prospect_import_rows(season_id);
create index import_rows_person on private.prospect_import_rows(prospect_id);
create index import_rows_author on private.prospect_import_rows(created_by);
alter table private.prospect_import_rows enable row level security;
revoke all on private.prospect_import_rows from public,anon,authenticated,service_role;

create function private.import_prospects(p_season_id uuid,p_source text,p_rows jsonb) returns jsonb
 language plpgsql security definer set search_path='' as $$
declare
 actor uuid:=auth.uid(); row jsonb; facts jsonb; key text; person uuid; item_id text;
 receipt private.prospect_import_rows%rowtype; fingerprint text; field text; max_length integer;
 created integer:=0; reused integer:=0; skipped integer:=0; added integer:=0; changed integer;
begin
 perform 1 from public.profiles p where p.id=actor and p.is_active for share;
 if actor is null or not found then raise exception 'Leadership approval required' using errcode='42501';end if;
 perform 1 from public.seasons s where s.id=p_season_id and s.status='active' for share;
 if not found then raise exception 'Choose an active season' using errcode='42501';end if;
 if p_source is null or p_source !~ '^[a-z0-9][a-z0-9._-]{0,79}$' or
  jsonb_typeof(p_rows) is distinct from 'array' then raise exception 'Invalid import batch' using errcode='22023';end if;
 if jsonb_array_length(p_rows)<1 or jsonb_array_length(p_rows)>10 then raise exception 'Import one to ten rows' using errcode='22023';end if;
 if (select count(distinct value->>'source_id') from jsonb_array_elements(p_rows))<>jsonb_array_length(p_rows) then
  raise exception 'Source IDs must be unique in the batch' using errcode='22023';end if;
 -- Serialize imports: one receipt per stable source row / target season.
 perform pg_catalog.pg_advisory_xact_lock(621840701);
 for row in select value from jsonb_array_elements(p_rows) loop
  if jsonb_typeof(row)<>'object' or row-array['source_id','prospect_id','facts']<>'{}'::jsonb or
   jsonb_typeof(row->'source_id') is distinct from 'string' then raise exception 'Invalid import row' using errcode='22023';end if;
  key:=btrim(row->>'source_id');facts:=row->'facts';
  if key='' or char_length(key)>120 or jsonb_typeof(facts) is distinct from 'object' or
   facts-array['full_name','email','phone','social_url','location','teams','age','height_cm','position']<>'{}'::jsonb then
   raise exception 'Unsupported or missing source fields' using errcode='22023';end if;
  if jsonb_typeof(facts->'full_name') is distinct from 'string' or btrim(facts->>'full_name')='' then
   raise exception 'Name required' using errcode='22023';end if;
  for field,max_length in select k,v::integer from jsonb_each_text('{"full_name":120,"email":254,"phone":40,"social_url":500,"location":120,"teams":500,"position":6}'::jsonb) t(k,v) loop
   if facts ? field and facts->field<>'null'::jsonb and
    (jsonb_typeof(facts->field)<>'string' or char_length(facts->>field)>max_length) then
    raise exception 'Invalid text source field' using errcode='22023';end if;
  end loop;
  foreach field in array array['age','height_cm'] loop
   if facts ? field and facts->field<>'null'::jsonb and
    (jsonb_typeof(facts->field)<>'number' or (facts->>field) !~ '^[0-9]+$') then
    raise exception 'Source attribute must be a whole number' using errcode='22023';end if;
  end loop;
  if (facts->>'age')::integer not between 16 and 100 or (facts->>'height_cm')::integer not between 100 and 250 or
   (facts->>'position' is not null and facts->>'position' not in ('Handler','Cutter')) then
   raise exception 'Invalid source attribute range or position' using errcode='22023';end if;
  if facts->>'social_url' is not null and (facts->>'social_url') !~ '^https?://[^[:space:]/]+' then
   raise exception 'Use a complete HTTP(S) source link' using errcode='22023';end if;
  if facts->>'email' is not null and (facts->>'email') !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
   raise exception 'Invalid source email' using errcode='22023';end if;
  fingerprint:=md5(row::text);
  select * into receipt from private.prospect_import_rows r where r.source=p_source and r.source_id=key and r.season_id=p_season_id;
  if found then
   if receipt.input_hash<>fingerprint then raise exception 'Source row changed; review the existing import' using errcode='22023';end if;
   skipped:=skipped+1;continue;
  end if;
  item_id:=row->>'prospect_id';
  if item_id is not null then
   if jsonb_typeof(row->'prospect_id')<>'string' or item_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    raise exception 'Invalid existing prospect reference' using errcode='22023';end if;
   person:=item_id::uuid;
   if not exists(select 1 from public.prospects p where p.id=person and p.normalized_name=lower(regexp_replace(btrim(facts->>'full_name'),'\s+',' ','g'))) then
    raise exception 'Existing prospect reference does not match source name' using errcode='22023';end if;
   -- Existing shared facts are authoritative; never overwrite from an import.
   insert into public.candidacies(prospect_id,season_id) values(person,p_season_id) on conflict(prospect_id,season_id) do nothing;
   get diagnostics changed=row_count;added:=added+changed;reused:=reused+1;
  else
   if exists(select 1 from public.prospects p where p.normalized_name=lower(regexp_replace(btrim(facts->>'full_name'),'\s+',' ','g'))) then
    raise exception 'Duplicate name requires an explicit existing prospect reference' using errcode='22023';end if;
   person:=public.create_prospect(p_season_id,facts);created:=created+1;added:=added+1;
  end if;
  insert into private.prospect_import_rows(source,source_id,season_id,prospect_id,input_hash,created_by)
   values(p_source,key,p_season_id,person,fingerprint,actor);
 end loop;
 return jsonb_build_object('processed',jsonb_array_length(p_rows),'created',created,'reused',reused,'skipped',skipped,'memberships_added',added);
end;
$$;
revoke all on function private.import_prospects(uuid,text,jsonb) from public,anon,authenticated,service_role;
grant execute on function private.import_prospects(uuid,text,jsonb) to authenticated;
create function public.import_prospects(p_season_id uuid,p_source text,p_rows jsonb) returns jsonb
 language sql security invoker set search_path='' as $$ select private.import_prospects(p_season_id,p_source,p_rows); $$;
revoke all on function public.import_prospects(uuid,text,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.import_prospects(uuid,text,jsonb) to authenticated;
