-- Private planner records; the public application key grants no anonymous access.
create schema if not exists planner_private;
revoke all on schema planner_private from public, anon, authenticated;
grant usage on schema planner_private to authenticated;
create table if not exists public.planner_records (
  owner_id uuid not null references auth.users(id) on delete cascade,
  id text not null check (id ~ '^[a-zA-Z0-9:_-]{1,100}$'),
  kind text not null check (kind in ('task','project','note','focus')),
  body jsonb not null,
  revision bigint not null default 1 check (revision > 0),
  deleted boolean not null default false,
  updated_at timestamptz not null default clock_timestamp(),
  updated_by text not null default 'device' check (updated_by in ('device','max')),
  primary key(owner_id,id)
);
create table if not exists planner_private.operations (
  owner_id uuid not null references auth.users(id) on delete cascade,
  operation_id uuid not null,
  request_hash text not null,
  result jsonb not null,
  created_at timestamptz not null default now(),
  primary key(owner_id,operation_id)
);
alter table public.planner_records enable row level security;
alter table planner_private.operations enable row level security;
revoke all on public.planner_records, planner_private.operations from anon, authenticated;
grant select on public.planner_records to authenticated;
drop policy if exists planner_owner_read on public.planner_records;
create policy planner_owner_read on public.planner_records for select to authenticated using ((select auth.uid()) = owner_id);

create or replace function planner_private.planner_valid_day(value text) returns boolean language plpgsql immutable set search_path = '' as $$
begin
  return coalesce(value ~ '^\d{4}-\d{2}-\d{2}$' and value >= '2000-01-01' and value <= '2199-12-31' and to_char(value::date,'YYYY-MM-DD')=value,false);
exception when others then return false;
end $$;

