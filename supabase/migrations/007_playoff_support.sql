-- ─────────────────────────────────────────────────────────────
-- 007_playoff_support.sql
-- Extiende el modelo para soportar fase eliminatoria:
-- 16vos, 8vos, cuartos, semis y final.
-- ─────────────────────────────────────────────────────────────

-- 1. Columnas nuevas en matches
alter table public.matches
  add column home_source_match_id  uuid references public.matches(id),
  add column away_source_match_id  uuid references public.matches(id),
  add column home_source_result    text check (home_source_result in ('winner', 'loser')),
  add column away_source_result    text check (away_source_result in ('winner', 'loser')),
  add column requires_tiebreak     boolean not null default false,
  add column tiebreak_method       text check (tiebreak_method in ('extra_time', 'penalties')),
  add column qualifier_team_id     uuid references public.teams(id);

-- home_team_id / away_team_id pasan a ser nullable (en playoffs pueden no conocerse aún)
alter table public.matches
  alter column home_team_id drop not null,
  alter column away_team_id drop not null;

-- Índices para las FK nuevas
create index matches_home_source_match_id_idx on public.matches (home_source_match_id);
create index matches_away_source_match_id_idx on public.matches (away_source_match_id);

-- 2. Nueva columna en predictions
alter table public.predictions
  add column predicted_qualifier_team_id uuid references public.teams(id);

-- 3. Nueva regla de puntuación global: correct_qualifier
insert into public.scoring_rules (rule_key, points_value, description)
values ('correct_qualifier', 3, 'Clasificado correcto en partido de eliminatoria')
on conflict (rule_key) do nothing;
