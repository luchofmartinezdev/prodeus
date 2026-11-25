import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { ConfirmModalComponent } from '@shared/components/confirm-modal/confirm-modal.component';
import type { Tournament } from '../../../../data/database.types';
import { TournamentStore } from '../../../../state/tournament.store';

export type StatusFilter = 'all' | Tournament['status'];

@Component({
  selector: 'app-tournament-list',
  imports: [RouterLink, ConfirmModalComponent],
  templateUrl: './tournament-list.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TournamentListComponent implements OnInit {
  protected readonly store = inject(TournamentStore);
  readonly isLoadingTournaments = signal(true);
  readonly tournamentToDelete = signal<{ id: string; name: string } | null>(null);
  readonly statusFilter = signal<StatusFilter>('all');

  readonly filters: { key: StatusFilter; label: string }[] = [
    { key: 'all', label: 'Todos' },
    { key: 'active', label: 'Activos' },
    { key: 'draft', label: 'Borrador' },
    { key: 'closed', label: 'Cerrados' },
  ];

  readonly counts = computed(() => {
    const list = this.store.tournaments();
    return {
      all: list.length,
      active: list.filter((t) => t.status === 'active').length,
      draft: list.filter((t) => t.status === 'draft').length,
      closed: list.filter((t) => t.status === 'closed').length,
    } satisfies Record<StatusFilter, number>;
  });

  readonly filtered = computed(() => {
    const f = this.statusFilter();
    const list = this.store.tournaments();
    return f === 'all' ? list : list.filter((t) => t.status === f);
  });

  ngOnInit(): void {
    this.store.loadAll().finally(() => this.isLoadingTournaments.set(false));
  }

  statusLabel(status: Tournament['status']): string {
    return { draft: 'Borrador', active: 'Activo', closed: 'Cerrado' }[status];
  }

  statusClass(status: Tournament['status']): string {
    return {
      draft: 'bg-gray-800 text-gray-300 border-gray-700',
      active: 'bg-green-900 text-green-300 border-green-800',
      closed: 'bg-red-900 text-red-300 border-red-800',
    }[status];
  }

  async onChangeStatus(id: string, current: Tournament['status']): Promise<void> {
    const next: Tournament['status'] =
      current === 'draft' ? 'active' : current === 'active' ? 'closed' : 'draft';
    await this.store.changeStatus(id, next);
  }

  formatDate(iso: string): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('es-AR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }

  openDeleteModal(id: string, name: string): void {
    this.tournamentToDelete.set({ id, name });
  }

  closeDeleteModal(): void {
    this.tournamentToDelete.set(null);
  }

  async confirmDelete(): Promise<void> {
    const target = this.tournamentToDelete();
    if (!target) return;
    this.closeDeleteModal();
    await this.store.remove(target.id);
  }
}
