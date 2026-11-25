import { Injectable } from '@angular/core';
import { collection, doc, getDoc, getDocs, orderBy, query, where } from 'firebase/firestore';
import { db } from '../firebase.client';
import { tsToIso } from '../firestore-helpers';

export interface RankingRow {
  userId: string;
  username: string;
  avatarUrl: string | null;
  totalPoints: number;
  position: number;
}

export interface HistorialRow {
  predictionId: string;
  matchDate: string;
  round: string | null;
  homeTeam: string;
  awayTeam: string;
  homeTeamLogo: string | null;
  awayTeamLogo: string | null;
  actualHome: number | null;
  actualAway: number | null;
  predictedHome: number;
  predictedAway: number;
  pointsEarned: number | null;
  matchStatus: 'scheduled' | 'in_progress' | 'finished';
}

@Injectable({ providedIn: 'root' })
export class RankingRepository {
  /** Scores for all members of a group, sorted by totalPoints DESC */
  async getGroupRanking(groupId: string): Promise<RankingRow[]> {
    let snap;
    try {
      const q = query(
        collection(db, 'scores'),
        where('groupId', '==', groupId),
        orderBy('totalPoints', 'desc'),
      );
      snap = await getDocs(q);
    } catch {
      throw new Error('No se pudo cargar el ranking');
    }

    const rows = await Promise.all(
      snap.docs.map(async (d, i) => {
        const s = d.data();
        const profileSnap = await getDoc(doc(db, 'users', s['userId']));
        const p = profileSnap.data();
        return {
          userId: s['userId'],
          username: (p?.['username'] as string) ?? '—',
          avatarUrl: (p?.['avatarUrl'] as string | null) ?? null,
          totalPoints: s['totalPoints'],
          position: i + 1,
        };
      }),
    );
    return rows;
  }

  /** Prediction history for one user in one group, newest match first */
  async getUserHistory(userId: string, groupId: string): Promise<HistorialRow[]> {
    let snap;
    try {
      const q = query(
        collection(db, 'predictions'),
        where('userId', '==', userId),
        where('groupId', '==', groupId),
      );
      snap = await getDocs(q);
    } catch {
      throw new Error('No se pudo cargar el historial');
    }

    interface TeamSnapshot {
      name: string;
      shortName: string | null;
      logoUrl: string | null;
    }

    const rows = await Promise.all(
      snap.docs.map(async (predDoc) => {
        const row = predDoc.data();
        const matchSnap = await getDoc(doc(db, 'matches', row['matchId']));
        const m = matchSnap.data();
        const homeTeam = (m?.['homeTeam'] as TeamSnapshot | null) ?? null;
        const awayTeam = (m?.['awayTeam'] as TeamSnapshot | null) ?? null;
        return {
          predictionId: predDoc.id,
          matchDate: m ? tsToIso(m['matchDate']) : '',
          round: (m?.['round'] as string | null) ?? null,
          homeTeam: homeTeam?.name ?? '?',
          awayTeam: awayTeam?.name ?? '?',
          homeTeamLogo: homeTeam?.logoUrl ?? null,
          awayTeamLogo: awayTeam?.logoUrl ?? null,
          actualHome: (m?.['homeScore'] as number | null) ?? null,
          actualAway: (m?.['awayScore'] as number | null) ?? null,
          predictedHome: row['predictedHome'],
          predictedAway: row['predictedAway'],
          pointsEarned: (row['pointsEarned'] as number | null) ?? null,
          matchStatus: (m?.['status'] as HistorialRow['matchStatus']) ?? 'scheduled',
          submittedAt: m ? tsToIso(row['submittedAt']) : '',
        };
      }),
    );

    return rows
      .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
      .map(({ submittedAt: _submittedAt, ...rest }) => rest);
  }
}
