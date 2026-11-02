-- Run once in the Supabase SQL Editor after confirming that this Auth user is yours.
-- Never put a database password or a secret/service-role key in this repository.
begin;

create table if not exists public.mltraining_private (
  id text primary key check (id = 'main'),
  owner_id uuid not null references auth.users(id),
  data jsonb not null default '{}'::jsonb,
  revision bigint not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.mltraining_public (
  id text primary key check (id = 'main'),
  owner_id uuid not null references auth.users(id),
  summary jsonb not null default '{}'::jsonb,
  revision bigint not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.mltraining_backups (
  owner_id uuid not null references auth.users(id),
  snapshot_date date not null,
  data jsonb not null,
  revision bigint not null,
  primary key (owner_id, snapshot_date)
);

alter table public.mltraining_private enable row level security;
alter table public.mltraining_public enable row level security;
alter table public.mltraining_backups enable row level security;

revoke all on public.mltraining_private from anon, authenticated;
revoke all on public.mltraining_public from anon, authenticated;
revoke all on public.mltraining_backups from anon, authenticated;
grant select (id, data, revision, updated_at) on public.mltraining_private to authenticated;
grant select (id, summary, revision, updated_at) on public.mltraining_public to anon, authenticated;
grant select (owner_id, snapshot_date, data, revision) on public.mltraining_backups to authenticated;

drop policy if exists "Owner reads private progress" on public.mltraining_private;
create policy "Owner reads private progress" on public.mltraining_private
  for select to authenticated using ((select auth.uid()) = owner_id);

drop policy if exists "Visitors read public summary" on public.mltraining_public;
create policy "Visitors read public summary" on public.mltraining_public
  for select to anon, authenticated using (true);

drop policy if exists "Owner reads daily backups" on public.mltraining_backups;
create policy "Owner reads daily backups" on public.mltraining_backups
  for select to authenticated using ((select auth.uid()) = owner_id);

insert into public.mltraining_private (id, owner_id)
values ('main', '18eea104-0317-4152-af5a-ce7cf047a921')
on conflict (id) do nothing;

insert into public.mltraining_public (id, owner_id)
values ('main', '18eea104-0317-4152-af5a-ce7cf047a921')
on conflict (id) do nothing;

create or replace function public.mltraining_save(
  p_state jsonb,
  p_summary jsonb,
  p_expected_revision bigint
)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_owner uuid;
  v_previous jsonb;
  v_previous_revision bigint;
  v_next bigint;
  v_item jsonb;
begin
  select owner_id, data, revision into v_owner, v_previous, v_previous_revision
  from public.mltraining_private where id = 'main' for update;
  if v_owner is null or auth.uid() is distinct from v_owner then
    raise exception 'not_owner' using errcode = '42501';
  end if;
  if v_previous_revision is distinct from p_expected_revision then
    raise exception 'revision_conflict' using errcode = '40001';
  end if;
  if jsonb_typeof(p_state) is distinct from 'object'
     or not (p_state ? 'version')
     or pg_column_size(p_state) > 5242880 then
    raise exception 'invalid_private_state' using errcode = '22023';
  end if;
  if jsonb_typeof(p_summary) is distinct from 'object'
     or jsonb_typeof(p_summary->'competencies') is distinct from 'object'
     or jsonb_typeof(p_summary->'projects') is distinct from 'array'
     or jsonb_typeof(p_summary->'hoursByDay') is distinct from 'object'
     or (p_summary - array['cycleStart','competencies','projects','hoursByDay']::text[]) <> '{}'::jsonb then
    raise exception 'invalid_public_summary' using errcode = '22023';
  end if;
  for v_item in select value from jsonb_each(p_summary->'competencies') loop
    if jsonb_typeof(v_item) is distinct from 'object'
       or (v_item - 'level') <> '{}'::jsonb
       or jsonb_typeof(v_item->'level') is distinct from 'number' then
      raise exception 'invalid_public_competency' using errcode = '22023';
    end if;
  end loop;
  for v_item in select value from jsonb_array_elements(p_summary->'projects') loop
    if jsonb_typeof(v_item) is distinct from 'object'
       or (v_item - array['id','title','status','bucket','progress']::text[]) <> '{}'::jsonb then
      raise exception 'invalid_public_project' using errcode = '22023';
    end if;
  end loop;
  for v_item in select value from jsonb_each(p_summary->'hoursByDay') loop
    if jsonb_typeof(v_item) is distinct from 'number' then
      raise exception 'invalid_public_hours' using errcode = '22023';
    end if;
  end loop;

  insert into public.mltraining_backups (owner_id, snapshot_date, data, revision)
  values (v_owner, (now() at time zone 'America/Lima')::date, v_previous, v_previous_revision)
  on conflict (owner_id, snapshot_date) do nothing;

  v_next := v_previous_revision + 1;
  update public.mltraining_private
  set data = p_state, revision = v_next, updated_at = now()
  where id = 'main';
  update public.mltraining_public
  set summary = p_summary, revision = v_next, updated_at = now()
  where id = 'main' and owner_id = v_owner;
  if not found then
    raise exception 'public_row_missing' using errcode = '23503';
  end if;
  return v_next;
end;
$$;

revoke all on function public.mltraining_save(jsonb, jsonb, bigint) from public, anon;
grant execute on function public.mltraining_save(jsonb, jsonb, bigint) to authenticated;
commit;
