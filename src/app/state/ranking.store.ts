import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { supabase } from '../data/supabase.client';
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
    let realtimeChannel: ReturnType<typeof supabase.channel> | null = null;

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

      subscribeToGroup(groupId: string): void {
        // Clean up previous subscription if any
        if (realtimeChannel) {
          supabase.removeChannel(realtimeChannel);
        }

        realtimeChannel = supabase
          .channel(`scores:group:${groupId}`)
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'scores', filter: `group_id=eq.${groupId}` },
            async () => {
              const ranking = await repo.getGroupRanking(groupId);
              patchState(store, { ranking });
            },
          )
          .subscribe();
      },

      unsubscribe(): void {
        if (realtimeChannel) {
          supabase.removeChannel(realtimeChannel);
          realtimeChannel = null;
        }
      },

      clearError(): void {
        patchState(store, { error: null });
      },
    };
  }),
);
