import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { GroupStore } from '../../../../state/group.store';
import { TournamentStore } from '../../../../state/tournament.store';

@Component({
  selector: 'app-group-form',
  imports: [RouterLink, FormsModule],
  templateUrl: './group-form.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GroupFormComponent implements OnInit {
  protected readonly store = inject(GroupStore);
  protected readonly tournamentStore = inject(TournamentStore);

  readonly fieldErrors = signal<Record<string, string>>({});

  name = '';
  tournamentId = '';
  joinMode: 'open' | 'closed' = 'open';

  ngOnInit(): void {
    this.tournamentStore.loadAll();
  }

  async onSubmit(): Promise<void> {
    const errors: Record<string, string> = {};
    if (!this.name.trim()) errors['name'] = 'El nombre es requerido';
    if (!this.tournamentId) errors['tournament'] = 'Seleccioná un torneo';
    if (Object.keys(errors).length) {
      this.fieldErrors.set(errors);
      return;
    }

    this.fieldErrors.set({});
    await this.store.create({
      name: this.name.trim(),
      tournament_id: this.tournamentId,
      join_mode: this.joinMode,
    });
  }
}
