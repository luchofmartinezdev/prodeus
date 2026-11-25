import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../data/firebase.client';
import {
  RankingRepository,
  type HistorialRow,
  type RankingRow,
} from '../data/repositories/ranking.repository';

// ─── State ───────────────────────────────────────────────────

interface RankingState {
  ranking: RankingRow[];
  historial: HistorialRow[];
  isLoading: boolean;
  error: string | null;
}

const initialState: RankingState = {
  ranking: [],
  historial: [],
  isLoading: false,
  error: null,
};

// ─── Store ───────────────────────────────────────────────────

export const RankingStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),

  withMethods((store) => {
    const repo = inject(RankingRepository);
    let unsubscribeSnapshot: (() => void) | null = null;

    return {
      async loadRanking(groupId: string): Promise<void> {
        patchState(store, { isLoading: true, error: null });
        try {
          const ranking = await repo.getGroupRanking(groupId);
          patchState(store, { ranking, isLoading: false });
        } catch (e: unknown) {
          patchState(store, {
            isLoading: false,
            error: e instanceof Error ? e.message : 'Error al cargar el ranking',
          });
        }
      },

      async loadHistorial(userId: string, groupId: string): Promise<void> {
        try {
          const historial = await repo.getUserHistory(userId, groupId);
          patchState(store, { historial });
        } catch (e: unknown) {
          patchState(store, {
            error: e instanceof Error ? e.message : 'Error al cargar el historial',
          });
        }
      },

      /** Reemplaza el canal Realtime de Supabase (`postgres_changes` sobre `scores`) por onSnapshot. */
      subscribeToGroup(groupId: string): void {
        unsubscribeSnapshot?.();

        const q = query(collection(db, 'scores'), where('groupId', '==', groupId));
        unsubscribeSnapshot = onSnapshot(q, async () => {
          const ranking = await repo.getGroupRanking(groupId);
          patchState(store, { ranking });
        });
      },

      unsubscribe(): void {
        unsubscribeSnapshot?.();
        unsubscribeSnapshot = null;
      },

      clearError(): void {
        patchState(store, { error: null });
      },
    };
  }),
);
