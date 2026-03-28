import { SlicePipe } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { Tournament } from '../../../../data/database.types';
import { TournamentStore } from '../../../../state/tournament.store';

@Component({
  selector: 'app-tournament-list',
  imports: [RouterLink, SlicePipe],
  templateUrl: './tournament-list.component.html',
})
export class TournamentListComponent implements OnInit {
  protected readonly store = inject(TournamentStore);

  ngOnInit(): void {
    this.store.loadAll();
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

  async onDelete(id: string, name: string): Promise<void> {
    if (!confirm(`¿Eliminar el torneo "${name}"? Esta acción no se puede deshacer.`)) return;
    await this.store.remove(id);
  }
}
