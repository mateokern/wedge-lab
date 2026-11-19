-- Wedge Lab · invite-only LIU team database
-- Run once in Supabase SQL Editor. Do NOT commit private keys to GitHub.
-- This does NOT import, remove, or change any personal Wedge Lab data.

create extension if not exists pgcrypto;

create table if not exists public.wedge_team_members (
 id uuid primary key default gen_random_uuid(),
 email text not null unique check (email=lower(btrim(email)) and position('@' in email)>1),
 display_name text not null check (char_length(btrim(display_name)) between 2 and 80),
 active boolean not null default true,
 created_at timestamptz not null default now()
);

-- An authenticated user belongs to the team only if their verified
-- Supabase Auth email matches an explicit active entry in the allowlist.
create or replace function public.wedge_team_my_id()
returns uuid language sql stable security definer set search_path=''
as $$
 select id from public.wedge_team_members
 where email=lower(coalesce(auth.jwt()->>'email',''))
   and active=true
 limit 1
$$;
revoke all on function public.wedge_team_my_id() from public, anon;
grant execute on function public.wedge_team_my_id() to authenticated;

create or replace function public.wedge_team_valid_shots(
 p_shots jsonb, p_min integer, p_max integer
) returns boolean language plpgsql immutable set search_path=''
as $$
declare shot jsonb; field text; value_num numeric;
begin
 if jsonb_typeof(p_shots)<>'array' or jsonb_array_length(p_shots)<>20 then return false; end if;
 if p_min<10 or p_max>250 or p_min>=p_max then return false; end if;
 for shot in select value from jsonb_array_elements(p_shots) loop
  if jsonb_typeof(shot)<>'object' then return false; end if;
  foreach field in array array['target','left','right','long','short'] loop
   if jsonb_typeof(shot->field)<>'number' then return false; end if;
   value_num=(shot->>field)::numeric;
   if field='target' then
    if value_num<p_min or value_num>p_max or value_num<>trunc(value_num) then return false; end if;
   elsif value_num<0 or value_num>100 then return false; end if;
  end loop;
  if ((shot->>'left')::numeric>0 and (shot->>'right')::numeric>0)
    or ((shot->>'long')::numeric>0 and (shot->>'short')::numeric>0) then return false; end if;
  if jsonb_typeof(shot->'club')<>'string' then return false; end if;
  if length(shot->>'club')>80 then return false; end if;
 end loop;
 return true;
exception when others then return false;
end $$;

-- Score is recomputed server-side from all 20 submitted shot errors.
-- Lowest 17 radial distances are summed; never trust a client-submitted score.
create or replace function public.wedge_team_score(p_shots jsonb)
returns double precision language sql immutable strict set search_path=''
as $$
 select coalesce(sum(miss),0)::double precision from (
  select sqrt(
   power(((shot->>'right')::double precision-(shot->>'left')::double precision),2)
  +power(((shot->>'long')::double precision-(shot->>'short')::double precision),2)
  ) as miss
  from jsonb_array_elements(p_shots) as items(shot)
  order by miss asc limit 17
 ) scored
$$;

create table if not exists public.wedge_team_sessions (
 id text primary key check (char_length(id) between 7 and 128),
 member_id uuid not null references public.wedge_team_members(id),
 played_at timestamptz not null default now(),
 preset text not null check (preset in ('30-75','50-90','90-135','custom')),
 min_yards integer not null,
 max_yards integer not null,
 wind text not null default 'Unknown',
 surface text not null default 'Unknown',
 shots jsonb not null,
 score double precision generated always as (public.wedge_team_score(shots)) stored,
 created_at timestamptz not null default now(),
 constraint valid_wedge_team_shots check (public.wedge_team_valid_shots(shots,min_yards,max_yards)),
 constraint valid_wedge_team_range check (
  (preset='30-75' and min_yards=30 and max_yards=75)
  or (preset='50-90' and min_yards=50 and max_yards=90)
  or (preset='90-135' and min_yards=90 and max_yards=135)
  or preset='custom'
 )
);

create index if not exists wedge_team_sessions_member_time
on public.wedge_team_sessions(member_id,played_at desc);
create index if not exists wedge_team_sessions_preset_score
on public.wedge_team_sessions(preset,score);

alter table public.wedge_team_members enable row level security;
alter table public.wedge_team_sessions enable row level security;

-- No anonymous access, and no client-side membership editing.
revoke all on public.wedge_team_members from anon, authenticated;
revoke all on public.wedge_team_sessions from anon, authenticated;
-- Only share display names and IDs with teammates; emails stay private.
grant select (id, display_name, active) on public.wedge_team_members to authenticated;
grant select, insert, update, delete on public.wedge_team_sessions to authenticated;

drop policy if exists "Active players may view LIU roster" on public.wedge_team_members;
create policy "Active players may view LIU roster"
on public.wedge_team_members for select to authenticated
using ((select public.wedge_team_my_id()) is not null);

drop policy if exists "Active players may view LIU combines" on public.wedge_team_sessions;
create policy "Active players may view LIU combines"
on public.wedge_team_sessions for select to authenticated
using ((select public.wedge_team_my_id()) is not null);

drop policy if exists "Players insert only their own combines" on public.wedge_team_sessions;
create policy "Players insert only their own combines"
on public.wedge_team_sessions for insert to authenticated
with check (member_id=(select public.wedge_team_my_id()));

drop policy if exists "Players update only their own combines" on public.wedge_team_sessions;
create policy "Players update only their own combines"
on public.wedge_team_sessions for update to authenticated
using (member_id=(select public.wedge_team_my_id()))
with check (member_id=(select public.wedge_team_my_id()));

drop policy if exists "Players delete only their own combines" on public.wedge_team_sessions;
create policy "Players delete only their own combines"
on public.wedge_team_sessions for delete to authenticated
using (member_id=(select public.wedge_team_my_id()));

-- TEAM ROSTER (ONLY YOU / SUPABASE ADMIN RUNS THIS):
-- For each teammate, uncomment and replace BOTH fields. Private emails are
-- stored only in Supabase; never put a real roster into this public SQL file.
-- insert into public.wedge_team_members(email,display_name)
-- values ('player@example.edu','Player Name')
-- on conflict (email) do update
-- set display_name=excluded.display_name, active=true;
--
-- To remove team access immediately:
-- update public.wedge_team_members set active=false where email='player@example.edu';
