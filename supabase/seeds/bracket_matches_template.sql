-- ─────────────────────────────────────────────────────────────────────────────
-- bracket_matches_template.sql
-- Seed de partidos eliminatorios para el torneo indicado.
--
-- INSTRUCCIONES:
--   1. Reemplazar TODAS las ocurrencias de '<TOURNAMENT_ID>' con el UUID real
--      del torneo. Ejemplo con psql:
--        psql "$DATABASE_URL" \
--          -v tid="'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'" \
--          -f supabase/seeds/bracket_matches_template.sql
--      y cambiar las referencias de '<TOURNAMENT_ID>' por :tid
--
--   2. Ejecutar en el orden: R16 → R8 → QF → SF/THIRD/FINAL
--      (cada bloque DO $$ lee los IDs del bloque anterior).
--
--   3. Las fechas son PLACEHOLDER. Actualizar cuando FIFA confirme el fixture.
--
--   4. Los partidos se insertan con home_team_id = NULL y away_team_id = NULL.
--      El botón "Calcular fase siguiente" los resolverá en el momento correcto.
-- ─────────────────────────────────────────────────────────────────────────────

-- ══ BLOQUE 1: 16avos de final ════════════════════════════════════════════════
DO $$
DECLARE v_tid uuid := '<TOURNAMENT_ID>';
BEGIN

INSERT INTO public.matches
  (tournament_id, bracket_id, round, status,
   home_source_position, home_source_groups,
   away_source_position, away_source_groups,
   match_date, prediction_deadline)
VALUES
  -- R16_A: 1E vs Mejor 3ro A/B/C/D/F
  (v_tid,'R16_A','Round of 16','scheduled','1st','E',        '3rd','A,B,C,D,F',  '2026-06-29 18:00+00','2026-06-29 18:00+00'),
  -- R16_B: 1I vs Mejor 3ro C/D/F/G/H
  (v_tid,'R16_B','Round of 16','scheduled','1st','I',        '3rd','C,D,F,G,H',  '2026-06-29 22:00+00','2026-06-29 22:00+00'),
  -- R16_C: 2A vs 2B
  (v_tid,'R16_C','Round of 16','scheduled','2nd','A',        '2nd','B',           '2026-06-30 18:00+00','2026-06-30 18:00+00'),
  -- R16_D: 1F vs 2C
  (v_tid,'R16_D','Round of 16','scheduled','1st','F',        '2nd','C',           '2026-06-30 22:00+00','2026-06-30 22:00+00'),
  -- R16_E: 2K vs 2L
  (v_tid,'R16_E','Round of 16','scheduled','2nd','K',        '2nd','L',           '2026-07-01 18:00+00','2026-07-01 18:00+00'),
  -- R16_F: 1H vs 2J
  (v_tid,'R16_F','Round of 16','scheduled','1st','H',        '2nd','J',           '2026-07-01 22:00+00','2026-07-01 22:00+00'),
  -- R16_G: 1D vs Mejor 3ro B/E/F/I/J
  (v_tid,'R16_G','Round of 16','scheduled','1st','D',        '3rd','B,E,F,I,J',  '2026-07-02 18:00+00','2026-07-02 18:00+00'),
  -- R16_H: 1G vs Mejor 3ro A/E/H/I/J
  (v_tid,'R16_H','Round of 16','scheduled','1st','G',        '3rd','A,E,H,I,J',  '2026-07-02 22:00+00','2026-07-02 22:00+00'),
  -- R16_I: 1C vs 2F
  (v_tid,'R16_I','Round of 16','scheduled','1st','C',        '2nd','F',           '2026-07-03 18:00+00','2026-07-03 18:00+00'),
  -- R16_J: 2E vs 2I
  (v_tid,'R16_J','Round of 16','scheduled','2nd','E',        '2nd','I',           '2026-07-03 22:00+00','2026-07-03 22:00+00'),
  -- R16_K: 1A vs Mejor 3ro C/E/F/H/I
  (v_tid,'R16_K','Round of 16','scheduled','1st','A',        '3rd','C,E,F,H,I',  '2026-07-04 18:00+00','2026-07-04 18:00+00'),
  -- R16_L: 1L vs Mejor 3ro E/H/I/J/K
  (v_tid,'R16_L','Round of 16','scheduled','1st','L',        '3rd','E,H,I,J,K',  '2026-07-04 22:00+00','2026-07-04 22:00+00'),
  -- R16_M: 1J vs 2H
  (v_tid,'R16_M','Round of 16','scheduled','1st','J',        '2nd','H',           '2026-07-05 18:00+00','2026-07-05 18:00+00'),
  -- R16_N: 2D vs 2G
  (v_tid,'R16_N','Round of 16','scheduled','2nd','D',        '2nd','G',           '2026-07-05 22:00+00','2026-07-05 22:00+00'),
  -- R16_O: 1B vs Mejor 3ro E/F/G/I/J
  (v_tid,'R16_O','Round of 16','scheduled','1st','B',        '3rd','E,F,G,I,J',  '2026-07-06 18:00+00','2026-07-06 18:00+00'),
  -- R16_P: 1K vs Mejor 3ro D/E/I/J/L
  (v_tid,'R16_P','Round of 16','scheduled','1st','K',        '3rd','D,E,I,J,L',  '2026-07-06 22:00+00','2026-07-06 22:00+00');

