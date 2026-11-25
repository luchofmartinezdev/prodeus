import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
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
  readonly isLoadingTournaments = signal(true);

  // ─── Combobox de torneo ───────────────────────────────────────
  readonly tournamentSearch = signal('');
  readonly isTournamentDropdownOpen = signal(false);

  readonly filteredTournaments = computed(() => {
    const term = this.tournamentSearch().trim().toLowerCase();
    const all = this.tournamentStore.activeTournaments();
    if (!term) return all;
    return all.filter((t) => t.name.toLowerCase().includes(term));
  });

  readonly tournamentId = signal('');

  readonly selectedTournamentName = computed(() => {
    const selected = this.tournamentStore
      .activeTournaments()
      .find((t) => t.id === this.tournamentId());
    return selected?.name ?? '';
  });

  name = '';
  visibility: 'public' | 'private' = 'public';

  ngOnInit(): void {
    this.tournamentStore.loadActive().finally(() => this.isLoadingTournaments.set(false));
  }

  openTournamentDropdown(): void {
    this.tournamentSearch.set('');
    this.isTournamentDropdownOpen.set(true);
  }

  closeTournamentDropdown(): void {
    // Delay para que el click en una opción se registre antes de cerrar por blur
    setTimeout(() => this.isTournamentDropdownOpen.set(false), 150);
  }

  selectTournament(id: string): void {
    this.tournamentId.set(id);
    this.isTournamentDropdownOpen.set(false);
    this.tournamentSearch.set('');
  }

  async onSubmit(): Promise<void> {
    const errors: Record<string, string> = {};
    if (!this.name.trim()) errors['name'] = 'El nombre es requerido';
    if (!this.tournamentId()) errors['tournament'] = 'Seleccioná un torneo';
    if (Object.keys(errors).length) {
      this.fieldErrors.set(errors);
      return;
    }

    this.fieldErrors.set({});
    await this.store.create({
      name: this.name.trim(),
      tournament_id: this.tournamentId(),
      visibility: this.visibility,
    });
  }
}
