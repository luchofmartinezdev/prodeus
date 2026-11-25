import { computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { GroupService } from '../core/services/group.service';
import { ToastService } from '../core/services/toast.service';
import type {
  GroupDto,
  GroupWithTournament,
  MemberWithProfile,
} from '../data/repositories/group.repository';
import { AuthStore } from './auth.store';

// ─── State ───────────────────────────────────────────────────

interface GroupState {
  groups: GroupWithTournament[];
  publicGroups: GroupWithTournament[];
  selected: GroupWithTournament | null;
  members: MemberWithProfile[];
  isLoading: boolean;
  isLoadingPublic: boolean;
  error: string | null;
}

const initialState: GroupState = {
  groups: [],
  publicGroups: [],
  selected: null,
  members: [],
  isLoading: false,
  isLoadingPublic: false,
  error: null,
};

// ─── Store ───────────────────────────────────────────────────

export const GroupStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),

  withComputed(({ members }) => ({
    activeMembers: computed(() => members().filter((m) => m.status === 'active')),
  })),

  withMethods((store) => {
    const groupService = inject(GroupService);
    const authStore = inject(AuthStore);
    const router = inject(Router);
    const toast = inject(ToastService);

    // Deduplicates concurrent full-load calls (e.g. dashboard + group-list both mounting)
    let loadInFlight: Promise<void> | null = null;

    function currentUserId(): string {
      const id = authStore.user()?.id;
      if (!id) throw new Error('Usuario no autenticado');
      return id;
    }

    function assertIsLeader(): void {
      const userId = authStore.user()?.id;
      const selected = store.selected();
      if (!userId || !selected || selected.leader_id !== userId) {
        throw new Error('Solo el líder del grupo puede realizar esta acción');
      }
    }

    return {
      async loadMyGroups(): Promise<void> {
        const userId = authStore.user()?.id;
        if (!userId) return;
        if (store.groups().length > 0) {
          groupService
            .getMyGroups(userId)
            .then((groups) => patchState(store, { groups }))
            .catch((err: unknown) => {
              console.warn('[GroupStore] background refresh failed', err);
            });
          return;
        }
        // If a full-load is already in flight, share the same promise
        if (loadInFlight) return loadInFlight;

        patchState(store, { isLoading: true, error: null });
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10_000);
        loadInFlight = (async () => {
          try {
            const groups = await groupService.getMyGroups(userId, controller.signal);
            clearTimeout(timeoutId);
            patchState(store, { groups, isLoading: false });
          } catch (e: unknown) {
            clearTimeout(timeoutId);
            let msg = 'Error al cargar grupos';
            if (e instanceof DOMException && e.name === 'AbortError') {
              msg = 'La carga tardó demasiado. Revisá tu conexión e intentá de nuevo.';
            } else if (e instanceof Error) {
              msg = e.message;
            }
            patchState(store, { isLoading: false, error: msg });
            toast.error(msg);
          }
        })();
        loadInFlight.finally(() => {
          loadInFlight = null;
        });
        return loadInFlight;
      },

      async loadOne(id: string): Promise<void> {
        // Keep showing previous data while loading to avoid blank screen
        const isSameGroup = store.selected()?.id === id;
        patchState(store, {
          isLoading: !isSameGroup,
          error: null,
          selected: isSameGroup ? store.selected() : null,
        });
        try {
          const selected = await groupService.getOne(id);
          patchState(store, { selected, isLoading: false });
        } catch (e: unknown) {
          patchState(store, { isLoading: false });
          toast.error(e instanceof Error ? e.message : 'Error al cargar el grupo');
        }
      },

      async loadMembers(groupId: string): Promise<void> {
        try {
          const members = await groupService.getMembers(groupId);
          patchState(store, { members });
        } catch (e: unknown) {
          toast.error(e instanceof Error ? e.message : 'Error al cargar miembros');
        }
      },

      async create(dto: GroupDto): Promise<void> {
        patchState(store, { isLoading: true, error: null });
        try {
          const group = await groupService.create(dto, currentUserId());
          patchState(store, { groups: [group, ...store.groups()], isLoading: false });
          toast.success('Grupo creado exitosamente');
          router.navigate(['/home/groups', group.id]);
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : 'Error al crear grupo';
          patchState(store, { isLoading: false, error: msg });
          toast.error(msg);
        }
      },

      async update(id: string, dto: Partial<Pick<GroupDto, 'name' | 'visibility'>>): Promise<void> {
        patchState(store, { isLoading: true, error: null });
        try {
          assertIsLeader();
          const updated = await groupService.update(id, dto);
          patchState(store, {
            selected: updated,
            groups: store.groups().map((g) => (g.id === id ? updated : g)),
            isLoading: false,
          });
          toast.success('Grupo actualizado');
        } catch (e: unknown) {
          patchState(store, { isLoading: false });
          toast.error(e instanceof Error ? e.message : 'Error al actualizar grupo');
        }
      },

      async remove(id: string): Promise<void> {
        patchState(store, { isLoading: true, error: null });
        try {
          assertIsLeader();
          await groupService.remove(id);
          patchState(store, {
            groups: store.groups().filter((g) => g.id !== id),
            selected: null,
            isLoading: false,
          });
          router.navigate(['/home/groups']);
        } catch (e: unknown) {
          patchState(store, { isLoading: false });
          toast.error(e instanceof Error ? e.message : 'Error al eliminar grupo');
        }
      },

      async joinByCode(code: string): Promise<boolean> {
        patchState(store, { isLoading: true, error: null });
        try {
          const group = await groupService.joinByCode(code, currentUserId());
          patchState(store, { groups: [group, ...store.groups()], isLoading: false });
          toast.success('Te uniste al grupo exitosamente');
          return true;
        } catch (e: unknown) {
          patchState(store, { isLoading: false });
          toast.error(e instanceof Error ? e.message : 'Error al unirse al grupo');
          return false;
        }
      },

      async loadPublicGroups(): Promise<void> {
        patchState(store, { isLoadingPublic: true });
        try {
          const publicGroups = await groupService.getPublicGroups();
          patchState(store, { publicGroups, isLoadingPublic: false });
        } catch {
          patchState(store, { isLoadingPublic: false });
        }
      },

      async joinPublicGroup(groupId: string): Promise<boolean> {
        patchState(store, { isLoading: true, error: null });
        try {
          const group = await groupService.joinById(groupId, currentUserId());
          patchState(store, {
            groups: [group, ...store.groups()],
            publicGroups: store.publicGroups().filter((g) => g.id !== groupId),
            isLoading: false,
          });
          toast.success('Te uniste al grupo exitosamente');
          return true;
        } catch (e: unknown) {
          patchState(store, { isLoading: false });
          toast.error(e instanceof Error ? e.message : 'Error al unirse al grupo');
          return false;
        }
      },

      // La confirmación la maneja el componente que llama (modal), no el store.
      async removeMember(memberId: string, groupId: string): Promise<void> {
        try {
          assertIsLeader();
          await groupService.removeMember(memberId, groupId);
          const members = await groupService.getMembers(groupId);
          patchState(store, { members });
          toast.info('Miembro removido del grupo');
        } catch (e: unknown) {
          toast.error(e instanceof Error ? e.message : 'Error al remover miembro');
        }
      },

      async leave(groupId: string, userId: string): Promise<void> {
        try {
          await groupService.leave(groupId, userId);
          toast.success('Has salido del grupo');
          router.navigate(['/home/groups']);
        } catch (e: unknown) {
          toast.error(e instanceof Error ? e.message : 'Error al salir del grupo');
        }
      },

      clearError(): void {
        patchState(store, { error: null });
      },
    };
  }),
);
