import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

/**
 * start-matches
 *
 * Intended to be called by a Supabase cron job every minute.
 * Finds all matches with status = 'scheduled' whose match_date <= now()
 * and updates them to 'in_progress'.
 *
 * Also accepts POST with an optional { dry_run: true } body to preview
 * which matches would be updated without actually changing them.
 */
Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  let dryRun = false;
  try {
    const body = await req.json().catch(() => ({}));
    dryRun = body?.dry_run === true;
  } catch {
    // no body — that's fine
  }

  const now = new Date().toISOString();

  // Find scheduled matches whose match_date has passed
  const { data: matches, error: fetchErr } = await supabase
    .from('matches')
    .select('id, match_date')
    .eq('status', 'scheduled')
    .lte('match_date', now);

  if (fetchErr) {
    return new Response(
      JSON.stringify({ error: 'Could not fetch matches', detail: fetchErr.message }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }

  if (!matches || matches.length === 0) {
    return new Response(JSON.stringify({ updated: 0 }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (dryRun) {
    return new Response(JSON.stringify({ dry_run: true, would_update: matches.length, matches }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const ids = matches.map((m) => m.id);

  const { error: updateErr } = await supabase
    .from('matches')
    .update({ status: 'in_progress' })
    .in('id', ids);

  if (updateErr) {
    return new Response(
      JSON.stringify({ error: 'Could not update matches', detail: updateErr.message }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }

  return new Response(JSON.stringify({ updated: ids.length, match_ids: ids }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
