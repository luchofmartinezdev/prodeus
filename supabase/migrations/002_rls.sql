-- ============================================================
-- PRODEUS — Migración 002: Row Level Security
-- ============================================================
-- Regla general: habilitar RLS en todas las tablas desde el inicio.
-- Helper: auth.uid() devuelve el uuid del usuario autenticado.
-- Helper: is_superadmin() verifica el rol en profiles.

-- ─────────────────────────────────────────────────────────────
-- FUNCIÓN HELPER: is_superadmin()
-- ─────────────────────────────────────────────────────────────
create or replace function public.is_superadmin()
returns boolean
language sql
stable
security definer
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'superadmin'
  );
$$;

-- ─────────────────────────────────────────────────────────────
-- HABILITAR RLS EN TODAS LAS TABLAS
-- ─────────────────────────────────────────────────────────────
alter table public.profiles      enable row level security;
alter table public.tournaments   enable row level security;
alter table public.teams         enable row level security;
alter table public.matches       enable row level security;
alter table public.scoring_rules enable row level security;
alter table public.groups        enable row level security;
alter table public.group_members enable row level security;
alter table public.prodes        enable row level security;
alter table public.predictions   enable row level security;
alter table public.scores        enable row level security;

-- ─────────────────────────────────────────────────────────────
-- PROFILES
-- ─────────────────────────────────────────────────────────────
-- Cualquier usuario autenticado puede leer perfiles (para mostrar nombres en rankings)
create policy "profiles_select_authenticated"
  on public.profiles for select
  to authenticated
  using (true);

-- Cada usuario solo puede actualizar su propio perfil
create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- El perfil se crea automáticamente via trigger (ver migración 003)
-- El superadmin puede leer/modificar cualquier perfil
create policy "profiles_all_superadmin"
  on public.profiles for all
  to authenticated
  using (public.is_superadmin());

-- ─────────────────────────────────────────────────────────────
-- TOURNAMENTS
-- ─────────────────────────────────────────────────────────────
-- Cualquier usuario autenticado puede ver torneos activos
create policy "tournaments_select_active"
  on public.tournaments for select
  to authenticated
  using (status = 'active' or public.is_superadmin());

-- Solo superadmin puede crear/editar/eliminar torneos
create policy "tournaments_all_superadmin"
  on public.tournaments for all
  to authenticated
  using (public.is_superadmin())
  with check (public.is_superadmin());

-- ─────────────────────────────────────────────────────────────
-- TEAMS
-- ─────────────────────────────────────────────────────────────
-- Usuarios autenticados pueden ver equipos de torneos activos
create policy "teams_select_authenticated"
  on public.teams for select
  to authenticated
  using (
    exists (
      select 1 from public.tournaments t
      where t.id = tournament_id
        and (t.status = 'active' or public.is_superadmin())
    )
  );

-- Solo superadmin puede modificar equipos
create policy "teams_all_superadmin"
  on public.teams for all
  to authenticated
  using (public.is_superadmin())
  with check (public.is_superadmin());

-- ─────────────────────────────────────────────────────────────
-- MATCHES
-- ─────────────────────────────────────────────────────────────
-- Usuarios autenticados pueden ver partidos de torneos activos
create policy "matches_select_authenticated"
  on public.matches for select
  to authenticated
  using (
    exists (
      select 1 from public.tournaments t
      where t.id = tournament_id
        and (t.status = 'active' or public.is_superadmin())
    )
  );

-- Solo superadmin puede crear/editar partidos y cargar resultados
create policy "matches_all_superadmin"
  on public.matches for all
  to authenticated
  using (public.is_superadmin())
  with check (public.is_superadmin());

-- ─────────────────────────────────────────────────────────────
-- SCORING RULES
-- ─────────────────────────────────────────────────────────────
-- Todos los usuarios autenticados pueden leer las reglas
create policy "scoring_rules_select_authenticated"
  on public.scoring_rules for select
  to authenticated
  using (true);

-- Solo superadmin puede modificar reglas
create policy "scoring_rules_all_superadmin"
  on public.scoring_rules for all
  to authenticated
  using (public.is_superadmin())
  with check (public.is_superadmin());

-- ─────────────────────────────────────────────────────────────
-- GROUPS
-- ─────────────────────────────────────────────────────────────
-- Los miembros activos pueden ver su grupo; grupos abiertos son visibles para todos
create policy "groups_select_authenticated"
  on public.groups for select
  to authenticated
  using (
    join_mode = 'open'
    or leader_id = auth.uid()
    or exists (
      select 1 from public.group_members gm
      where gm.group_id = id
        and gm.user_id = auth.uid()
        and gm.status = 'active'
    )
    or public.is_superadmin()
  );

-- Cualquier usuario autenticado puede crear un grupo
create policy "groups_insert_authenticated"
  on public.groups for insert
  to authenticated
  with check (leader_id = auth.uid());

