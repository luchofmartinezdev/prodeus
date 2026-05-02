import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  Input,
  OnInit,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { PredictionService } from '../../../core/services/prediction.service';
import { MatchService } from '../../../core/services/match.service';
import { GroupService } from '../../../core/services/group.service';
import { AuthStore } from '../../../state/auth.store';
import { ToastService } from '../../../core/services/toast.service';
import { getFlagEmoji } from '../../../shared/utils/flags';
import type { Prediction } from '../../../data/database.types';
import type { GroupWithTournament } from '../../../data/repositories/group.repository';
import type { MatchWithTeams } from '../../../data/repositories/match.repository';

export type MatchRow = MatchWithTeams & {
  prediction: Prediction | null;
  isOpen: boolean;
};

const PHASE_ORDER = [
  'Grupo A',
  'Grupo B',
  'Grupo C',
  'Grupo D',
  'Grupo E',
  'Grupo F',
  'Grupo G',
  'Grupo H',
  'Grupo I',
  'Grupo J',
  'Grupo K',
  'Grupo L',
  '16avos de Final',
  'Octavos de Final',
  'Cuartos de Final',
  'Semifinales',
  'Tercer Puesto',
  'Final',
];

function bracketPhaseLabel(bracketId: string): string {
  if (bracketId.startsWith('R16_')) return '16avos de Final';
  if (bracketId.startsWith('R8_')) return 'Octavos de Final';
  if (bracketId.startsWith('QF_')) return 'Cuartos de Final';
  if (bracketId.startsWith('SF_')) return 'Semifinales';
  if (bracketId === 'THIRD') return 'Tercer Puesto';
  if (bracketId === 'FINAL') return 'Final';
  return bracketId;
}

@Component({
  selector: 'app-predictions',
  imports: [RouterLink, FormsModule],
  templateUrl: './predictions.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
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

  // View tabs
  readonly activeMainTab = signal<'fecha' | 'fase'>('fecha');
  readonly activeFechaTab = signal<string>('');
  readonly activeFaseTab = signal<string>('');

  // form values: matchId → { home, away }
  readonly formValues: Record<string, { home: number; away: number }> = {};
  // saving state per matchId
  readonly saving = signal<Set<string>>(new Set());
  // saved feedback per matchId
  readonly saved = signal<Set<string>>(new Set());

  readonly fechas = computed(() => {
    // Determine group-stage matchday per match (1st, 2nd or 3rd game of its group)
    const groupBuckets = new Map<string, MatchRow[]>();
    for (const row of this.rows()) {
      if (!row.bracket_id) {
        const g = row.round ?? 'Sin fase';
        if (!groupBuckets.has(g)) groupBuckets.set(g, []);
        groupBuckets.get(g)!.push(row);
      }
    }
    const matchDayMap = new Map<string, number>(); // matchId → 1 | 2 | 3
    for (const matches of groupBuckets.values()) {
      matches.sort((a, b) => a.match_date.localeCompare(b.match_date));
      // 4-team groups: 2 matches per matchday → indices 0-1=Fecha1, 2-3=Fecha2, 4-5=Fecha3
      matches.forEach((m, i) => matchDayMap.set(m.id, Math.floor(i / 2) + 1));
    }

    // Assign each match to one of 8 fechas
    const buckets = new Map<number, MatchRow[]>();
    for (const row of this.rows()) {
      let n: number;
      if (row.bracket_id) {
        if (row.bracket_id.startsWith('R16_')) n = 4;
        else if (row.bracket_id.startsWith('R8_')) n = 5;
        else if (row.bracket_id.startsWith('QF_')) n = 6;
        else if (row.bracket_id.startsWith('SF_')) n = 7;
        else n = 8; // THIRD, FINAL
      } else {
        n = matchDayMap.get(row.id) ?? 1;
      }
      if (!buckets.has(n)) buckets.set(n, []);
      buckets.get(n)!.push(row);
    }

    return Array.from(buckets.entries())
      .sort(([a], [b]) => a - b)
      .map(([n, rows]) => ({ label: `Fecha ${n}`, rows }));
  });

  readonly fases = computed(() => {
    const map = new Map<string, MatchRow[]>();
    for (const row of this.rows()) {
      const key = row.bracket_id ? bracketPhaseLabel(row.bracket_id) : (row.round ?? 'Sin fase');
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(row);
    }
    const result = Array.from(map.entries()).map(([label, rows]) => ({ label, rows }));
    result.sort((a, b) => {
      const ai = PHASE_ORDER.indexOf(a.label);
      const bi = PHASE_ORDER.indexOf(b.label);
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    });
    return result;
  });

  get currentRows(): MatchRow[] {
    if (this.activeMainTab() === 'fecha') {
      return this.fechas().find((f) => f.label === this.activeFechaTab())?.rows ?? [];
    }
    return this.fases().find((f) => f.label === this.activeFaseTab())?.rows ?? [];
  }

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

      // Initialize sub-tabs with first available option
      const f = this.fechas();
      if (f.length > 0) this.activeFechaTab.set(f[0].label);
      const p = this.fases();
      if (p.length > 0) this.activeFaseTab.set(p[0].label);
    } catch (e: unknown) {
      this.toast.error(e instanceof Error ? e.message : 'Error al cargar predicciones');
    } finally {
      this.isLoading.set(false);
    }
  }

  switchMainTab(tab: 'fecha' | 'fase'): void {
    this.activeMainTab.set(tab);
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

      this.rows.set(this.rows().map((r) => (r.id === row.id ? { ...r, prediction: pred } : r)));

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

  getFlag(name: string | null | undefined): string {
    return name ? getFlagEmoji(name) : '';
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleString('es-AR', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  formatDeadline(iso: string): string {
    return new Date(iso).toLocaleString('es-AR', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  get openCount(): number {
    return this.rows().filter((r) => r.isOpen).length;
  }

  get predictedCount(): number {
    return this.rows().filter((r) => r.prediction !== null).length;
  }
}
