-- ============================================================
-- PRODEUS — Seed: datos de prueba
-- ============================================================
-- IMPORTANTE: ejecutar DESPUÉS de las migraciones 001, 002 y 003.
-- Los usuarios se crean via Supabase Auth dashboard o CLI.
-- Este seed asume que ya existen los auth.users correspondientes.
--
-- UUIDs fijos para poder referenciar entre tablas en el seed.
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- PERFILES (simula el trigger handle_new_user ya ejecutado)
-- Reemplazar los UUIDs con los auth.users reales del proyecto.
-- ─────────────────────────────────────────────────────────────
-- insert into public.profiles (id, username, role)
-- values
--   ('00000000-0000-0000-0000-000000000001', 'superadmin', 'superadmin'),
--   ('00000000-0000-0000-0000-000000000002', 'jugador_uno', 'user'),
--   ('00000000-0000-0000-0000-000000000003', 'jugador_dos', 'user'),
--   ('00000000-0000-0000-0000-000000000004', 'jugador_tres', 'user');

-- ─────────────────────────────────────────────────────────────
-- TORNEO DE PRUEBA
-- ─────────────────────────────────────────────────────────────
insert into public.tournaments (id, name, description, start_date, end_date, status)
values (
  'aaaaaaaa-0000-0000-0000-000000000001',
  'Copa de Prueba 2025',
  'Torneo de prueba para desarrollo y testing de Prodeus.',
  '2025-06-01',
  '2025-07-15',
  'active'
);

-- Crear reglas de puntuación por defecto para el torneo
select public.create_default_scoring_rules('aaaaaaaa-0000-0000-0000-000000000001');

-- ─────────────────────────────────────────────────────────────
-- EQUIPOS
-- ─────────────────────────────────────────────────────────────
insert into public.teams (id, tournament_id, name, short_name)
values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Argentina',  'ARG'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'Brasil',     'BRA'),
  ('bbbbbbbb-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000001', 'Uruguay',    'URU'),
  ('bbbbbbbb-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000001', 'Colombia',   'COL'),
  ('bbbbbbbb-0000-0000-0000-000000000005', 'aaaaaaaa-0000-0000-0000-000000000001', 'Chile',      'CHI'),
  ('bbbbbbbb-0000-0000-0000-000000000006', 'aaaaaaaa-0000-0000-0000-000000000001', 'Paraguay',   'PAR');

-- ─────────────────────────────────────────────────────────────
-- PARTIDOS
-- ─────────────────────────────────────────────────────────────
insert into public.matches (id, tournament_id, home_team_id, away_team_id, match_date, prediction_deadline, status, round)
values
  -- Fecha 1: partidos futuros (abiertos para predicción)
  (
    'cccccccc-0000-0000-0000-000000000001',
    'aaaaaaaa-0000-0000-0000-000000000001',
    'bbbbbbbb-0000-0000-0000-000000000001', -- ARG
    'bbbbbbbb-0000-0000-0000-000000000002', -- BRA
    '2025-06-10 20:00:00+00',
    '2025-06-10 19:45:00+00',
    'scheduled',
    'Fecha 1'
  ),
  (
    'cccccccc-0000-0000-0000-000000000002',
    'aaaaaaaa-0000-0000-0000-000000000001',
    'bbbbbbbb-0000-0000-0000-000000000003', -- URU
    'bbbbbbbb-0000-0000-0000-000000000004', -- COL
    '2025-06-10 22:00:00+00',
    '2025-06-10 21:45:00+00',
    'scheduled',
    'Fecha 1'
  ),
  (
    'cccccccc-0000-0000-0000-000000000003',
    'aaaaaaaa-0000-0000-0000-000000000001',
    'bbbbbbbb-0000-0000-0000-000000000005', -- CHI
    'bbbbbbbb-0000-0000-0000-000000000006', -- PAR
    '2025-06-11 20:00:00+00',
    '2025-06-11 19:45:00+00',
    'scheduled',
    'Fecha 1'
  ),
  -- Fecha 2: partido ya jugado con resultado (para probar scoring)
  (
    'cccccccc-0000-0000-0000-000000000004',
    'aaaaaaaa-0000-0000-0000-000000000001',
    'bbbbbbbb-0000-0000-0000-000000000002', -- BRA
    'bbbbbbbb-0000-0000-0000-000000000003', -- URU
    '2025-06-05 20:00:00+00',
    '2025-06-05 19:45:00+00',
    'finished',
    'Fecha 0 (jugado)'
  );

-- Cargar resultado del partido jugado
update public.matches
set home_score = 2, away_score = 1
where id = 'cccccccc-0000-0000-0000-000000000004';

-- ─────────────────────────────────────────────────────────────
-- TORNEO DRAFT (para probar estados)
-- ─────────────────────────────────────────────────────────────
insert into public.tournaments (id, name, description, start_date, end_date, status)
values (
  'aaaaaaaa-0000-0000-0000-000000000002',
  'Liga Test (Borrador)',
  'Torneo en estado borrador — no visible para usuarios.',
  '2025-08-01',
  '2025-09-30',
  'draft'
);
