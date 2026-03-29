import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

// ─── Types ────────────────────────────────────────────────────

interface TeamStats {
  team_id: string;
  group_name: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goals_for: number;
  goals_against: number;
  points: number;
}

// ─── Comparador de desempate ──────────────────────────────────
// Criterios implementados (en orden):
//   1. Puntos (mayor primero)
//   2. Diferencia de goles (mayor primero)
//   3. Goles a favor (mayor primero)
//
// TODO (mejora futura):
//   4. Resultado head-to-head entre empatados
//   5. Diferencia de goles head-to-head
//   6. Goles a favor head-to-head

function compareStats(a: TeamStats, b: TeamStats): number {
  if (b.points !== a.points) return b.points - a.points;
  const gdA = a.goals_for - a.goals_against;
  const gdB = b.goals_for - b.goals_against;
  if (gdB !== gdA) return gdB - gdA;
  return b.goals_for - a.goals_for;
}

// ─── Handler ─────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  let tournamentId: string;
  try {
    const body = await req.json();
    tournamentId = body.tournament_id;
    if (!tournamentId) throw new Error('tournament_id required');
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 1. Cargar todos los partidos de fase de grupos terminados
  //    (bracket_id IS NULL = partido de grupos)
  const { data: matches, error: matchErr } = await supabase
    .from('matches')
    .select('home_team_id, away_team_id, home_score, away_score, round')
    .eq('tournament_id', tournamentId)
    .eq('status', 'finished')
    .is('bracket_id', null);

  if (matchErr) {
    return new Response(JSON.stringify({ error: 'Could not load matches' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 2. Cargar equipos del torneo para conocer su grupo (campo `round` del match
  //    guarda el nombre del grupo, ej: "Grupo A")
  //    Alternativa más robusta: en fase de grupos, el campo `round` contiene el
  //    nombre del grupo. Extraemos el grupo del campo round.
  //    Ej: "Grupo A" → "A", "Group B" → "B", "A" → "A"
  function extractGroupName(round: string | null): string | null {
    if (!round) return null;
    const match = round.match(/([A-L])$/i);
    return match ? match[1].toUpperCase() : round.trim().toUpperCase();
  }

  // 3. Acumular estadísticas por equipo
  const statsMap = new Map<string, TeamStats>();

  function getOrCreate(teamId: string, groupName: string): TeamStats {
    if (!statsMap.has(teamId)) {
      statsMap.set(teamId, {
        team_id: teamId,
        group_name: groupName,
        played: 0,
        won: 0,
        drawn: 0,
        lost: 0,
        goals_for: 0,
        goals_against: 0,
        points: 0,
      });
    }
    return statsMap.get(teamId)!;
  }

  for (const m of matches ?? []) {
    if (
      m.home_team_id == null ||
      m.away_team_id == null ||
      m.home_score == null ||
      m.away_score == null
    )
      continue;

    const groupName = extractGroupName(m.round);
    if (!groupName) continue;

    const home = getOrCreate(m.home_team_id, groupName);
    const away = getOrCreate(m.away_team_id, groupName);

    home.played++;
    away.played++;
    home.goals_for += m.home_score;
    home.goals_against += m.away_score;
    away.goals_for += m.away_score;
    away.goals_against += m.home_score;

    if (m.home_score > m.away_score) {
      home.won++;
      home.points += 3;
      away.lost++;
    } else if (m.home_score < m.away_score) {
      away.won++;
      away.points += 3;
      home.lost++;
    } else {
      home.drawn++;
      home.points += 1;
      away.drawn++;
      away.points += 1;
    }
  }

  // 4. Agrupar por grupo y asignar posiciones
  const byGroup = new Map<string, TeamStats[]>();
  for (const stats of statsMap.values()) {
    if (!byGroup.has(stats.group_name)) byGroup.set(stats.group_name, []);
    byGroup.get(stats.group_name)!.push(stats);
  }

  const upsertRows: object[] = [];
  const now = new Date().toISOString();

  for (const [groupName, teams] of byGroup.entries()) {
    teams.sort(compareStats);
    teams.forEach((t, idx) => {
      upsertRows.push({
        tournament_id: tournamentId,
        group_name: groupName,
        team_id: t.team_id,
        position: idx + 1,
        played: t.played,
        won: t.won,
        drawn: t.drawn,
        lost: t.lost,
        goals_for: t.goals_for,
        goals_against: t.goals_against,
        points: t.points,
        calculated_at: now,
      });
    });
  }

  if (upsertRows.length === 0) {
    return new Response(
      JSON.stringify({ success: true, standings: [], message: 'No finished group matches found' }),
      { headers: { 'Content-Type': 'application/json' } },
    );
  }

  // 5. UPSERT en group_standings
  const { error: upsertErr } = await supabase
    .from('group_standings')
    .upsert(upsertRows, { onConflict: 'tournament_id,group_name,team_id' });

  if (upsertErr) {
    return new Response(
      JSON.stringify({ error: 'Could not upsert standings', detail: upsertErr.message }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }

  return new Response(JSON.stringify({ success: true, standings: upsertRows }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
