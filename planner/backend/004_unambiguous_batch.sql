-- Avoid collision between the PL/pgSQL record variable and a query alias.
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
    if (select count(*) from public.planner_records where owner_id=p_owner) + (select count(*) from jsonb_array_elements(p_changes) as incoming(value) where not exists(select 1 from public.planner_records r where r.owner_id=p_owner and r.id=incoming.value->>'id')) > 20000 then raise exception 'Record limit reached'; end if;
    for c in select * from jsonb_array_elements(p_changes) loop
      insert into public.planner_records(owner_id,id,kind,body,deleted,updated_by) values(p_owner,c->>'id',c->>'kind',c->'body',(c->>'deleted')::boolean,p_actor)
      on conflict(owner_id,id) do update set body=excluded.body,deleted=excluded.deleted,updated_by=excluded.updated_by;
    end loop;
  end if;
  select jsonb_build_object('status',case when conflict then 'conflict' else 'ok' end,'rows',coalesce(jsonb_agg(to_jsonb(r)-'owner_id'),'[]'::jsonb)) into output from public.planner_records r where r.owner_id=p_owner and r.id=any(changed_ids);
  insert into planner_private.operations(owner_id,operation_id,request_hash,result) values(p_owner,p_operation_id,md5(p_changes::text),output);
  return output;
end $$;
