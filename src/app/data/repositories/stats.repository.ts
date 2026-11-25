import { Injectable } from '@angular/core';
import {
  collection,
  collectionGroup,
  getCountFromServer,
  getDocs,
  query,
  where,
} from 'firebase/firestore';
import { db } from '../firebase.client';
import { mapFirestoreError, type RepoError } from '../firestore-helpers';

export interface CountResult {
  count: number;
  error: RepoError | null;
}

async function count(q: Parameters<typeof getCountFromServer>[0]): Promise<CountResult> {
  try {
    const snap = await getCountFromServer(q);
    return { count: snap.data().count, error: null };
  } catch (e) {
    return { count: 0, error: mapFirestoreError(e) };
  }
}

@Injectable({ providedIn: 'root' })
export class StatsRepository {
  async findActiveTournamentIds(): Promise<{ data: { id: string }[]; error: RepoError | null }> {
    try {
      const snap = await getDocs(
        query(collection(db, 'tournaments'), where('status', '==', 'active')),
      );
      return { data: snap.docs.map((d) => ({ id: d.id })), error: null };
    } catch (e) {
      return { data: [], error: mapFirestoreError(e) };
    }
  }

  countGroupsByTournamentIds(ids: string[]): Promise<CountResult> {
    if (ids.length === 0) return Promise.resolve({ count: 0, error: null });
    // Firestore 'in' admite hasta 30 valores — suficiente para la cantidad de
    // torneos activos esperada.
    return count(query(collection(db, 'groups'), where('tournamentId', 'in', ids.slice(0, 30))));
  }

  countTotalGroups(): Promise<CountResult> {
    return count(collection(db, 'groups'));
  }

  countPredictions(): Promise<CountResult> {
    return count(collection(db, 'predictions'));
  }

  /** Collection group query: cuenta miembros activos across todos los grupos. */
  countActiveMembers(): Promise<CountResult> {
    return count(query(collectionGroup(db, 'members'), where('status', '==', 'active')));
  }

  countRegisteredUsers(): Promise<CountResult> {
    return count(query(collection(db, 'users'), where('role', '!=', 'superadmin')));
  }

  countTournamentsByStatus(status: 'draft' | 'active' | 'closed'): Promise<CountResult> {
    return count(query(collection(db, 'tournaments'), where('status', '==', status)));
  }
}
