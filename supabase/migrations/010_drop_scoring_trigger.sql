-- Drop the DB trigger that called score-match via pg_net.
-- Scoring is now triggered exclusively from the frontend after loadResult,
-- using supabase.functions.invoke which has the configured anon key.

drop trigger if exists on_match_finished on public.matches;
drop function if exists public.trigger_score_match();
