-- ─────────────────────────────────────────────────────────────
-- 006_scoring_rules_global.sql
-- Convierte scoring_rules de por-torneo a global.
-- Los puntos son los mismos para todos los torneos.
-- ─────────────────────────────────────────────────────────────

-- 1. Limpiar tabla (los registros actuales son por torneo, ya no sirven)
truncate public.scoring_rules;

-- 2. Eliminar columna tournament_id, índice y constraint
alter table public.scoring_rules
  drop constraint if exists scoring_rules_unique_key_per_tournament,
  drop column if exists tournament_id;

drop index if exists scoring_rules_tournament_id_idx;

-- 3. Nueva constraint: rule_key único globalmente
alter table public.scoring_rules
  add constraint scoring_rules_unique_key unique (rule_key);

-- 4. Insertar reglas globales por defecto
insert into public.scoring_rules (rule_key, points_value, description)
values
  ('exact_score',        5, 'Resultado exacto (local y visitante)'),
  ('correct_winner',     2, 'Ganador correcto o empate (sin resultado exacto)'),
  ('correct_goals_only', 1, 'Goles de al menos un equipo correctos (sin ganador)'),
  ('no_match',           0, 'Sin aciertos')
on conflict (rule_key) do nothing;

-- 5. Eliminar función create_default_scoring_rules (ya no aplica)
drop function if exists public.create_default_scoring_rules(uuid);
