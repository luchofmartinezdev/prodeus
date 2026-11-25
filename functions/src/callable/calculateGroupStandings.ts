import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { db } from '../admin';
import { Timestamp } from 'firebase-admin/firestore';

interface CalculateStandingsRequest {
  tournamentId: string;
}

interface TeamStats {
  teamId: string;
  groupName: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
}

/** Mismos criterios de desempate que la Edge Function original: puntos, diferencia de gol, goles a favor. */
function compareStats(a: TeamStats, b: TeamStats): number {
  if (b.points !== a.points) return b.points - a.points;
  const gdA = a.goalsFor - a.goalsAgainst;
  const gdB = b.goalsFor - b.goalsAgainst;
  if (gdB !== gdA) return gdB - gdA;
  return b.goalsFor - a.goalsFor;
}

function extractGroupName(round: string | null | undefined): string | null {
  if (!round) return null;
  const m = round.match(/([A-L])$/i);
  return m ? m[1].toUpperCase() : round.trim().toUpperCase();
}

export const calculateGroupStandings = onCall<CalculateStandingsRequest>(async (request) => {
  const { tournamentId } = request.data;
  if (!tournamentId) throw new HttpsError('invalid-argument', 'tournamentId es requerido');

  const callerUid = request.auth?.uid;
  if (!callerUid) throw new HttpsError('unauthenticated', 'Debe estar autenticado');
  const caller = await db.collection('users').doc(callerUid).get();
  if (caller.data()?.['role'] !== 'superadmin') {
    throw new HttpsError('permission-denied', 'Solo superadmin puede recalcular standings');
  }

  return calculateGroupStandingsInternal(tournamentId);
});

export async function calculateGroupStandingsInternal(tournamentId: string) {
  // 1. Partidos de fase de grupos terminados (bracketId == null)
  const matchesSnap = await db
    .collection('matches')
    .where('tournamentId', '==', tournamentId)
    .where('status', '==', 'finished')
    .get();

  const groupMatches = matchesSnap.docs.filter((d) => d.data()['bracketId'] == null);

  const statsMap = new Map<string, TeamStats>();
  const getOrCreate = (teamId: string, groupName: string): TeamStats => {
    if (!statsMap.has(teamId)) {
      statsMap.set(teamId, {
        teamId,
        groupName,
        played: 0,
        won: 0,
        drawn: 0,
        lost: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        points: 0,
      });
    }
    return statsMap.get(teamId)!;
  };

  for (const doc of groupMatches) {
    const m = doc.data();
    if (
      m['homeTeamId'] == null ||
      m['awayTeamId'] == null ||
      m['homeScore'] == null ||
      m['awayScore'] == null
    ) {
      continue;
    }
    const groupName = extractGroupName(m['round']);
    if (!groupName) continue;

    const home = getOrCreate(m['homeTeamId'], groupName);
    const away = getOrCreate(m['awayTeamId'], groupName);

    home.played++;
    away.played++;
    home.goalsFor += m['homeScore'];
    home.goalsAgainst += m['awayScore'];
    away.goalsFor += m['awayScore'];
    away.goalsAgainst += m['homeScore'];

    if (m['homeScore'] > m['awayScore']) {
      home.won++;
      home.points += 3;
      away.lost++;
    } else if (m['homeScore'] < m['awayScore']) {
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

  const byGroup = new Map<string, TeamStats[]>();
  for (const stats of statsMap.values()) {
    if (!byGroup.has(stats.groupName)) byGroup.set(stats.groupName, []);
    byGroup.get(stats.groupName)!.push(stats);
  }

  const now = Timestamp.now();
  const batch = db.batch();
  const standings: Record<string, unknown>[] = [];

  for (const [, teams] of byGroup.entries()) {
    teams.sort(compareStats);
    teams.forEach((t, idx) => {
      const row = {
        tournamentId,
        groupName: t.groupName,
        teamId: t.teamId,
        position: idx + 1,
        played: t.played,
        won: t.won,
        drawn: t.drawn,
        lost: t.lost,
        goalsFor: t.goalsFor,
        goalsAgainst: t.goalsAgainst,
        goalDifference: t.goalsFor - t.goalsAgainst,
        points: t.points,
        calculatedAt: now,
      };
      standings.push(row);
      const ref = db.collection('groupStandings').doc(`${tournamentId}_${t.groupName}_${t.teamId}`);
      batch.set(ref, row);
    });
  }

  if (standings.length === 0) {
    return { success: true, standings: [] };
  }

  await batch.commit();
  return { success: true, standings };
}
