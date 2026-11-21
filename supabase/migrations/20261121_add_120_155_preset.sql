-- Only needed if an earlier LIU Team Mode Supabase schema is already installed.
-- Run in Supabase SQL Editor. This changes preset validation ONLY; it does not
-- remove, update, or rewrite any existing team sessions or shots.
begin;
alter table public.wedge_team_sessions
  drop constraint if exists wedge_team_sessions_preset_check;
alter table public.wedge_team_sessions
  add constraint wedge_team_sessions_preset_check
    check (preset in ('30-75','50-90','90-135','120-155','custom'));
alter table public.wedge_team_sessions
  drop constraint if exists valid_wedge_team_range;
alter table public.wedge_team_sessions
  add constraint valid_wedge_team_range check (
    (preset='30-75' and min_yards=30 and max_yards=75)
    or (preset='50-90' and min_yards=50 and max_yards=90)
    or (preset='90-135' and min_yards=90 and max_yards=135)
    or (preset='120-155' and min_yards=120 and max_yards=155)
    or preset='custom'
  );
commit;
