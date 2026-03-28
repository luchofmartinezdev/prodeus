-- ============================================================
-- PRODEUS — Migración 003: Funciones y Triggers helper
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- TRIGGER: crear perfil automáticamente al registrar usuario
-- ─────────────────────────────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username, avatar_url)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'username',
      split_part(new.email, '@', 1)
    ),
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─────────────────────────────────────────────────────────────
-- TRIGGER: al aprobar un miembro (status -> active), crear prode
-- ─────────────────────────────────────────────────────────────
create or replace function public.handle_member_approved()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Solo actuar cuando el status cambia a 'active'
  if new.status = 'active' and (old.status is distinct from 'active') then
    insert into public.prodes (user_id, group_id, tournament_id)
    select new.user_id, new.group_id, g.tournament_id
    from public.groups g
    where g.id = new.group_id
    on conflict (user_id, group_id) do nothing;

    -- Inicializar score en 0 si no existe
    insert into public.scores (user_id, group_id, tournament_id, total_points)
    select new.user_id, new.group_id, g.tournament_id, 0
    from public.groups g
    where g.id = new.group_id
    on conflict (user_id, group_id) do nothing;
  end if;
  return new;
end;
$$;

create trigger on_member_approved
  after insert or update of status on public.group_members
  for each row execute function public.handle_member_approved();

-- ─────────────────────────────────────────────────────────────
-- TRIGGER: al crear grupo, agregar al líder como miembro activo
-- ─────────────────────────────────────────────────────────────
create or replace function public.handle_group_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.group_members (group_id, user_id, status, joined_at)
  values (new.id, new.leader_id, 'active', now());
  return new;
end;
$$;

create trigger on_group_created
  after insert on public.groups
  for each row execute function public.handle_group_created();

-- ─────────────────────────────────────────────────────────────
-- TRIGGER: actualizar last_edited_at en predictions
-- ─────────────────────────────────────────────────────────────
create or replace function public.handle_prediction_edited()
returns trigger
language plpgsql
as $$
begin
  new.last_edited_at = now();
  return new;
end;
$$;

create trigger on_prediction_updated
  before update on public.predictions
  for each row execute function public.handle_prediction_edited();

-- ─────────────────────────────────────────────────────────────
-- FUNCIÓN: insertar scoring_rules por defecto al crear torneo
-- Llamar manualmente o via trigger según preferencia.
-- ─────────────────────────────────────────────────────────────
create or replace function public.create_default_scoring_rules(p_tournament_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.scoring_rules (tournament_id, rule_key, points_value, description)
  values
    (p_tournament_id, 'exact_score',        5, 'Resultado exacto (local y visitante)'),
    (p_tournament_id, 'correct_winner',     2, 'Ganador correcto o empate (sin resultado exacto)'),
    (p_tournament_id, 'correct_goals_only', 1, 'Goles de al menos un equipo correctos (sin ganador)'),
    (p_tournament_id, 'no_match',           0, 'Sin aciertos')
  on conflict (tournament_id, rule_key) do nothing;
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- CONSTRAINT: un usuario no puede ser líder de más de un grupo
-- por torneo (enforce la regla de negocio del spec §8.4)
-- ─────────────────────────────────────────────────────────────
create unique index groups_one_leader_per_tournament
  on public.groups (tournament_id, leader_id);

-- ─────────────────────────────────────────────────────────────
-- VISTA: ranking por grupo (auxiliar para la Edge Function)
-- ─────────────────────────────────────────────────────────────
create or replace view public.group_ranking as
select
  s.group_id,
  s.tournament_id,
  s.user_id,
  p.username,
  p.avatar_url,
  s.total_points,
  rank() over (
    partition by s.group_id
    order by s.total_points desc
  ) as position,
  s.last_calculated_at
from public.scores s
join public.profiles p on p.id = s.user_id;
