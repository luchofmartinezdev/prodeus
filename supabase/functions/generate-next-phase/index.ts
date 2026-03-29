import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

// ─── Types ────────────────────────────────────────────────────

type Phase = 'R16' | 'R8' | 'QF' | 'SF' | 'FINAL';

interface GeneratePhaseResult {
  success: boolean;
  resolved: number;
  pending: string[];
  errors: string[];
}

interface MatchRow {
  id: string;
  bracket_id: string | null;
  status: string;
  home_team_id: string | null;
  away_team_id: string | null;
  home_score: number | null;
  away_score: number | null;
  home_source_match_id: string | null;
  away_source_match_id: string | null;
  home_source_result: 'winner' | 'loser' | null;
  away_source_result: 'winner' | 'loser' | null;
  home_source_position: '1st' | '2nd' | '3rd' | null;
  away_source_position: '1st' | '2nd' | '3rd' | null;
  home_source_groups: string | null;
  away_source_groups: string | null;
}

interface GroupStandingRow {
  group_name: string;
  team_id: string;
  position: number;
  points: number;
  goals_for: number;
  goals_against: number;
}

// ─── Helpers ──────────────────────────────────────────────────

/** Determinar ganador/perdedor de un partido finalizado */
function resolveTeam(match: MatchRow, side: 'winner' | 'loser'): string | null {
  if (match.home_score == null || match.away_score == null) return null;
  const homeWon = match.home_score > match.away_score;
  if (side === 'winner') return homeWon ? match.home_team_id : match.away_team_id;
  return homeWon ? match.away_team_id : match.home_team_id;
}

/** Comparador de desempate entre terceros (mismos criterios que calculate-group-standings) */
function compareThirds(a: GroupStandingRow, b: GroupStandingRow): number {
  if (b.points !== a.points) return b.points - a.points;
  const gdA = a.goals_for - a.goals_against;
  const gdB = b.goals_for - b.goals_against;
  if (gdB !== gdA) return gdB - gdA;
  return b.goals_for - a.goals_for;
}

// ─── Lógica de asignación de mejores terceros a slots R16 ─────
//
// Estrategia cuando third_place_lookup NO está poblada:
//   Asignación greedy "más restringido primero": se ordenan los slots R16 que
//   esperan un tercero por cantidad de candidatos disponibles (menor → más
//   restringido) y se asigna el mejor tercero disponible cuyo grupo esté en la
//   lista de candidatos del slot.
//
// Cuando third_place_lookup SÍ está poblada, se usa la tabla oficial FIFA.

async function resolveThirds(
  r16Matches: MatchRow[],
  standings: GroupStandingRow[],
  _tournamentId: string,
): Promise<Map<string, { teamId: string; side: 'home' | 'away' }>> {
  const result = new Map<string, { teamId: string; side: 'home' | 'away' }>();

  // Los 12 terceros (position === 3), uno por grupo
  const thirds = standings.filter((s) => s.position === 3).sort(compareThirds);

  // Los 8 mejores terceros que clasifican
  const best8 = thirds.slice(0, 8);
  const qualifiedGroups = best8.map((t) => t.group_name).sort();
  const groupsKey = qualifiedGroups.join(',');

  // Intentar con third_place_lookup (tabla oficial)
  const { data: lookupRows } = await supabase
    .from('third_place_lookup')
    .select('source_group, bracket_slot, source_side')
    .eq('groups_key', groupsKey);

  if (lookupRows && lookupRows.length > 0) {
    // Usar lookup oficial
    for (const row of lookupRows) {
      const third = best8.find((t) => t.group_name === row.source_group);
      if (third) {
        result.set(row.bracket_slot, {
          teamId: third.team_id,
          side: row.source_side as 'home' | 'away',
        });
      }
    }
    return result;
  }

  // Fallback greedy: sin lookup oficial
  // Construir mapa slot → lista de grupos candidatos
  interface SlotInfo {
    matchId: string;
    bracketId: string;
    side: 'home' | 'away';
    candidateGroups: string[];
  }

  const slots: SlotInfo[] = [];
  for (const m of r16Matches) {
    if (!m.bracket_id) continue;
    for (const side of ['home', 'away'] as const) {
      const position = side === 'home' ? m.home_source_position : m.away_source_position;
      const groups = side === 'home' ? m.home_source_groups : m.away_source_groups;
      if (position === '3rd' && groups) {
        slots.push({
          matchId: m.id,
          bracketId: m.bracket_id,
          side,
          candidateGroups: groups.split(',').map((g) => g.trim()),
        });
      }
    }
  }

  // Ordenar slots: más restringido primero (menos candidatos disponibles)
  const assignedTeams = new Set<string>();
  const assignedSlots = new Set<string>();

  while (assignedSlots.size < slots.length) {
    // Recalcular candidatos disponibles en cada pasada
    const ranked = slots
      .filter((s) => !assignedSlots.has(s.bracketId + ':' + s.side))
      .map((s) => ({
        ...s,
        available: best8.filter(
          (t) => s.candidateGroups.includes(t.group_name) && !assignedTeams.has(t.team_id),
        ),
      }))
      .sort((a, b) => a.available.length - b.available.length);

    if (ranked.length === 0) break;
    const slot = ranked[0];
    if (slot.available.length === 0) continue;

    const team = slot.available[0];
    result.set(slot.bracketId, { teamId: team.team_id, side: slot.side });
    assignedTeams.add(team.team_id);
    assignedSlots.add(slot.bracketId + ':' + slot.side);
  }

  return result;
}

