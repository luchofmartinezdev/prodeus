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
  selected: GroupWithTournament | null;
  members: MemberWithProfile[];
  isLoading: boolean;
  error: string | null;
}

const initialState: GroupState = {
  groups: [],
  selected: null,
  members: [],
  isLoading: false,
  error: null,
};

// ─── Store ───────────────────────────────────────────────────

export const GroupStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),

  withComputed(({ members }) => ({
    pendingMembers: computed(() => members().filter((m) => m.status === 'pending')),
    activeMembers: computed(() => members().filter((m) => m.status === 'active')),
  })),

  withMethods((store) => {
    const groupService = inject(GroupService);
    const authStore = inject(AuthStore);
    const router = inject(Router);
    const toast = inject(ToastService);

    function currentUserId(): string {
      const id = authStore.user()?.id;
      if (!id) throw new Error('Usuario no autenticado');
      return id;
    }

    return {
      async loadMyGroups(): Promise<void> {
        const userId = authStore.user()?.id;
        if (!userId) return;
        // Skip refetch if we already have groups loaded (avoid blank screen)
        if (store.groups().length > 0) {
          // Refresh in background without showing loading spinner
          groupService
            .getMyGroups(userId)
            .then((groups) => patchState(store, { groups }))
            .catch((_e: unknown) => {
              /* background refresh — ignore errors */
            });
          return;
        }
        patchState(store, { isLoading: true, error: null });
        try {
          const groups = await groupService.getMyGroups(userId);
          if (groups) {
            patchState(store, { groups, isLoading: false });
          } else {
            patchState(store, { isLoading: false });
            toast.error('Error al cargar grupos');
          }
        } catch (e: unknown) {
          patchState(store, { isLoading: false });
          toast.error(e instanceof Error ? e.message : 'Error al cargar grupos');
        }
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
          router.navigate(['/app/groups', group.id]);
        } catch (e: unknown) {
          patchState(store, { isLoading: false });
          toast.error(e instanceof Error ? e.message : 'Error al crear grupo');
        }
      },

      async update(id: string, dto: Partial<Pick<GroupDto, 'name' | 'join_mode'>>): Promise<void> {
        patchState(store, { isLoading: true, error: null });
        try {
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
          await groupService.remove(id);
          patchState(store, {
            groups: store.groups().filter((g) => g.id !== id),
            selected: null,
            isLoading: false,
          });
          router.navigate(['/app/groups']);
        } catch (e: unknown) {
          patchState(store, { isLoading: false });
          toast.error(e instanceof Error ? e.message : 'Error al eliminar grupo');
        }
      },

      async joinByCode(code: string): Promise<'pending' | 'active' | null> {
        patchState(store, { isLoading: true, error: null });
        try {
          const result = await groupService.joinByCode(code, currentUserId());
          if (result.status === 'active') {
            // Add the joined group directly — no extra query needed
            patchState(store, { groups: [result.group, ...store.groups()], isLoading: false });
            toast.success('Te uniste al grupo exitosamente');
          } else {
            patchState(store, { isLoading: false });
            toast.info('Solicitud enviada. El líder del grupo debe aprobarte');
          }
          return result.status;
        } catch (e: unknown) {
          console.error('Error while joining group:', e);
          patchState(store, { isLoading: false });
          toast.error(e instanceof Error ? e.message : 'Error al unirse al grupo');
          return null;
        }
      },

      async approveMember(memberId: string, groupId: string): Promise<void> {
        try {
          await groupService.approveMember(memberId);
          const members = await groupService.getMembers(groupId);
          patchState(store, { members });
          toast.success('Miembro aprobado');
        } catch (e: unknown) {
          toast.error(e instanceof Error ? e.message : 'Error al aprobar miembro');
        }
      },

      async rejectMember(memberId: string, groupId: string): Promise<void> {
        try {
          await groupService.rejectMember(memberId);
          const members = await groupService.getMembers(groupId);
          patchState(store, { members });
          toast.info('Solicitud rechazada');
        } catch (e: unknown) {
          toast.error(e instanceof Error ? e.message : 'Error al rechazar miembro');
        }
      },

      async removeMember(memberId: string, groupId: string): Promise<void> {
        if (!confirm('¿Remover este miembro del grupo?')) return;
        try {
          await groupService.removeMember(memberId);
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
          router.navigate(['/app/groups']);
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
