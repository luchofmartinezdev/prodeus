-- ─────────────────────────────────────────────────────────────
-- 004_scoring_trigger.sql
-- Calls score-match Edge Function via pg_net when a match
-- transitions to status = 'finished'
-- ─────────────────────────────────────────────────────────────

-- Enable pg_net if not already enabled
create extension if not exists pg_net schema extensions;

-- Function that fires the HTTP call
create or replace function public.trigger_score_match()
returns trigger
language plpgsql
security definer
as $$
declare
  _url  text;
  _key  text;
begin
  -- Only act on status transitions TO 'finished'
  if new.status = 'finished' and (old.status is distinct from 'finished') then
    _url := current_setting('app.supabase_url', true) || '/functions/v1/score-match';
    _key := current_setting('app.supabase_anon_key', true);

    perform extensions.http_post(
      url     := _url,
      body    := json_build_object('match_id', new.id)::text,
      headers := json_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || _key
      )
    );
  end if;

  return new;
end;
$$;

-- Attach trigger to matches table
drop trigger if exists on_match_finished on public.matches;
create trigger on_match_finished
  after update on public.matches
  for each row
  execute function public.trigger_score_match();
