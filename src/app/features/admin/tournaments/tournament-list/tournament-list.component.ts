import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ConfirmModalComponent } from '@shared/components/confirm-modal/confirm-modal.component';
import type { Tournament } from '../../../../data/database.types';
import { TournamentStore } from '../../../../state/tournament.store';

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

  ngOnInit(): void {
    this.store.loadAll().finally(() => this.isLoadingTournaments.set(false));
  }

  statusLabel(status: Tournament['status']): string {
    return { draft: 'Borrador', active: 'Activo', closed: 'Cerrado' }[status];
  }

  statusClass(status: Tournament['status']): string {
    return {
      draft: 'bg-gray-700 text-gray-300',
      active: 'bg-green-900 text-green-300',
      closed: 'bg-red-900 text-red-300',
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
      weekday: 'long',
      day: '2-digit',
      month: '2-digit',
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
