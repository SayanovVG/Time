-- A private, one-use capability provisions the owner's first Auth account.
-- Plain activation tokens and passwords are never stored in this table.
create table planner_private.setup_links (
  token_hash text primary key check (token_hash ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz not null,
  claimed_at timestamptz,
  owner_id uuid references auth.users(id) on delete cascade
);
alter table planner_private.setup_links enable row level security;
revoke all on planner_private.setup_links from public,anon,authenticated;
create policy planner_setup_deny_clients on planner_private.setup_links as restrictive for all to anon,authenticated using(false) with check(false);
create index planner_setup_owner_idx on planner_private.setup_links(owner_id);

create function planner_private.claim_setup(p_token_hash text) returns boolean
language plpgsql security definer set search_path='' as $$
declare changed integer;
begin
  update planner_private.setup_links set claimed_at=clock_timestamp()
  where token_hash=p_token_hash and claimed_at is null and owner_id is null and expires_at>now();
  get diagnostics changed=row_count;
  return changed=1;
end $$;
create function planner_private.finish_setup(p_token_hash text,p_owner_id uuid,p_release boolean) returns void
language plpgsql security definer set search_path='' as $$
begin
  if p_release then
    update planner_private.setup_links set claimed_at=null where token_hash=p_token_hash and owner_id is null;
  elsif p_owner_id is not null then
    update planner_private.setup_links set owner_id=p_owner_id where token_hash=p_token_hash and owner_id is null and claimed_at is not null;
  else raise exception 'Missing owner'; end if;
end $$;
create function public.planner_claim_setup(p_token_hash text) returns boolean language sql security invoker set search_path='' as $$
  select planner_private.claim_setup(p_token_hash);
$$;
create function public.planner_finish_setup(p_token_hash text,p_owner_id uuid,p_release boolean) returns void language sql security invoker set search_path='' as $$
  select planner_private.finish_setup(p_token_hash,p_owner_id,p_release);
$$;
revoke all on function planner_private.claim_setup(text),planner_private.finish_setup(text,uuid,boolean),public.planner_claim_setup(text),public.planner_finish_setup(text,uuid,boolean) from public,anon,authenticated;
grant usage on schema planner_private to service_role;
grant execute on function planner_private.claim_setup(text),planner_private.finish_setup(text,uuid,boolean),public.planner_claim_setup(text),public.planner_finish_setup(text,uuid,boolean) to service_role;
