import { Component, inject, Input, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { PredictionService } from '../../../core/services/prediction.service';
import { MatchService } from '../../../core/services/match.service';
import { GroupService } from '../../../core/services/group.service';
import { AuthStore } from '../../../state/auth.store';
import { ToastService } from '../../../core/services/toast.service';
import type { Prediction } from '../../../data/database.types';
import type { GroupWithTournament } from '../../../data/repositories/group.repository';
import type { MatchWithTeams } from '../../../data/repositories/match.repository';

export type MatchRow = MatchWithTeams & {
  prediction: Prediction | null;
  isOpen: boolean;
};

@Component({
  selector: 'app-predictions',
  imports: [RouterLink, FormsModule],
  templateUrl: './predictions.component.html',
})
export class PredictionsComponent implements OnInit {
  @Input() id!: string; // group id

  private readonly predictionService = inject(PredictionService);
  private readonly matchService = inject(MatchService);
  private readonly groupService = inject(GroupService);
  protected readonly authStore = inject(AuthStore);
  private readonly toast = inject(ToastService);

  readonly group = signal<GroupWithTournament | null>(null);
  readonly rows = signal<MatchRow[]>([]);
  readonly isLoading = signal(true);

  // form values: matchId → { home, away }
  readonly formValues: Record<string, { home: number; away: number }> = {};
  // saving state per matchId
  readonly saving = signal<Set<string>>(new Set());
  // saved feedback per matchId
  readonly saved = signal<Set<string>>(new Set());

  ngOnInit(): void {
    this.load();
  }

  private async load(): Promise<void> {
    this.isLoading.set(true);
    try {
      const userId = this.authStore.user()!.id;
      const g = await this.groupService.getOne(this.id);
      const [ms, ps] = await Promise.all([
        this.matchService.getByTournament(g.tournament_id),
        this.predictionService.getByGroup(this.id, userId),
      ]);

      this.group.set(g);

      const predMap = new Map(ps.map((p) => [p.match_id, p]));
      const now = new Date();

      const rows: MatchRow[] = ms.map((m) => {
        const pred = predMap.get(m.id) ?? null;
        const isOpen = new Date(m.prediction_deadline) > now && m.status !== 'finished';

        this.formValues[m.id] = {
          home: pred?.predicted_home ?? 0,
          away: pred?.predicted_away ?? 0,
        };

        return { ...m, prediction: pred, isOpen };
      });

      this.rows.set(rows);
    } catch (e: unknown) {
      this.toast.error(e instanceof Error ? e.message : 'Error al cargar predicciones');
    } finally {
      this.isLoading.set(false);
    }
  }

  async save(row: MatchRow): Promise<void> {
    const userId = this.authStore.user()!.id;
    const vals = this.formValues[row.id];

    const s = new Set(this.saving());
    s.add(row.id);
    this.saving.set(s);

    try {
      const pred = await this.predictionService.save(
        {
          group_id: this.id,
          user_id: userId,
          match_id: row.id,
          predicted_home: vals.home,
          predicted_away: vals.away,
        },
        row.prediction_deadline,
      );

      // Update the row with the saved prediction
      this.rows.set(this.rows().map((r) => (r.id === row.id ? { ...r, prediction: pred } : r)));

      // Show saved feedback briefly
      const savedSet = new Set(this.saved());
      savedSet.add(row.id);
      this.saved.set(savedSet);
      setTimeout(() => {
        const s2 = new Set(this.saved());
        s2.delete(row.id);
        this.saved.set(s2);
      }, 2000);
    } catch (e: unknown) {
      this.toast.error(e instanceof Error ? e.message : 'Error al guardar');
    } finally {
      const s2 = new Set(this.saving());
      s2.delete(row.id);
      this.saving.set(s2);
    }
  }

  isSaving(matchId: string): boolean {
    return this.saving().has(matchId);
  }

  isSaved(matchId: string): boolean {
    return this.saved().has(matchId);
  }

  hasPrediction(row: MatchRow): boolean {
    return row.prediction !== null;
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('es-AR', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  formatDeadline(iso: string): string {
    return new Date(iso).toLocaleDateString('es-AR', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  // Group matches by round, preserving order
  get rounds(): { label: string; rows: MatchRow[] }[] {
    const map = new Map<string, MatchRow[]>();
    for (const row of this.rows()) {
      const key = row.round ?? 'Sin jornada';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(row);
    }
    return Array.from(map.entries()).map(([label, rows]) => ({ label, rows }));
  }

  get openCount(): number {
    return this.rows().filter((r) => r.isOpen).length;
  }

  get predictedCount(): number {
    return this.rows().filter((r) => r.prediction !== null).length;
  }
}
