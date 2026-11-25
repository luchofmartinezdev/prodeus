import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { db } from '../admin';
import { calculateGroupStandingsInternal } from './calculateGroupStandings';

type Phase = 'R16' | 'R8' | 'QF' | 'SF' | 'FINAL';

interface GeneratePhaseRequest {
  tournamentId: string;
  phase: Phase;
}

interface GeneratePhaseResult {
  success: boolean;
  resolved: number;
  pending: string[];
  errors: string[];
}

interface MatchRow {
  id: string;
  bracketId: string | null;
  status: string;
  homeTeamId: string | null;
  awayTeamId: string | null;
  homeScore: number | null;
  awayScore: number | null;
  homeSourceMatchId: string | null;
  awaySourceMatchId: string | null;
  homeSourceResult: 'winner' | 'loser' | null;
  awaySourceResult: 'winner' | 'loser' | null;
  homeSourcePosition: '1st' | '2nd' | '3rd' | null;
  awaySourcePosition: '1st' | '2nd' | '3rd' | null;
  homeSourceGroups: string | null;
  awaySourceGroups: string | null;
}

interface GroupStandingRow {
  groupName: string;
  teamId: string;
  position: number;
  points: number;
  goalsFor: number;
  goalsAgainst: number;
}

function resolveTeam(match: MatchRow, side: 'winner' | 'loser'): string | null {
  if (match.homeScore == null || match.awayScore == null) return null;
  const homeWon = match.homeScore > match.awayScore;
  if (side === 'winner') return homeWon ? match.homeTeamId : match.awayTeamId;
  return homeWon ? match.awayTeamId : match.homeTeamId;
}

function compareThirds(a: GroupStandingRow, b: GroupStandingRow): number {
  if (b.points !== a.points) return b.points - a.points;
  const gdA = a.goalsFor - a.goalsAgainst;
  const gdB = b.goalsFor - b.goalsAgainst;
  if (gdB !== gdA) return gdB - gdA;
  return b.goalsFor - a.goalsFor;
}

async function resolveThirds(
  r16Matches: MatchRow[],
  standings: GroupStandingRow[],
): Promise<Map<string, { teamId: string; side: 'home' | 'away' }>> {
  const result = new Map<string, { teamId: string; side: 'home' | 'away' }>();

  const thirds = standings.filter((s) => s.position === 3).sort(compareThirds);
  const best8 = thirds.slice(0, 8);
  const qualifiedGroups = best8.map((t) => t.groupName).sort();
  const groupsKey = qualifiedGroups.join(',');

  const lookupSnap = await db
    .collection('thirdPlaceLookup')
    .where('groupsKey', '==', groupsKey)
    .get();

  if (!lookupSnap.empty) {
    for (const doc of lookupSnap.docs) {
      const row = doc.data();
      const third = best8.find((t) => t.groupName === row['sourceGroup']);
      if (third) {
        result.set(row['bracketSlot'], { teamId: third.teamId, side: row['sourceSide'] });
      }
    }
    return result;
  }

  // Fallback greedy (sin tabla oficial de terceros)
  interface SlotInfo {
    bracketId: string;
    side: 'home' | 'away';
    candidateGroups: string[];
  }
  const slots: SlotInfo[] = [];
  for (const m of r16Matches) {
    if (!m.bracketId) continue;
    for (const side of ['home', 'away'] as const) {
      const position = side === 'home' ? m.homeSourcePosition : m.awaySourcePosition;
      const groups = side === 'home' ? m.homeSourceGroups : m.awaySourceGroups;
      if (position === '3rd' && groups) {
        slots.push({
          bracketId: m.bracketId,
          side,
          candidateGroups: groups.split(',').map((g) => g.trim()),
        });
      }
    }
  }

  const assignedTeams = new Set<string>();
  const assignedSlots = new Set<string>();

  while (assignedSlots.size < slots.length) {
    const ranked = slots
      .filter((s) => !assignedSlots.has(s.bracketId + ':' + s.side))
      .map((s) => ({
        ...s,
        available: best8.filter(
          (t) => s.candidateGroups.includes(t.groupName) && !assignedTeams.has(t.teamId),
        ),
      }))
      .sort((a, b) => a.available.length - b.available.length);

    if (ranked.length === 0) break;
    const slot = ranked[0];
    if (slot.available.length === 0) continue;

    const team = slot.available[0];
    result.set(slot.bracketId, { teamId: team.teamId, side: slot.side });
    assignedTeams.add(team.teamId);
    assignedSlots.add(slot.bracketId + ':' + slot.side);
  }

  return result;
}

