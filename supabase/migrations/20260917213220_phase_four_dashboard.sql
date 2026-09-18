-- Read-only dashboard snapshot. Invoker rights preserve all existing table RLS.
create function public.recruiting_dashboard(p_season_id uuid, p_pages jsonb default '{}'::jsonb)
 returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare result jsonb; today date := (statement_timestamp() at time zone 'UTC')::date;
begin
 if auth.uid() is null or not exists(select 1 from public.profiles where id=auth.uid() and is_active) then
  raise exception 'Leadership approval required' using errcode='42501';
 end if;
 if not exists(select 1 from public.seasons where id=p_season_id) then
  raise exception 'Season unavailable' using errcode='22023';
 end if;
 with records as materialized (
  select c.id,c.prospect_id,p.full_name,c.stage,c.priority,c.owner_id,c.next_action,c.follow_up_date
  from public.candidacies c join public.prospects p on p.id=c.prospect_id where c.season_id=p_season_id
 ), buckets(key) as (values ('overdue'),('upcoming'),('owners'),('actions')),
 classified as (
  select b.key,r.* from records r cross join buckets b where
   (b.key='overdue' and r.follow_up_date<today) or
   (b.key='upcoming' and r.follow_up_date>=today) or
   (b.key='owners' and r.owner_id is null) or
   (b.key='actions' and (r.next_action is null or r.next_action !~ '[^[:space:]]'))
 ), totals as (
  select b.key,count(c.id)::integer as count from buckets b left join classified c on c.key=b.key group by b.key
 ), pages as (
  select key,count,greatest(1,least(greatest(1,(count+9)/10),
   case when p_pages->>key ~ '^[0-9]{1,6}$' then greatest(1,(p_pages->>key)::integer) else 1 end)) as page from totals
 ), ranked as (
  select c.*,row_number() over(partition by key order by follow_up_date nulls last,lower(full_name),id) as rn from classified c
 ), queues as (
  select p.key,jsonb_build_object('count',p.count,'page',p.page,'rows',coalesce(
   jsonb_agg(to_jsonb(r)-array['key','rn'] order by r.rn) filter(where r.id is not null),'[]'::jsonb)) as value
  from pages p left join ranked r on r.key=p.key and r.rn between (p.page-1)*10+1 and p.page*10 group by p.key,p.count,p.page
 ), events as materialized (
  select a.id,a.prospect_id,r.full_name,a.season_id,a.actor_name,a.event_type,a.created_at
  from public.prospect_activity a join records r on r.prospect_id=a.prospect_id
  where a.season_id=p_season_id or a.season_id is null
 ), activity_page as (
  select count(*)::integer as count,greatest(1,least(greatest(1,(count(*)::integer+9)/10),
   case when p_pages->>'activity' ~ '^[0-9]{1,6}$' then greatest(1,(p_pages->>'activity')::integer) else 1 end)) as page from events
 ), recent as (
  select e.* from events e order by created_at desc,id desc
  limit 10 offset (select (page-1)*10 from activity_page)
 )
 select jsonb_build_object('today',today,'stages',jsonb_build_array(
  (select count(*) from records where stage='Unknown Prospect'),
  (select count(*) from records where stage='Known Prospect'),
  (select count(*) from records where stage='Confirmed for Tryouts')),
  'queues',(select jsonb_object_agg(key,value) from queues),
  'activity',(select jsonb_build_object('count',count,'page',page,'rows',
   coalesce((select jsonb_agg(to_jsonb(recent) order by created_at desc,id desc) from recent),'[]'::jsonb)) from activity_page)) into result;
 return result;
end;
$$;
revoke all on function public.recruiting_dashboard(uuid,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.recruiting_dashboard(uuid,jsonb) to authenticated;
