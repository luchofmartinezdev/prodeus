import { ChangeDetectionStrategy, Component, inject, Input, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import type { Tournament } from '../../../../data/database.types';
import { TournamentStore } from '../../../../state/tournament.store';

@Component({
  selector: 'app-tournament-form',
  imports: [FormsModule, RouterLink],
  templateUrl: './tournament-form.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TournamentFormComponent implements OnInit {
  @Input() id?: string;

  protected readonly store = inject(TournamentStore);
  private readonly router = inject(Router);

  readonly isEditMode = signal(false);
  readonly fieldErrors = signal<Record<string, string>>({});

  // Form fields
  name = '';
  description = '';
  logo_url = '';
  start_date = '';
  end_date = '';
  status: Tournament['status'] = 'draft';

  ngOnInit(): void {
    if (this.id) {
      this.isEditMode.set(true);
      this.loadTournament();
    }
  }

  private async loadTournament(): Promise<void> {
    await this.store.loadOne(this.id!);
    const t = this.store.selected();
    if (t) {
      this.name = t.name;
      this.description = t.description ?? '';
      this.logo_url = t.logo_url ?? '';
      this.start_date = t.start_date;
      this.end_date = t.end_date;
      this.status = t.status;
    }
  }

  async onSubmit(): Promise<void> {
    this.fieldErrors.set({});
    const errors: Record<string, string> = {};

    if (!this.name.trim()) errors['name'] = 'El nombre es requerido';
    if (!this.start_date) errors['start_date'] = 'La fecha de inicio es requerida';
    if (!this.end_date) errors['end_date'] = 'La fecha de cierre es requerida';
    if (this.start_date && this.end_date && this.end_date < this.start_date)
      errors['end_date'] = 'La fecha de cierre debe ser posterior al inicio';

    if (Object.keys(errors).length) {
      this.fieldErrors.set(errors);
      return;
    }

    const dto = {
      name: this.name.trim(),
      description: this.description.trim() || undefined,
      logo_url: this.logo_url.trim() || undefined,
      start_date: this.start_date,
      end_date: this.end_date,
      status: this.status,
    };

    if (this.isEditMode()) {
      const ok = await this.store.update(this.id!, dto);
      if (ok) this.router.navigate(['/admin/tournaments', this.id]);
    } else {
      const newId = await this.store.create(dto);
      if (newId) this.router.navigate(['/admin/tournaments', newId]);
    }
  }
}
