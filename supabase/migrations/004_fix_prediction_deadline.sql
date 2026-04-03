-- ============================================================
-- PRODEUS — Migración 004: Arreglar deadlines iguales a match_date
-- ============================================================
-- Esta migración reesta 5 minutos a todos los prediction_deadline
-- que sean >= que su match_date (deadlines inválidos).

update public.matches
set prediction_deadline = match_date - interval '5 minutes'
where prediction_deadline >= match_date;