END $$;

-- ══ BLOQUE 2: Octavos de final ════════════════════════════════════════════════
DO $$
DECLARE
  v_tid  uuid := '<TOURNAMENT_ID>';
  r16_a  uuid; r16_b uuid; r16_c uuid; r16_d uuid;
  r16_e  uuid; r16_f uuid; r16_g uuid; r16_h uuid;
  r16_i  uuid; r16_j uuid; r16_k uuid; r16_l uuid;
  r16_m  uuid; r16_n uuid; r16_o uuid; r16_p uuid;
BEGIN
  SELECT id INTO r16_a FROM public.matches WHERE bracket_id = 'R16_A';
  SELECT id INTO r16_b FROM public.matches WHERE bracket_id = 'R16_B';
  SELECT id INTO r16_c FROM public.matches WHERE bracket_id = 'R16_C';
  SELECT id INTO r16_d FROM public.matches WHERE bracket_id = 'R16_D';
  SELECT id INTO r16_e FROM public.matches WHERE bracket_id = 'R16_E';
  SELECT id INTO r16_f FROM public.matches WHERE bracket_id = 'R16_F';
  SELECT id INTO r16_g FROM public.matches WHERE bracket_id = 'R16_G';
  SELECT id INTO r16_h FROM public.matches WHERE bracket_id = 'R16_H';
  SELECT id INTO r16_i FROM public.matches WHERE bracket_id = 'R16_I';
  SELECT id INTO r16_j FROM public.matches WHERE bracket_id = 'R16_J';
  SELECT id INTO r16_k FROM public.matches WHERE bracket_id = 'R16_K';
  SELECT id INTO r16_l FROM public.matches WHERE bracket_id = 'R16_L';
  SELECT id INTO r16_m FROM public.matches WHERE bracket_id = 'R16_M';
  SELECT id INTO r16_n FROM public.matches WHERE bracket_id = 'R16_N';
  SELECT id INTO r16_o FROM public.matches WHERE bracket_id = 'R16_O';
  SELECT id INTO r16_p FROM public.matches WHERE bracket_id = 'R16_P';

  INSERT INTO public.matches
    (tournament_id, bracket_id, round, status,
     home_source_match_id, home_source_result,
     away_source_match_id, away_source_result,
     match_date, prediction_deadline)
  VALUES
    (v_tid,'R8_1','Round of 8','scheduled', r16_a,'winner', r16_b,'winner', '2026-07-08 22:00+00','2026-07-08 22:00+00'),
    (v_tid,'R8_2','Round of 8','scheduled', r16_c,'winner', r16_d,'winner', '2026-07-09 18:00+00','2026-07-09 18:00+00'),
    (v_tid,'R8_3','Round of 8','scheduled', r16_e,'winner', r16_f,'winner', '2026-07-09 22:00+00','2026-07-09 22:00+00'),
    (v_tid,'R8_4','Round of 8','scheduled', r16_g,'winner', r16_h,'winner', '2026-07-10 18:00+00','2026-07-10 18:00+00'),
    (v_tid,'R8_5','Round of 8','scheduled', r16_i,'winner', r16_j,'winner', '2026-07-10 22:00+00','2026-07-10 22:00+00'),
    (v_tid,'R8_6','Round of 8','scheduled', r16_k,'winner', r16_l,'winner', '2026-07-11 18:00+00','2026-07-11 18:00+00'),
    (v_tid,'R8_7','Round of 8','scheduled', r16_m,'winner', r16_n,'winner', '2026-07-11 22:00+00','2026-07-11 22:00+00'),
    (v_tid,'R8_8','Round of 8','scheduled', r16_o,'winner', r16_p,'winner', '2026-07-12 18:00+00','2026-07-12 18:00+00');
