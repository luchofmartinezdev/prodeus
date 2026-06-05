import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type ScoringRuleKey = 'exact_score' | 'correct_winner' | 'correct_goals_only' | 'no_match';

function calcWinner(home: number, away: number): 'home' | 'away' | 'draw' {
  if (home > away) return 'home';
  if (away > home) return 'away';
  return 'draw';
}

function calcRuleKey(
  predHome: number,
  predAway: number,
  realHome: number,
  realAway: number,
): ScoringRuleKey {
  if (predHome === realHome && predAway === realAway) return 'exact_score';
  if (calcWinner(predHome, predAway) === calcWinner(realHome, realAway)) return 'correct_winner';
  if (predHome === realHome || predAway === realAway) return 'correct_goals_only';
  return 'no_match';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  }

  try {
    return await handleRequest(req);
  } catch (e) {
    console.error('Unhandled error:', e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function handleRequest(req: Request): Promise<Response> {
  let matchId: string;
  try {
    const body = await req.json();
    matchId = body.match_id;
    if (!matchId) throw new Error('match_id required');
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request body' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // 1. Load match
  const { data: match, error: matchErr } = await supabase
    .from('matches')
    .select('id, tournament_id, home_score, away_score, status')
    .eq('id', matchId)
    .single();

  if (matchErr || !match) {
    return new Response(JSON.stringify({ error: 'Match not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (match.status !== 'finished' || match.home_score === null || match.away_score === null) {
    return new Response(JSON.stringify({ error: 'Match is not finished or has no result' }), {
      status: 422,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // 2. Load scoring rules for this tournament
  const { data: rules, error: rulesErr } = await supabase
    .from('scoring_rules')
    .select('rule_key, points_value')
    .eq('tournament_id', match.tournament_id);

  if (rulesErr) {
    return new Response(JSON.stringify({ error: 'Could not load scoring rules' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const pointsMap: Record<ScoringRuleKey, number> = {
    exact_score: 0,
    correct_winner: 0,
    correct_goals_only: 0,
    no_match: 0,
  };
  for (const rule of rules ?? []) {
    pointsMap[rule.rule_key as ScoringRuleKey] = rule.points_value;
  }

  // 3. Load all predictions for this match
  const { data: predictions, error: predsErr } = await supabase
    .from('predictions')
    .select('id, user_id, group_id, predicted_home, predicted_away')
    .eq('match_id', matchId);

  if (predsErr) {
    return new Response(JSON.stringify({ error: 'Could not load predictions' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (!predictions || predictions.length === 0) {
    return new Response(JSON.stringify({ scored: 0 }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // 4. Calculate points for each prediction and batch-upsert in one roundtrip
  const updates = predictions.map((p) => ({
    id: p.id,
    user_id: p.user_id,
    group_id: p.group_id,
    points_earned:
      pointsMap[
        calcRuleKey(p.predicted_home, p.predicted_away, match.home_score, match.away_score)
      ],
  }));

  const { error: batchPredErr } = await supabase.from('predictions').upsert(
    updates.map(({ id, points_earned }) => ({ id, points_earned })),
    { onConflict: 'id' },
  );

  if (batchPredErr) {
    console.error('Batch update predictions error:', batchPredErr);
    return new Response(
      JSON.stringify({ error: 'Could not update predictions', detail: batchPredErr.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  // 5. Recalculate total_points per user+group with a single batch fetch + batch upsert
  const affectedPairs = new Map<string, { user_id: string; group_id: string }>();
  for (const p of predictions) {
    affectedPairs.set(`${p.user_id}:${p.group_id}`, { user_id: p.user_id, group_id: p.group_id });
  }

  const affectedUserIds = [...new Set(predictions.map((p) => p.user_id))];
  const affectedGroupIds = [...new Set(predictions.map((p) => p.group_id))];

  const { data: allPoints, error: allPointsErr } = await supabase
    .from('predictions')
    .select('user_id, group_id, points_earned')
    .in('user_id', affectedUserIds)
    .in('group_id', affectedGroupIds)
    .not('points_earned', 'is', null);

  if (allPointsErr) {
    console.error('Could not load points for score recalculation:', allPointsErr);
    return new Response(JSON.stringify({ scored: updates.length, scores_updated: false }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const totalsMap = new Map<string, number>();
  for (const row of allPoints ?? []) {
    const key = `${row.user_id}:${row.group_id}`;
    totalsMap.set(key, (totalsMap.get(key) ?? 0) + (row.points_earned ?? 0));
  }

  const scoreUpserts = [...affectedPairs.values()].map(({ user_id, group_id }) => ({
    user_id,
    group_id,
    tournament_id: match.tournament_id,
    total_points: totalsMap.get(`${user_id}:${group_id}`) ?? 0,
    last_calculated_at: new Date().toISOString(),
  }));

  const { error: scoresErr } = await supabase
    .from('scores')
    .upsert(scoreUpserts, { onConflict: 'user_id,group_id' });

  if (scoresErr) {
    console.error('Could not upsert scores:', scoresErr);
  }

  return new Response(JSON.stringify({ scored: updates.length }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
