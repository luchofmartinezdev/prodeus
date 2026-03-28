-- ============================================================
-- PRODEUS — Migración 001: Schema completo
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- EXTENSIONES
-- ─────────────────────────────────────────────────────────────
create extension if not exists "pgcrypto";

-- ─────────────────────────────────────────────────────────────
-- TIPOS ENUM (evita typos en status fields)
-- ─────────────────────────────────────────────────────────────
create type tournament_status as enum ('draft', 'active', 'closed');
create type match_status      as enum ('scheduled', 'in_progress', 'finished');
create type join_mode         as enum ('open', 'closed');
create type member_status     as enum ('pending', 'active', 'removed');
create type user_role         as enum ('user', 'superadmin');
create type scoring_rule_key  as enum ('exact_score', 'correct_winner', 'correct_goals_only', 'no_match');

-- ─────────────────────────────────────────────────────────────
-- PROFILES (extiende auth.users)
-- ─────────────────────────────────────────────────────────────
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  username    text unique not null,
  avatar_url  text,
  role        user_role not null default 'user',
  created_at  timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────
-- TOURNAMENTS
-- ─────────────────────────────────────────────────────────────
create table public.tournaments (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  logo_url    text,
  start_date  date not null,
  end_date    date not null,
  status      tournament_status not null default 'draft',
  created_at  timestamptz not null default now(),

  constraint tournaments_dates_check check (end_date >= start_date)
);

-- ─────────────────────────────────────────────────────────────
-- TEAMS
-- ─────────────────────────────────────────────────────────────
create table public.teams (
  id             uuid primary key default gen_random_uuid(),
  tournament_id  uuid not null references public.tournaments (id) on delete cascade,
  name           text not null,
  short_name     text,
  logo_url       text
);

create index teams_tournament_id_idx on public.teams (tournament_id);

-- ─────────────────────────────────────────────────────────────
-- MATCHES
-- ─────────────────────────────────────────────────────────────
create table public.matches (
  id                   uuid primary key default gen_random_uuid(),
  tournament_id        uuid not null references public.tournaments (id) on delete cascade,
  home_team_id         uuid not null references public.teams (id),
  away_team_id         uuid not null references public.teams (id),
  match_date           timestamptz not null,
  prediction_deadline  timestamptz not null,
  status               match_status not null default 'scheduled',
  home_score           integer check (home_score >= 0),
  away_score           integer check (away_score >= 0),
  round                text,

  constraint matches_different_teams check (home_team_id <> away_team_id),
  constraint matches_scores_both_or_none check (
    (home_score is null) = (away_score is null)
  )
);

create index matches_tournament_id_idx on public.matches (tournament_id);
create index matches_status_idx        on public.matches (status);

-- ─────────────────────────────────────────────────────────────
-- SCORING RULES
-- ─────────────────────────────────────────────────────────────
create table public.scoring_rules (
  id             uuid primary key default gen_random_uuid(),
  tournament_id  uuid not null references public.tournaments (id) on delete cascade,
  rule_key       scoring_rule_key not null,
  points_value   integer not null check (points_value >= 0),
  description    text,

  constraint scoring_rules_unique_key_per_tournament unique (tournament_id, rule_key)
);

create index scoring_rules_tournament_id_idx on public.scoring_rules (tournament_id);

-- ─────────────────────────────────────────────────────────────
-- GROUPS
-- ─────────────────────────────────────────────────────────────
create table public.groups (
  id             uuid primary key default gen_random_uuid(),
  tournament_id  uuid not null references public.tournaments (id) on delete cascade,
  name           text not null,
  leader_id      uuid not null references public.profiles (id),
  join_mode      join_mode not null default 'open',
  invite_code    text unique not null default encode(gen_random_bytes(6), 'hex'),
  created_at     timestamptz not null default now()
);

create index groups_tournament_id_idx on public.groups (tournament_id);
create index groups_leader_id_idx     on public.groups (leader_id);
create index groups_invite_code_idx   on public.groups (invite_code);

-- ─────────────────────────────────────────────────────────────
-- GROUP MEMBERS
-- ─────────────────────────────────────────────────────────────
create table public.group_members (
  id         uuid primary key default gen_random_uuid(),
  group_id   uuid not null references public.groups (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  status     member_status not null default 'pending',
  joined_at  timestamptz,

  constraint group_members_unique_user_group unique (group_id, user_id)
);

create index group_members_group_id_idx on public.group_members (group_id);
create index group_members_user_id_idx  on public.group_members (user_id);

-- ─────────────────────────────────────────────────────────────
-- PRODES (instancia de participación usuario + grupo + torneo)
-- ─────────────────────────────────────────────────────────────
create table public.prodes (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles (id) on delete cascade,
  group_id        uuid not null references public.groups (id) on delete cascade,
  tournament_id   uuid not null references public.tournaments (id) on delete cascade,
  final_position  integer check (final_position > 0),
  total_points    integer not null default 0,
  created_at      timestamptz not null default now(),

  constraint prodes_unique_user_group unique (user_id, group_id)
);

create index prodes_user_id_idx       on public.prodes (user_id);
create index prodes_group_id_idx      on public.prodes (group_id);
create index prodes_tournament_id_idx on public.prodes (tournament_id);

-- ─────────────────────────────────────────────────────────────
-- PREDICTIONS
-- ─────────────────────────────────────────────────────────────
create table public.predictions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles (id) on delete cascade,
  match_id        uuid not null references public.matches (id) on delete cascade,
  group_id        uuid not null references public.groups (id) on delete cascade,
  predicted_home  integer not null check (predicted_home >= 0),
  predicted_away  integer not null check (predicted_away >= 0),
  points_earned   integer check (points_earned >= 0),
  submitted_at    timestamptz not null default now(),
  last_edited_at  timestamptz,

  constraint predictions_unique_user_match_group unique (user_id, match_id, group_id)
);

create index predictions_user_id_idx  on public.predictions (user_id);
create index predictions_match_id_idx on public.predictions (match_id);
create index predictions_group_id_idx on public.predictions (group_id);

-- ─────────────────────────────────────────────────────────────
-- SCORES (cache del ranking — solo escribe la Edge Function)
-- ─────────────────────────────────────────────────────────────
create table public.scores (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references public.profiles (id) on delete cascade,
  group_id           uuid not null references public.groups (id) on delete cascade,
  tournament_id      uuid not null references public.tournaments (id) on delete cascade,
  total_points       integer not null default 0,
  last_calculated_at timestamptz not null default now(),

  constraint scores_unique_user_group unique (user_id, group_id)
);

create index scores_group_id_idx      on public.scores (group_id);
create index scores_tournament_id_idx on public.scores (tournament_id);
create index scores_total_points_idx  on public.scores (total_points desc);