-- Solo el líder puede actualizar su grupo
create policy "groups_update_leader"
  on public.groups for update
  to authenticated
  using (leader_id = auth.uid())
  with check (leader_id = auth.uid());

-- Solo el superadmin puede eliminar grupos
create policy "groups_delete_superadmin"
  on public.groups for delete
  to authenticated
  using (public.is_superadmin());

-- ─────────────────────────────────────────────────────────────
-- GROUP MEMBERS
-- ─────────────────────────────────────────────────────────────
-- Los miembros activos del grupo pueden ver la lista de miembros
create policy "group_members_select"
  on public.group_members for select
  to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.group_members gm
      where gm.group_id = group_id
        and gm.user_id = auth.uid()
        and gm.status = 'active'
    )
    or public.is_superadmin()
  );

-- Un usuario puede solicitar unirse (insertar con status pending)
create policy "group_members_insert_self"
  on public.group_members for insert
  to authenticated
  with check (user_id = auth.uid());

-- Solo el líder del grupo puede actualizar el status de los miembros
create policy "group_members_update_leader"
  on public.group_members for update
  to authenticated
  using (
    exists (
      select 1 from public.groups g
      where g.id = group_id and g.leader_id = auth.uid()
    )
    or public.is_superadmin()
  );

-- Solo el líder puede expulsar miembros (delete)
create policy "group_members_delete_leader"
  on public.group_members for delete
  to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.groups g
      where g.id = group_id and g.leader_id = auth.uid()
    )
    or public.is_superadmin()
  );

-- ─────────────────────────────────────────────────────────────
-- PRODES
-- ─────────────────────────────────────────────────────────────
-- Solo el propio usuario y miembros activos de su grupo pueden verlo
create policy "prodes_select"
  on public.prodes for select
  to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.group_members gm
      where gm.group_id = group_id
        and gm.user_id = auth.uid()
        and gm.status = 'active'
    )
    or public.is_superadmin()
  );

-- Un usuario puede inscribirse (crear prode) en un grupo del que es miembro activo
create policy "prodes_insert_self"
  on public.prodes for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.group_members gm
      where gm.group_id = group_id
        and gm.user_id = auth.uid()
        and gm.status = 'active'
    )
  );

-- Solo Edge Function (service_role) puede actualizar puntos finales
create policy "prodes_update_service_role"
  on public.prodes for update
  to service_role
  using (true);

-- ─────────────────────────────────────────────────────────────
-- PREDICTIONS
-- ─────────────────────────────────────────────────────────────
-- Antes del cierre: solo el propio usuario ve sus predicciones
-- Después del cierre: miembros del grupo pueden ver todas (para el ranking)
create policy "predictions_select"
  on public.predictions for select
  to authenticated
  using (
    user_id = auth.uid()
    or (
      -- Partido cerrado: todos los miembros activos del grupo pueden ver
      exists (
        select 1 from public.matches m
        where m.id = match_id and m.status = 'finished'
      )
      and exists (
        select 1 from public.group_members gm
        where gm.group_id = group_id
          and gm.user_id = auth.uid()
          and gm.status = 'active'
      )
    )
    or public.is_superadmin()
  );

-- Solo el propio usuario puede cargar su predicción, antes del deadline
create policy "predictions_insert_before_deadline"
  on public.predictions for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.matches m
      where m.id = match_id
        and m.status = 'scheduled'
        and now() < m.prediction_deadline
    )
    and exists (
      select 1 from public.group_members gm
      where gm.group_id = group_id
        and gm.user_id = auth.uid()
        and gm.status = 'active'
    )
  );

-- Solo el propio usuario puede editar su predicción, antes del deadline
create policy "predictions_update_before_deadline"
  on public.predictions for update
  to authenticated
  using (
    user_id = auth.uid()
    and exists (
      select 1 from public.matches m
      where m.id = match_id
        and m.status = 'scheduled'
        and now() < m.prediction_deadline
    )
  )
  with check (user_id = auth.uid());

-- Solo la Edge Function actualiza points_earned
create policy "predictions_update_service_role"
  on public.predictions for update
  to service_role
  using (true);

-- ─────────────────────────────────────────────────────────────
-- SCORES (cache — solo escribe la Edge Function)
-- ─────────────────────────────────────────────────────────────
-- Todos los miembros activos del grupo pueden ver el ranking
create policy "scores_select_group_members"
  on public.scores for select
  to authenticated
  using (
    exists (
      select 1 from public.group_members gm
      where gm.group_id = group_id
        and gm.user_id = auth.uid()
        and gm.status = 'active'
    )
    or public.is_superadmin()
  );

-- Solo la Edge Function (service_role) puede insertar/actualizar scores
create policy "scores_write_service_role"
  on public.scores for all
  to service_role
  using (true);
