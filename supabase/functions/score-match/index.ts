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

  // 2. Load scoring rules (global — not per tournament)
  const { data: rules, error: rulesErr } = await supabase
    .from('scoring_rules')
    .select('rule_key, points_value');

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

  // 4. Calculate and update points_earned for each prediction
  const updates = predictions.map((p) => ({
    id: p.id,
    user_id: p.user_id,
    group_id: p.group_id,
    points_earned:
      pointsMap[
        calcRuleKey(p.predicted_home, p.predicted_away, match.home_score, match.away_score)
      ],
  }));

  for (const { id, points_earned } of updates) {
    const { error: updateErr } = await supabase
      .from('predictions')
      .update({ points_earned })
      .eq('id', id);

    if (updateErr) {
      console.error('Update prediction error:', id, updateErr);
      return new Response(
        JSON.stringify({ error: 'Could not update predictions', detail: updateErr.message }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }
  }

  // 5. Recalculate total_points per user+group and upsert into scores
  const affectedPairs = new Map<string, { user_id: string; group_id: string }>();
  for (const p of predictions) {
    const key = `${p.user_id}:${p.group_id}`;
    affectedPairs.set(key, { user_id: p.user_id, group_id: p.group_id });
  }

  for (const { user_id, group_id } of affectedPairs.values()) {
    const { data: sumData, error: sumErr } = await supabase
      .from('predictions')
      .select('points_earned')
      .eq('user_id', user_id)
      .eq('group_id', group_id)
      .not('points_earned', 'is', null);

    if (sumErr) continue;

    const total = (sumData ?? []).reduce((acc, row) => acc + (row.points_earned ?? 0), 0);

    await supabase.from('scores').upsert(
      {
        user_id,
        group_id,
        tournament_id: match.tournament_id,
        total_points: total,
        last_calculated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,group_id' },
    );
  }

  return new Response(JSON.stringify({ scored: updates.length }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