// ─── Handler ─────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  let tournamentId: string;
  let phase: Phase;
  try {
    const body = await req.json();
    tournamentId = body.tournament_id;
    phase = body.phase;
    if (!tournamentId || !phase) throw new Error('tournament_id and phase required');
    if (!['R16', 'R8', 'QF', 'SF', 'FINAL'].includes(phase)) {
      throw new Error(`Invalid phase: ${phase}`);
    }
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const result: GeneratePhaseResult = { success: false, resolved: 0, pending: [], errors: [] };

  // ─── Cargar todos los partidos del torneo ─────────────────────
  const { data: allMatches, error: matchErr } = await supabase
    .from('matches')
    .select(
      'id, bracket_id, status, home_team_id, away_team_id, ' +
        'home_score, away_score, ' +
        'home_source_match_id, away_source_match_id, ' +
        'home_source_result, away_source_result, ' +
        'home_source_position, away_source_position, ' +
        'home_source_groups, away_source_groups',
    )
    .eq('tournament_id', tournamentId);

  if (matchErr || !allMatches) {
    return new Response(JSON.stringify({ ...result, errors: ['Could not load matches'] }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const matches = allMatches as MatchRow[];
  const matchById = new Map(matches.map((m) => [m.id, m]));

  // ─── Determinar partidos de la fase anterior y verificar que están finalizados ──

  const prevPhasePattern: Record<Phase, string> = {
    R16: 'GROUP', // bracket_id IS NULL
    R8: 'R16_',
    QF: 'R8_',
    SF: 'QF_',
    FINAL: 'SF_',
  };

  const prevPattern = prevPhasePattern[phase];
  const prevMatches =
    prevPattern === 'GROUP'
      ? matches.filter((m) => !m.bracket_id)
      : matches.filter((m) => m.bracket_id?.startsWith(prevPattern));

  const unfinished = prevMatches.filter((m) => m.status !== 'finished');
  if (unfinished.length > 0) {
    result.pending = unfinished.map((m) => m.bracket_id ?? `group:${m.id}`);
    result.errors = [`Faltan ${unfinished.length} resultados de la fase anterior`];
    return new Response(JSON.stringify(result), {
      status: 422,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // ─── Obtener partidos destino (los que hay que resolver) ──────

  const targetPattern: Record<Phase, string | null> = {
    R16: 'R16_',
    R8: 'R8_',
    QF: 'QF_',
    SF: 'SF_',
    FINAL: null, // FINAL + THIRD
  };

  const targetMatches =
    phase === 'FINAL'
      ? matches.filter((m) => m.bracket_id === 'FINAL' || m.bracket_id === 'THIRD')
      : matches.filter((m) => m.bracket_id?.startsWith(targetPattern[phase]!));

  if (targetMatches.length === 0) {
    result.errors = [`No se encontraron partidos para la fase ${phase}`];
    return new Response(JSON.stringify(result), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // ─── Lógica específica por fase ───────────────────────────────

  if (phase === 'R16') {
    // Primero recalcular standings de grupos
    await supabase.functions.invoke('calculate-group-standings', {
      body: { tournament_id: tournamentId },
    });

    const { data: standingsData } = await supabase
      .from('group_standings')
      .select('group_name, team_id, position, points, goals_for, goals_against')
      .eq('tournament_id', tournamentId);

    const standings = (standingsData ?? []) as GroupStandingRow[];
    if (standings.length === 0) {
      result.errors = ['No se encontraron standings de grupos. ¿Se calcularon correctamente?'];
      return new Response(JSON.stringify(result), {
        status: 422,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Mapa grupo → posición → team_id
    const standingMap = new Map<string, Map<number, string>>();
    for (const s of standings) {
      if (!standingMap.has(s.group_name)) standingMap.set(s.group_name, new Map());
      standingMap.get(s.group_name)!.set(s.position, s.team_id);
    }

    // Resolver los terceros con su asignación a slots
    const thirdAssignment = await resolveThirds(targetMatches, standings, tournamentId);

    for (const match of targetMatches) {
      if (!match.bracket_id) continue;
      // Idempotencia: no reescribir si ya está resuelto
      if (match.home_team_id && match.away_team_id) continue;

      const update: { home_team_id?: string; away_team_id?: string } = {};

      for (const side of ['home', 'away'] as const) {
        const teamId = side === 'home' ? match.home_team_id : match.away_team_id;
        if (teamId) continue; // ya resuelto

        const position = side === 'home' ? match.home_source_position : match.away_source_position;
        const groups = side === 'home' ? match.home_source_groups : match.away_source_groups;

        if (position === '3rd') {
          // Buscar en la asignación de terceros
          const assigned = thirdAssignment.get(match.bracket_id);
          if (assigned && assigned.side === side) {
            update[`${side}_team_id`] = assigned.teamId;
          }
        } else if (position && groups) {
          // 1st o 2nd de un grupo específico
          const groupTeams = standingMap.get(groups.trim());
          const pos = position === '1st' ? 1 : 2;
          const resolved = groupTeams?.get(pos);
          if (resolved) update[`${side}_team_id`] = resolved;
        }
      }

      if (Object.keys(update).length === 0) {
        result.pending.push(match.bracket_id);
        continue;
      }

      const { error: updateErr } = await supabase.from('matches').update(update).eq('id', match.id);

      if (updateErr) {
        result.errors.push(`Error actualizando ${match.bracket_id}: ${updateErr.message}`);
      } else {
        result.resolved++;
      }
    }
  } else {
    // R8, QF, SF, FINAL — resolver ganadores/perdedores de fase anterior
    for (const match of targetMatches) {
      if (!match.bracket_id) continue;
      // Idempotencia
      if (match.home_team_id && match.away_team_id) continue;

      const update: { home_team_id?: string; away_team_id?: string } = {};

      for (const side of ['home', 'away'] as const) {
        const currentTeamId = side === 'home' ? match.home_team_id : match.away_team_id;
        if (currentTeamId) continue;

        const sourceMatchId =
          side === 'home' ? match.home_source_match_id : match.away_source_match_id;
        const sourceResult = side === 'home' ? match.home_source_result : match.away_source_result;

        if (!sourceMatchId || !sourceResult) {
          result.errors.push(
            `${match.bracket_id}: falta source_match_id o source_result para ${side}`,
          );
          continue;
        }

        const sourceMatch = matchById.get(sourceMatchId);
        if (!sourceMatch) {
          result.errors.push(`${match.bracket_id}: partido fuente ${sourceMatchId} no encontrado`);
          continue;
        }
        if (sourceMatch.status !== 'finished') {
          result.pending.push(match.bracket_id);
          continue;
        }

        const resolved = resolveTeam(sourceMatch, sourceResult);
        if (resolved) update[`${side}_team_id`] = resolved;
      }

      if (Object.keys(update).length === 0) continue;

      const { error: updateErr } = await supabase.from('matches').update(update).eq('id', match.id);

      if (updateErr) {
        result.errors.push(`Error actualizando ${match.bracket_id}: ${updateErr.message}`);
      } else {
        result.resolved++;
      }
    }
  }

  result.success = result.errors.length === 0;
  return new Response(JSON.stringify(result), {
    headers: { 'Content-Type': 'application/json' },
  });
});
