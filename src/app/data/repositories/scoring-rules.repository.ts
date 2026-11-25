import { Injectable } from '@angular/core';
import { collection, doc, getDoc, getDocs, orderBy, query, updateDoc } from 'firebase/firestore';
import { db } from '../firebase.client';
import { mapFirestoreError, type RepoResult } from '../firestore-helpers';

// scoringRules es global (migración 006 en Supabase) — el doc ID ES el rule_key,
// así que no hace falta un campo `id` separado ni `tournament_id`. Ver
// docs/firebase/01-firestore-schema.md.
export interface ScoringRule {
  id: string; // == rule_key, doc ID
  rule_key: string;
  points_value: number;
  description: string | null;
}

function toRow(id: string, d: Record<string, unknown>): ScoringRule {
  return {
    id,
    rule_key: id,
    points_value: d['pointsValue'] as number,
    description: (d['description'] as string | null) ?? null,
  };
}

@Injectable({ providedIn: 'root' })
export class ScoringRulesRepository {
  async findAll(): Promise<RepoResult<ScoringRule[]>> {
    try {
      const q = query(collection(db, 'scoringRules'), orderBy('pointsValue', 'desc'));
      const snap = await getDocs(q);
      return { data: snap.docs.map((d) => toRow(d.id, d.data())), error: null };
    } catch (e) {
      return { data: null, error: mapFirestoreError(e) };
    }
  }

  /** `id` es el rule_key (doc ID) — ver findAll(). */
  async update(
    id: string,
    pointsValue: number,
    description?: string,
  ): Promise<RepoResult<ScoringRule>> {
    try {
      const ref = doc(db, 'scoringRules', id);
      await updateDoc(ref, {
        pointsValue,
        ...(description !== undefined && { description }),
      });
      const snap = await getDoc(ref);
      return { data: toRow(id, snap.data()!), error: null };
    } catch (e) {
      return { data: null, error: mapFirestoreError(e) };
    }
  }
}
