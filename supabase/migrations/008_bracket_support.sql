-- ─────────────────────────────────────────────────────────────────────────────
-- 008_bracket_support.sql
-- Extiende el modelo para fases eliminatorias dinámicas (Mundial 2026):
--   · bracket_id y campos de fuente por posición en matches
--   · tabla group_standings (cache de posiciones)
--   · tabla third_place_lookup (asignación de terceros a llaves R16)
--   · RLS para las nuevas tablas
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── 1. Nuevas columnas en matches ──────────────────────────────────────────

ALTER TABLE public.matches
  ADD COLUMN bracket_id           text UNIQUE,
  ADD COLUMN home_source_position text CHECK (home_source_position IN ('1st', '2nd', '3rd')),
  ADD COLUMN away_source_position text CHECK (away_source_position IN ('1st', '2nd', '3rd')),
  ADD COLUMN home_source_groups   text,
  ADD COLUMN away_source_groups   text;

-- Índice para búsquedas por bracket_id
CREATE INDEX matches_bracket_id_idx ON public.matches (bracket_id);

-- ─── 2. Tabla group_standings ────────────────────────────────────────────────
-- Cache de posiciones calculado por la Edge Function calculate-group-standings.
-- No se edita manualmente.

CREATE TABLE public.group_standings (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id   uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  group_name      text NOT NULL,
  team_id         uuid NOT NULL REFERENCES public.teams(id),
  position        integer NOT NULL,
  played          integer NOT NULL DEFAULT 0,
  won             integer NOT NULL DEFAULT 0,
  drawn           integer NOT NULL DEFAULT 0,
  lost            integer NOT NULL DEFAULT 0,
  goals_for       integer NOT NULL DEFAULT 0,
  goals_against   integer NOT NULL DEFAULT 0,
  goal_difference integer GENERATED ALWAYS AS (goals_for - goals_against) STORED,
  points          integer NOT NULL DEFAULT 0,
  calculated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tournament_id, group_name, team_id)
);

CREATE INDEX group_standings_tournament_id_idx ON public.group_standings (tournament_id);
CREATE INDEX group_standings_group_name_idx    ON public.group_standings (tournament_id, group_name);

-- ─── 3. Tabla third_place_lookup ─────────────────────────────────────────────
-- Tabla fija con las combinaciones que determinan a qué llave R16 va
-- cada mejor tercero según los grupos de origen.
--
-- Estructura:
--   groups_key   = Los 8 grupos cuyos terceros clasificaron, ordenados alfa.
--                  Ej: 'A,B,D,E,F,G,I,J'
--   source_group = El grupo específico cuyo tercero se asigna en esta fila.
--                  Ej: 'A'
--   bracket_slot = bracket_id del partido R16 destino, ej: 'R16_H'
--   source_side  = 'home' o 'away' dentro de ese partido
--
-- Cada combinación (groups_key) tiene exactamente 8 filas (una por tercero).
-- Poblar con el seed oficial de FIFA una vez se publiquen las reglas del
-- torneo. Ver: supabase/seeds/third_place_lookup_seed.sql
--
-- Nota: C(12,8) = 495 combinaciones × 8 filas = 3.960 filas en total.

CREATE TABLE public.third_place_lookup (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  groups_key   text NOT NULL,
  source_group text NOT NULL,
  bracket_slot text NOT NULL,
  source_side  text NOT NULL CHECK (source_side IN ('home', 'away')),
  UNIQUE (groups_key, source_group)
);

CREATE INDEX third_place_lookup_groups_key_idx ON public.third_place_lookup (groups_key);

-- ─── 4. Row Level Security ───────────────────────────────────────────────────

ALTER TABLE public.group_standings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.third_place_lookup ENABLE ROW LEVEL SECURITY;

-- group_standings: lectura para usuarios autenticados
CREATE POLICY "standings_select"
  ON public.group_standings
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- group_standings: escritura solo superadmin / Edge Functions (service_role)
CREATE POLICY "standings_write"
  ON public.group_standings
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'superadmin'
    )
  );

-- third_place_lookup: lectura pública (no contiene datos sensibles)
CREATE POLICY "third_place_lookup_select"
  ON public.third_place_lookup
  FOR SELECT
  USING (true);