END $$;

-- ══ BLOQUE 3: Cuartos de final ════════════════════════════════════════════════
DO $$
DECLARE
  v_tid uuid := '<TOURNAMENT_ID>';
  r8_1  uuid; r8_2 uuid; r8_3 uuid; r8_4 uuid;
  r8_5  uuid; r8_6 uuid; r8_7 uuid; r8_8 uuid;
BEGIN
  SELECT id INTO r8_1 FROM public.matches WHERE bracket_id = 'R8_1';
  SELECT id INTO r8_2 FROM public.matches WHERE bracket_id = 'R8_2';
  SELECT id INTO r8_3 FROM public.matches WHERE bracket_id = 'R8_3';
  SELECT id INTO r8_4 FROM public.matches WHERE bracket_id = 'R8_4';
  SELECT id INTO r8_5 FROM public.matches WHERE bracket_id = 'R8_5';
  SELECT id INTO r8_6 FROM public.matches WHERE bracket_id = 'R8_6';
  SELECT id INTO r8_7 FROM public.matches WHERE bracket_id = 'R8_7';
  SELECT id INTO r8_8 FROM public.matches WHERE bracket_id = 'R8_8';

  INSERT INTO public.matches
    (tournament_id, bracket_id, round, status,
     home_source_match_id, home_source_result,
     away_source_match_id, away_source_result,
     match_date, prediction_deadline)
  VALUES
    (v_tid,'QF_1','Quarter-final','scheduled', r8_1,'winner', r8_2,'winner', '2026-07-14 22:00+00','2026-07-14 22:00+00'),
    (v_tid,'QF_2','Quarter-final','scheduled', r8_3,'winner', r8_4,'winner', '2026-07-15 18:00+00','2026-07-15 18:00+00'),
    (v_tid,'QF_3','Quarter-final','scheduled', r8_5,'winner', r8_6,'winner', '2026-07-15 22:00+00','2026-07-15 22:00+00'),
    (v_tid,'QF_4','Quarter-final','scheduled', r8_7,'winner', r8_8,'winner', '2026-07-16 18:00+00','2026-07-16 18:00+00');
END $$;

-- ══ BLOQUE 4: Semifinales, Tercer puesto y Final ══════════════════════════════
DO $$
DECLARE
  v_tid uuid := '<TOURNAMENT_ID>';
  qf_1  uuid; qf_2 uuid; qf_3 uuid; qf_4 uuid;
  sf_1  uuid; sf_2 uuid;
BEGIN
  SELECT id INTO qf_1 FROM public.matches WHERE bracket_id = 'QF_1';
  SELECT id INTO qf_2 FROM public.matches WHERE bracket_id = 'QF_2';
  SELECT id INTO qf_3 FROM public.matches WHERE bracket_id = 'QF_3';
  SELECT id INTO qf_4 FROM public.matches WHERE bracket_id = 'QF_4';

  INSERT INTO public.matches
    (tournament_id, bracket_id, round, status,
     home_source_match_id, home_source_result,
     away_source_match_id, away_source_result,
     match_date, prediction_deadline)
  VALUES
    (v_tid,'SF_1','Semi-final','scheduled', qf_1,'winner', qf_2,'winner', '2026-07-18 22:00+00','2026-07-18 22:00+00'),
    (v_tid,'SF_2','Semi-final','scheduled', qf_3,'winner', qf_4,'winner', '2026-07-19 22:00+00','2026-07-19 22:00+00');

  SELECT id INTO sf_1 FROM public.matches WHERE bracket_id = 'SF_1';
  SELECT id INTO sf_2 FROM public.matches WHERE bracket_id = 'SF_2';

  INSERT INTO public.matches
    (tournament_id, bracket_id, round, status,
     home_source_match_id, home_source_result,
     away_source_match_id, away_source_result,
     match_date, prediction_deadline)
  VALUES
    -- Tercer puesto: perdedores de semis
    (v_tid,'THIRD','Third place','scheduled', sf_1,'loser',  sf_2,'loser',  '2026-07-18 18:00+00','2026-07-18 18:00+00'),
    -- Final: ganadores de semis
    (v_tid,'FINAL','Final',      'scheduled', sf_1,'winner', sf_2,'winner', '2026-07-19 18:00+00','2026-07-19 18:00+00');
END $$;
