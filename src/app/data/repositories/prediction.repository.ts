import { Injectable } from '@angular/core';
import { collection, doc, getDoc, getDocs, query, setDoc, where } from 'firebase/firestore';
import { serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase.client';
import { mapFirestoreError, tsToIso, type RepoResult } from '../firestore-helpers';
import type { Prediction } from '../database.types';

// ─── Types ────────────────────────────────────────────────────

export interface PredictionDto {
  group_id: string;
  user_id: string;
  match_id: string;
  predicted_home: number;
  predicted_away: number;
}

function toRow(id: string, d: Record<string, unknown>): Prediction {
  return {
    id,
    group_id: d['groupId'] as string,
    user_id: d['userId'] as string,
    match_id: d['matchId'] as string,
    predicted_home: d['predictedHome'] as number,
    predicted_away: d['predictedAway'] as number,
    predicted_qualifier_team_id: (d['predictedQualifierTeamId'] as string | null) ?? null,
    points_earned: (d['pointsEarned'] as number | null) ?? null,
    submitted_at: tsToIso(d['submittedAt']),
    last_edited_at: d['lastEditedAt'] ? tsToIso(d['lastEditedAt']) : null,
  };
}

// ─── Repository ───────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class PredictionRepository {
  async findByGroup(groupId: string, userId: string): Promise<RepoResult<Prediction[]>> {
    try {
      const q = query(
        collection(db, 'predictions'),
        where('groupId', '==', groupId),
        where('userId', '==', userId),
      );
      const snap = await getDocs(q);
      return { data: snap.docs.map((d) => toRow(d.id, d.data())), error: null };
    } catch (e) {
      return { data: null, error: mapFirestoreError(e) };
    }
  }

  /** Doc ID compuesto `${userId}_${matchId}_${groupId}` — reemplaza el upsert onConflict. */
  async upsert(dto: PredictionDto): Promise<RepoResult<Prediction>> {
    const id = `${dto.user_id}_${dto.match_id}_${dto.group_id}`;
    try {
      const ref = doc(db, 'predictions', id);
      const existing = await getDoc(ref);
      await setDoc(
        ref,
        {
          groupId: dto.group_id,
          userId: dto.user_id,
          matchId: dto.match_id,
          predictedHome: dto.predicted_home,
          predictedAway: dto.predicted_away,
          ...(existing.exists()
            ? { lastEditedAt: serverTimestamp() }
            : { submittedAt: serverTimestamp() }),
        },
        { merge: true },
      );
      const snap = await getDoc(ref);
      return { data: toRow(id, snap.data()!), error: null };
    } catch (e) {
      return { data: null, error: mapFirestoreError(e) };
    }
  }
}