create or replace function planner_private.planner_validate(k text,b jsonb) returns void language plpgsql immutable set search_path = '' as $$
declare c jsonb; v text; hour_minutes integer;
begin
  if jsonb_typeof(b) is distinct from 'object' then raise exception 'Invalid record'; end if;
  if octet_length(b::text)>100000 then raise exception 'Record too large'; end if;
  if k='project' then
    if (b ?& array['name','color'] and jsonb_typeof(b->'name')='string' and length(trim(b->>'name')) between 1 and 60 and b->>'color' ~ '^#[0-9a-fA-F]{6}$') is not true then raise exception 'Invalid project'; end if;
  elsif k='note' then
    if (b ?& array['date','text'] and planner_private.planner_valid_day(b->>'date') and jsonb_typeof(b->'text')='string' and length(b->>'text')<=20000) is not true then raise exception 'Invalid note'; end if;
  elsif k='focus' then
    if (b ?& array['date','taskId','minutes','completedAt'] and planner_private.planner_valid_day(b->>'date') and b->>'minutes' ~ '^[0-9]+$' and (b->>'minutes')::integer between 1 and 180 and (b->>'taskId' is null or b->>'taskId' ~ '^[a-zA-Z0-9:_-]{1,100}$')) is not true then raise exception 'Invalid focus'; end if;
    perform (b->>'completedAt')::timestamptz;
    if b->>'completedAt' is null then raise exception 'Missing completion'; end if;
  elsif k='task' then
    if (b ?& array['title','notes','project','date','time','duration','deadline','priority','starred','status','completedAt','checklist','tags','repeat','seriesId','repeatParent','source','createdAt','updatedAt']) is not true then raise exception 'Missing task fields'; end if;
    if (jsonb_typeof(b->'title')='string' and length(trim(b->>'title')) between 1 and 300 and jsonb_typeof(b->'notes')='string' and length(b->>'notes')<=20000 and b->>'project' ~ '^[a-zA-Z0-9:_-]{1,100}$') is not true then raise exception 'Invalid task text'; end if;
    foreach v in array array['date','deadline'] loop if b->>v is not null and not planner_private.planner_valid_day(b->>v) then raise exception 'Invalid task date'; end if; end loop;
    if b->>'time' is not null then
      if (b->>'time' ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' and b->>'date' is not null) is not true then raise exception 'Invalid time'; end if;
      hour_minutes := split_part(b->>'time',':',1)::integer*60+split_part(b->>'time',':',2)::integer;
    else hour_minutes := 0; end if;
    if (b->>'duration' ~ '^[0-9]+$' and (b->>'duration')::integer between 5 and 720 and hour_minutes+(b->>'duration')::integer<=1440 and b->>'priority' in ('0','1','2','3') and jsonb_typeof(b->'starred')='boolean' and b->>'status' in ('todo','done') and jsonb_typeof(b->'checklist')='array' and jsonb_array_length(b->'checklist')<=100 and jsonb_typeof(b->'tags')='array' and jsonb_array_length(b->'tags')<=20) is not true then raise exception 'Invalid task options'; end if;
    for c in select * from jsonb_array_elements(b->'checklist') loop
      if (c ?& array['id','text','done'] and c->>'id' ~ '^[a-zA-Z0-9:_-]{1,100}$' and jsonb_typeof(c->'text')='string' and length(trim(c->>'text')) between 1 and 300 and jsonb_typeof(c->'done')='boolean') is not true then raise exception 'Invalid checklist'; end if;
    end loop;
    if (select count(*)<>count(distinct value->>'id') from jsonb_array_elements(b->'checklist')) then raise exception 'Duplicate step'; end if;
    for c in select * from jsonb_array_elements(b->'tags') loop if jsonb_typeof(c) is distinct from 'string' or length(trim(c#>>'{}')) not between 1 and 40 then raise exception 'Invalid tag'; end if; end loop;
    c:=b->'repeat';
    if (c ?& array['frequency','interval','anchorDay','until'] and c->>'frequency' in ('none','daily','weekdays','weekly','monthly','yearly') and c->>'interval' ~ '^[0-9]+$' and (c->>'interval')::integer between 1 and 365 and c->>'anchorDay' ~ '^[0-9]+$' and (c->>'anchorDay')::integer between 1 and 31 and (c->>'until' is null or planner_private.planner_valid_day(c->>'until')) and (c->>'frequency'='none' or b->>'date' is not null)) is not true then raise exception 'Invalid repeat'; end if;
    if (b->>'seriesId' ~ '^[a-zA-Z0-9:_-]{1,100}$' and (b->>'repeatParent' is null or b->>'repeatParent' ~ '^[a-zA-Z0-9:_-]{1,100}$') and b->>'source' in ('self','max','import') and b->>'createdAt' is not null and b->>'updatedAt' is not null) is not true then raise exception 'Invalid task identity'; end if;
    perform (b->>'createdAt')::timestamptz; perform (b->>'updatedAt')::timestamptz;
    if b->>'completedAt' is not null then perform (b->>'completedAt')::timestamptz; end if;
    if b->>'status'='done' and b->>'completedAt' is null then raise exception 'Missing completion'; end if;
    if b->>'status'='todo' and b->>'completedAt' is not null then raise exception 'Unexpected completion'; end if;
  else raise exception 'Unknown record kind'; end if;
end $$;

create or replace function planner_private.planner_record_guard() returns trigger language plpgsql set search_path='' as $$
begin
  perform planner_private.planner_validate(new.kind,new.body);
  if tg_op='UPDATE' then
    if new.owner_id<>old.owner_id or new.id<>old.id or new.kind<>old.kind then raise exception 'Cannot change record identity'; end if;
    new.revision:=old.revision+1;
  else new.revision:=1; end if;
  new.updated_at:=clock_timestamp();
  return new;
end $$;
drop trigger if exists planner_record_guard on public.planner_records;
create trigger planner_record_guard before insert or update on public.planner_records for each row execute function planner_private.planner_record_guard();

create or replace function planner_private.planner_apply_private(p_owner uuid,p_operation_id uuid,p_changes jsonb,p_actor text) returns jsonb language plpgsql security invoker set search_path='' as $$
declare old_request text; output jsonb; c jsonb; present_revision bigint; conflict boolean:=false; changed_ids text[];
begin
  if p_owner is null or p_operation_id is null or p_actor is null or p_actor not in ('device','max') then raise exception 'Authentication required'; end if;
  if jsonb_typeof(p_changes) is distinct from 'array' or jsonb_array_length(p_changes) not between 1 and 100 then raise exception 'Invalid batch'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_owner::text,0));
  select request_hash,result into old_request,output from planner_private.operations where owner_id=p_owner and operation_id=p_operation_id;
  if found then
    if old_request<>md5(p_changes::text) then raise exception 'Operation ID reused with different content'; end if;
    return output;
  end if;
  if (select count(*)<>count(distinct value->>'id') from jsonb_array_elements(p_changes)) then raise exception 'Duplicate record'; end if;
  for c in select * from jsonb_array_elements(p_changes) loop
    if (c ?& array['id','kind','body','deleted','base_revision'] and c->>'id' ~ '^[a-zA-Z0-9:_-]{1,100}$' and c->>'base_revision' ~ '^[0-9]+$' and jsonb_typeof(c->'deleted')='boolean') is not true then raise exception 'Invalid change'; end if;
    perform planner_private.planner_validate(c->>'kind',c->'body');
    if exists(select 1 from public.planner_records where owner_id=p_owner and id=c->>'id' and kind<>c->>'kind') then raise exception 'Cannot change record kind'; end if;
    select revision into present_revision from public.planner_records where owner_id=p_owner and id=c->>'id';
    if coalesce(present_revision,0)<>(c->>'base_revision')::bigint then conflict:=true; end if;
  end loop;
  select array_agg(value->>'id') into changed_ids from jsonb_array_elements(p_changes);
  if not conflict then
    if (select count(*) from public.planner_records where owner_id=p_owner) + (select count(*) from jsonb_array_elements(p_changes) c where not exists(select 1 from public.planner_records r where r.owner_id=p_owner and r.id=c->>'id')) > 20000 then raise exception 'Record limit reached'; end if;
    for c in select * from jsonb_array_elements(p_changes) loop
      insert into public.planner_records(owner_id,id,kind,body,deleted,updated_by) values(p_owner,c->>'id',c->>'kind',c->'body',(c->>'deleted')::boolean,p_actor)
      on conflict(owner_id,id) do update set body=excluded.body,deleted=excluded.deleted,updated_by=excluded.updated_by;
    end loop;
  end if;
  select jsonb_build_object('status',case when conflict then 'conflict' else 'ok' end,'rows',coalesce(jsonb_agg(to_jsonb(r)-'owner_id'),'[]'::jsonb)) into output from public.planner_records r where r.owner_id=p_owner and r.id=any(changed_ids);
  insert into planner_private.operations(owner_id,operation_id,request_hash,result) values(p_owner,p_operation_id,md5(p_changes::text),output);
  return output;
end $$;

create or replace function planner_private.commit(p_operation_id uuid,p_changes jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  return planner_private.planner_apply_private(auth.uid(),p_operation_id,p_changes,'device');
end $$;

-- Public RPC is an unprivileged wrapper. Owner identity is determined inside the private function.
create or replace function public.planner_commit(p_operation_id uuid,p_changes jsonb) returns jsonb language sql security invoker set search_path='' as $$
  select planner_private.commit(p_operation_id,p_changes);
$$;

-- Only the connected account's administrator can use this entry point.
create or replace function planner_private.planner_assistant_commit(p_owner_email text,p_operation_id uuid,p_changes jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
declare account_id uuid; account_count integer;
begin
  select count(*),(array_agg(id))[1] into account_count,account_id from auth.users where lower(email)=lower(trim(p_owner_email));
  if account_count<>1 then raise exception 'Exactly one existing planner account must match'; end if;
  return planner_private.planner_apply_private(account_id,p_operation_id,p_changes,'max');
end $$;

revoke all on function planner_private.planner_valid_day(text),planner_private.planner_validate(text,jsonb),planner_private.planner_record_guard(),planner_private.planner_apply_private(uuid,uuid,jsonb,text),planner_private.planner_assistant_commit(text,uuid,jsonb),planner_private.commit(uuid,jsonb),public.planner_commit(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.planner_commit(uuid,jsonb),planner_private.commit(uuid,jsonb) to authenticated;
-- The assistant helper is callable only by the database owner through the authenticated management connector.
-- The administrative connector runs as the database owner; never put its key in the browser.
-- Realtime is optional; the client also refreshes on focus and every 15 seconds.
do $$ begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime') and not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='planner_records') then alter publication supabase_realtime add table public.planner_records; end if;
end $$;