export const generateNextPhase = onCall<GeneratePhaseRequest>(async (request) => {
  const { tournamentId, phase } = request.data;
  if (!tournamentId || !phase)
    throw new HttpsError('invalid-argument', 'tournamentId y phase son requeridos');
  if (!['R16', 'R8', 'QF', 'SF', 'FINAL'].includes(phase)) {
    throw new HttpsError('invalid-argument', `Fase inválida: ${phase}`);
  }

  const callerUid = request.auth?.uid;
  if (!callerUid) throw new HttpsError('unauthenticated', 'Debe estar autenticado');
  const caller = await db.collection('users').doc(callerUid).get();
  if (caller.data()?.['role'] !== 'superadmin') {
    throw new HttpsError('permission-denied', 'Solo superadmin puede generar la siguiente fase');
  }

  const result: GeneratePhaseResult = { success: false, resolved: 0, pending: [], errors: [] };

  const matchesSnap = await db
    .collection('matches')
    .where('tournamentId', '==', tournamentId)
    .get();
  const matches: MatchRow[] = matchesSnap.docs.map(
    (d) => ({ id: d.id, ...(d.data() as object) }) as MatchRow,
  );
  const matchById = new Map(matches.map((m) => [m.id, m]));
  const refById = new Map(matchesSnap.docs.map((d) => [d.id, d.ref]));

  const prevPhasePattern: Record<Phase, string> = {
    R16: 'GROUP',
    R8: 'R16_',
    QF: 'R8_',
    SF: 'QF_',
    FINAL: 'SF_',
  };
  const prevPattern = prevPhasePattern[phase];
  const prevMatches =
    prevPattern === 'GROUP'
      ? matches.filter((m) => !m.bracketId)
      : matches.filter((m) => m.bracketId?.startsWith(prevPattern));

  const unfinished = prevMatches.filter((m) => m.status !== 'finished');
  if (unfinished.length > 0) {
    result.pending = unfinished.map((m) => m.bracketId ?? `group:${m.id}`);
    result.errors = [`Faltan ${unfinished.length} resultados de la fase anterior`];
    throw new HttpsError('failed-precondition', result.errors[0], result);
  }

  const targetPattern: Record<Phase, string | null> = {
    R16: 'R16_',
    R8: 'R8_',
    QF: 'QF_',
    SF: 'SF_',
    FINAL: null,
  };
  const targetMatches =
    phase === 'FINAL'
      ? matches.filter((m) => m.bracketId === 'FINAL' || m.bracketId === 'THIRD')
      : matches.filter((m) => m.bracketId?.startsWith(targetPattern[phase]!));

  if (targetMatches.length === 0) {
    result.errors = [`No se encontraron partidos para la fase ${phase}`];
    throw new HttpsError('not-found', result.errors[0], result);
  }

  const batch = db.batch();
  let writes = 0;

  if (phase === 'R16') {
    await calculateGroupStandingsInternal(tournamentId);

    const standingsSnap = await db
      .collection('groupStandings')
      .where('tournamentId', '==', tournamentId)
      .get();
    const standings: GroupStandingRow[] = standingsSnap.docs.map(
      (d) => d.data() as GroupStandingRow,
    );

    if (standings.length === 0) {
      result.errors = ['No se encontraron standings de grupos. ¿Se calcularon correctamente?'];
      throw new HttpsError('failed-precondition', result.errors[0], result);
    }

    const standingMap = new Map<string, Map<number, string>>();
    for (const s of standings) {
      if (!standingMap.has(s.groupName)) standingMap.set(s.groupName, new Map());
      standingMap.get(s.groupName)!.set(s.position, s.teamId);
    }

    const thirdAssignment = await resolveThirds(targetMatches, standings);

    for (const match of targetMatches) {
      if (!match.bracketId) continue;
      if (match.homeTeamId && match.awayTeamId) continue; // idempotencia

      const update: Record<string, string> = {};

      for (const side of ['home', 'away'] as const) {
        const teamId = side === 'home' ? match.homeTeamId : match.awayTeamId;
        if (teamId) continue;

        const position = side === 'home' ? match.homeSourcePosition : match.awaySourcePosition;
        const groups = side === 'home' ? match.homeSourceGroups : match.awaySourceGroups;

        if (position === '3rd') {
          const assigned = thirdAssignment.get(match.bracketId);
          if (assigned && assigned.side === side) {
            update[`${side}TeamId`] = assigned.teamId;
          }
        } else if (position && groups) {
          const groupTeams = standingMap.get(groups.trim());
          const pos = position === '1st' ? 1 : 2;
          const resolved = groupTeams?.get(pos);
          if (resolved) update[`${side}TeamId`] = resolved;
        }
      }

      if (Object.keys(update).length === 0) {
        result.pending.push(match.bracketId);
        continue;
      }

      batch.update(refById.get(match.id)!, update);
      writes++;
      result.resolved++;
    }
  } else {
    for (const match of targetMatches) {
      if (!match.bracketId) continue;
      if (match.homeTeamId && match.awayTeamId) continue;

      const update: Record<string, string> = {};

      for (const side of ['home', 'away'] as const) {
        const currentTeamId = side === 'home' ? match.homeTeamId : match.awayTeamId;
        if (currentTeamId) continue;

        const sourceMatchId = side === 'home' ? match.homeSourceMatchId : match.awaySourceMatchId;
        const sourceResult = side === 'home' ? match.homeSourceResult : match.awaySourceResult;

        if (!sourceMatchId || !sourceResult) {
          result.errors.push(`${match.bracketId}: falta sourceMatchId o sourceResult para ${side}`);
          continue;
        }

        const sourceMatch = matchById.get(sourceMatchId);
        if (!sourceMatch) {
          result.errors.push(`${match.bracketId}: partido fuente ${sourceMatchId} no encontrado`);
          continue;
        }
        if (sourceMatch.status !== 'finished') {
          result.pending.push(match.bracketId);
          continue;
        }

        const resolved = resolveTeam(sourceMatch, sourceResult);
        if (resolved) update[`${side}TeamId`] = resolved;
      }

      if (Object.keys(update).length === 0) continue;

      batch.update(refById.get(match.id)!, update);
      writes++;
      result.resolved++;
    }
  }

  if (writes > 0) await batch.commit();

  result.success = result.errors.length === 0;
  return result;
});
