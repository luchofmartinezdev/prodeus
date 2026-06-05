import { computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import type { Tournament } from '../data/database.types';
import {
  TournamentRepository,
  type TournamentDto,
} from '../data/repositories/tournament.repository';
import { ToastService } from '../core/services/toast.service';

// ─── State ───────────────────────────────────────────────────

interface TournamentState {
  tournaments: Tournament[];
  selected: Tournament | null;
  isLoading: boolean;
  error: string | null;
}

const initialState: TournamentState = {
  tournaments: [],
  selected: null,
  isLoading: false,
  error: null,
};

// ─── Store ───────────────────────────────────────────────────

export const TournamentStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),

  withComputed(({ tournaments }) => ({
    activeTournaments: computed(() => tournaments().filter((t) => t.status === 'active')),
    draftTournaments: computed(() => tournaments().filter((t) => t.status === 'draft')),
    closedTournaments: computed(() => tournaments().filter((t) => t.status === 'closed')),
  })),

  withMethods((store) => {
    const repo = inject(TournamentRepository);
    const router = inject(Router);
    const toast = inject(ToastService);

    return {
      async loadAll(): Promise<void> {
        if (store.tournaments().length > 0) {
          Promise.resolve(repo.findAll())
            .then(({ data }) => {
              if (data) patchState(store, { tournaments: data });
            })
            .catch((err: unknown) => {
              console.warn('[TournamentStore] background refresh failed', err);
            });
          return;
        }
        patchState(store, { isLoading: true, error: null });
        try {
          const { data, error } = await repo.findAll();
          if (error) {
            toast.error('No se pudieron cargar los torneos');
          } else {
            patchState(store, { tournaments: data ?? [] });
          }
        } catch {
          toast.error('No se pudieron cargar los torneos');
        } finally {
          patchState(store, { isLoading: false });
        }
      },

      async loadOne(id: string): Promise<void> {
        patchState(store, { isLoading: true, error: null, selected: null });
        const { data, error } = await repo.findOne(id);
        if (error) {
          patchState(store, { isLoading: false });
          toast.error('Torneo no encontrado');
          return;
        }
        patchState(store, { selected: data, isLoading: false });
      },

      async create(dto: TournamentDto): Promise<string | null> {
        patchState(store, { isLoading: true, error: null });
        const { data, error } = await repo.create(dto);
        if (error) {
          patchState(store, { isLoading: false });
          toast.error('No se pudo crear el torneo');
          return null;
        }
        await repo.createDefaultRules(data.id);
        patchState(store, { tournaments: [data, ...store.tournaments()], isLoading: false });
        toast.success('Torneo creado exitosamente');
        return data.id;
      },

      async update(id: string, dto: Partial<TournamentDto>): Promise<boolean> {
        patchState(store, { isLoading: true, error: null });
        const { data, error } = await repo.update(id, dto);
        if (error) {
          patchState(store, { isLoading: false });
          toast.error('No se pudo actualizar el torneo');
          return false;
        }
        patchState(store, {
          tournaments: store.tournaments().map((t) => (t.id === id ? data : t)),
          selected: store.selected()?.id === id ? data : store.selected(),
          isLoading: false,
        });
        toast.success('Torneo actualizado');
        return true;
      },

      async changeStatus(id: string, status: Tournament['status']): Promise<void> {
        const { data, error } = await repo.changeStatus(id, status);
        if (error) {
          toast.error('No se pudo cambiar el estado');
          return;
        }
        patchState(store, {
          tournaments: store.tournaments().map((t) => (t.id === id ? data : t)),
          selected: store.selected()?.id === id ? data : store.selected(),
        });
        const label = { draft: 'Borrador', active: 'Activo', closed: 'Cerrado' }[status];
        toast.success(`Estado cambiado a ${label}`);
      },

      async remove(id: string): Promise<void> {
        const { error } = await repo.remove(id);
        if (error) {
          toast.error('No se pudo eliminar el torneo');
          return;
        }
        patchState(store, { tournaments: store.tournaments().filter((t) => t.id !== id) });
        router.navigate(['/admin/tournaments']);
      },

      clearError(): void {
        patchState(store, { error: null });
      },
    };
  }),
);
