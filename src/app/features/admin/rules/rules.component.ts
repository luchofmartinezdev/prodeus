import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { ScoringRule } from '../../../data/database.types';
import { ScoringRulesService } from '../../../core/services/scoring-rules.service';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-admin-rules',
  imports: [FormsModule],
  templateUrl: './rules.component.html',
})
export class AdminRulesComponent implements OnInit {
  private readonly rulesService = inject(ScoringRulesService);
  private readonly toast = inject(ToastService);

  readonly rules = signal<ScoringRule[]>([]);
  readonly isLoading = signal(true);
  readonly isEditing = signal(false);
  readonly isSaving = signal(false);

  ruleValues: Record<string, number> = {};

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  private async load(): Promise<void> {
    this.isLoading.set(true);
    try {
      const rules = await this.rulesService.getAll();
      this.rules.set(rules);
      this.ruleValues = Object.fromEntries(rules.map((r) => [r.id, r.points_value]));
    } catch (e: unknown) {
      this.toast.error(e instanceof Error ? e.message : 'Error al cargar reglas');
    } finally {
      this.isLoading.set(false);
    }
  }

  async save(): Promise<void> {
    this.isSaving.set(true);
    try {
      await Promise.all(
        this.rules().map((r) => this.rulesService.update(r.id, this.ruleValues[r.id])),
      );
      await this.load();
      this.isEditing.set(false);
      this.toast.success('Reglas guardadas');
    } catch (e: unknown) {
      this.toast.error(e instanceof Error ? e.message : 'Error al guardar reglas');
    } finally {
      this.isSaving.set(false);
    }
  }

  cancel(): void {
    this.ruleValues = Object.fromEntries(this.rules().map((r) => [r.id, r.points_value]));
    this.isEditing.set(false);
  }

  ruleLabel(key: string): string {
    return (
      (
        {
          exact_score: 'Resultado exacto',
          correct_winner: 'Ganador correcto',
          correct_goals_only: 'Solo goles (un equipo)',
          no_match: 'Sin acierto',
        } as Record<string, string>
      )[key] ?? key
    );
  }

  ruleDescription(key: string): string {
    return (
      (
        {
          exact_score: 'El usuario predijo exactamente el marcador final',
          correct_winner: 'Acertó quién gana o empate, sin el marcador exacto',
          correct_goals_only: 'Acertó los goles de al menos un equipo, sin acertar ganador',
          no_match: 'No se cumple ninguna condición anterior',
        } as Record<string, string>
      )[key] ?? ''
    );
  }
}
