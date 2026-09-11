-- Keep the wire format compatible with the client's strict validator.
create or replace function planner_private.planner_validate(k text,b jsonb) returns void language plpgsql immutable set search_path = '' as $$
declare c jsonb; v text; hour_minutes integer;
begin
  if jsonb_typeof(b) is distinct from 'object' then raise exception 'Invalid record'; end if;
  if octet_length(b::text)>100000 then raise exception 'Record too large'; end if;
  if k='project' then
    if jsonb_typeof(b->'color') is distinct from 'string' then raise exception 'Invalid project color'; end if;
    if (b ?& array['name','color'] and jsonb_typeof(b->'name')='string' and length(trim(b->>'name')) between 1 and 60 and b->>'color' ~ '^#[0-9a-fA-F]{6}$') is not true then raise exception 'Invalid project'; end if;
  elsif k='note' then
    if (b ?& array['date','text'] and planner_private.planner_valid_day(b->>'date') and jsonb_typeof(b->'text')='string' and length(b->>'text')<=20000) is not true then raise exception 'Invalid note'; end if;
  elsif k='focus' then
    if jsonb_typeof(b->'minutes') is distinct from 'number' or (b->>'taskId' is not null and jsonb_typeof(b->'taskId') is distinct from 'string') then raise exception 'Invalid focus types'; end if;
    if (b->>'completedAt' ~ '^\d{4}-\d{2}-\d{2}T' and isfinite((b->>'completedAt')::timestamptz)) is not true then raise exception 'Invalid completion timestamp'; end if;
    if (b ?& array['date','taskId','minutes','completedAt'] and planner_private.planner_valid_day(b->>'date') and b->>'minutes' ~ '^[0-9]+$' and (b->>'minutes')::integer between 1 and 180 and (b->>'taskId' is null or b->>'taskId' ~ '^[a-zA-Z0-9:_-]{1,100}$')) is not true then raise exception 'Invalid focus'; end if;
    perform (b->>'completedAt')::timestamptz;
    if b->>'completedAt' is null then raise exception 'Missing completion'; end if;
  elsif k='task' then
    foreach v in array array['title','notes','project','seriesId','source','createdAt','updatedAt'] loop
      if jsonb_typeof(b->v) is distinct from 'string' then raise exception 'Invalid task string type'; end if;
    end loop;
    foreach v in array array['date','time','deadline','repeatParent','completedAt'] loop
      if b->>v is not null and jsonb_typeof(b->v) is distinct from 'string' then raise exception 'Invalid optional string type'; end if;
    end loop;
    foreach v in array array['duration','priority'] loop
      if jsonb_typeof(b->v) is distinct from 'number' then raise exception 'Invalid task number type'; end if;
    end loop;
    if jsonb_typeof(b->'repeat') is distinct from 'object' or jsonb_typeof(b->'repeat'->'interval') is distinct from 'number' or jsonb_typeof(b->'repeat'->'anchorDay') is distinct from 'number' then raise exception 'Invalid repeat types'; end if;
    foreach v in array array['createdAt','updatedAt','completedAt'] loop
      if b->>v is not null and (b->>v ~ '^\d{4}-\d{2}-\d{2}T' and isfinite((b->>v)::timestamptz)) is not true then raise exception 'Invalid task timestamp'; end if;
    end loop;
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

-- The operation journal is deliberately inaccessible to all end-user roles.
create policy planner_operations_deny_clients on planner_private.operations as restrictive for all to anon,authenticated using (false) with check (false);
