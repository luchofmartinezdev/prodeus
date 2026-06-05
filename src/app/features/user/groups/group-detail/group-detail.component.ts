import {
  ChangeDetectionStrategy,
  Component,
  inject,
  Input,
  OnInit,
  SimpleChanges,
  signal,
  OnChanges,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthStore } from '../../../../state/auth.store';
import { GroupStore } from '../../../../state/group.store';
import { RankingStore } from '../../../../state/ranking.store';
import { MatchService } from '../../../../core/services/match.service';
import { PredictionService } from '../../../../core/services/prediction.service';
import { ConfirmModalComponent } from '@shared/components/confirm-modal/confirm-modal.component';
import { getFlagEmoji } from '../../../../shared/utils/flags';
import type { MatchWithTeams } from '../../../../data/repositories/match.repository';

@Component({
  selector: 'app-group-detail',
  imports: [RouterLink, FormsModule, ConfirmModalComponent],
  templateUrl: './group-detail.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GroupDetailComponent implements OnInit, OnChanges {
  // ngOnChanges needed because withComponentInputBinding() reuses the instance when navigating
  // between different group IDs — ngOnInit does NOT re-run in that case
  @Input() id!: string;

  protected readonly store = inject(GroupStore);
  protected readonly authStore = inject(AuthStore);
  protected readonly rankingStore = inject(RankingStore);
  private readonly matchService = inject(MatchService);
  private readonly predictionService = inject(PredictionService);

  readonly activeTab = signal<'predicciones' | 'ranking' | 'grupo'>('predicciones');
  readonly editing = signal(false);
  readonly copied = signal(false);
  readonly showLeaveModal = signal(false);

  readonly totalMatches = signal(0);
  readonly predictedCount = signal(0);
  readonly nextMatch = signal<MatchWithTeams | null>(null);
  readonly overviewLoading = signal(true);
  readonly isLoadingDetail = signal(true);
  readonly isLoadingRanking = signal(true);

  editName = '';
  editJoinMode: 'open' | 'closed' = 'open';

  ngOnInit(): void {
    this.loadGroup(this.id);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['id'] && !changes['id'].firstChange) {
      this.loadGroup(this.id);
    }
  }

  private loadGroup(id: string): void {
    this.isLoadingDetail.set(true);
    this.isLoadingRanking.set(true);
    this.overviewLoading.set(true);
    this.store
      .loadOne(id)
      .then(() => this.loadOverview())
      .finally(() => this.isLoadingDetail.set(false));
    this.store.loadMembers(id);
    this.rankingStore.loadRanking(id).finally(() => this.isLoadingRanking.set(false));
  }

  private async loadOverview(): Promise<void> {
    const userId = this.authStore.user()?.id;
    const g = this.store.selected();
    if (!userId || !g) {
      this.overviewLoading.set(false);
      return;
    }
    try {
      const [matches, predictions] = await Promise.all([
        this.matchService.getByTournament(g.tournament_id),
        this.predictionService.getByGroup(this.id, userId),
      ]);
      this.totalMatches.set(matches.length);
      this.predictedCount.set(predictions.length);
      const now = new Date();
      const upcoming = matches
        .filter((m) => m.status !== 'finished' && new Date(m.match_date) >= now)
        .sort((a, b) => new Date(a.match_date).getTime() - new Date(b.match_date).getTime());
      this.nextMatch.set(upcoming[0] ?? null);
    } catch {
      // ignore overview errors
    } finally {
      this.overviewLoading.set(false);
    }
  }

  get isLeader(): boolean {
    return this.store.selected()?.leader_id === this.authStore.user()?.id;
  }

  get currentUserId(): string | undefined {
    return this.authStore.user()?.id;
  }

  get myPoints(): number {
    const userId = this.authStore.user()?.id;
    return this.rankingStore.ranking().find((r) => r.userId === userId)?.totalPoints ?? 0;
  }

  pointDiff(position: number): number | null {
    const ranking = this.rankingStore.ranking();
    if (position === 1 || ranking.length < 2) return null;
    const current = ranking.find((r) => r.position === position);
    const leader = ranking[0];
    if (!current || !leader) return null;
    return current.totalPoints - leader.totalPoints;
  }

  openEdit(): void {
    const g = this.store.selected();
    if (!g) return;
    this.editName = g.name;
    this.editJoinMode = g.join_mode;
    this.editing.set(true);
  }

  cancelEdit(): void {
    this.editing.set(false);
  }

  async saveEdit(): Promise<void> {
    if (!this.editName.trim()) return;
    await this.store.update(this.id, {
      name: this.editName.trim(),
      join_mode: this.editJoinMode,
    });
    this.editing.set(false);
  }

  async copyInviteCode(code: string): Promise<void> {
    await navigator.clipboard.writeText(code);
    this.copied.set(true);
    setTimeout(() => this.copied.set(false), 2000);
  }

  async shareGroup(code: string, groupName: string): Promise<void> {
    const text = `Unite a "${groupName}" en Prodeus con el código: ${code}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Prodeus', text });
      } catch {
        // user cancelled share
      }
    } else {
      await this.copyInviteCode(code);
    }
  }

  async onDelete(): Promise<void> {
    const g = this.store.selected();
    if (!g) return;
    if (!confirm(`¿Eliminar el grupo "${g.name}"? Esta acción no se puede deshacer.`)) return;
    await this.store.remove(this.id);
  }

  joinModeLabel(mode: 'open' | 'closed'): string {
    return mode === 'open' ? 'Abierto' : 'Cerrado';
  }

  joinModeClass(mode: 'open' | 'closed'): string {
    return mode === 'open'
      ? 'bg-green-950 text-green-400 border border-green-800'
      : 'bg-yellow-950 text-yellow-400 border border-yellow-800';
  }

  avatarLetter(username: string): string {
    return username.charAt(0).toUpperCase();
  }

  openLeaveModal(): void {
    this.showLeaveModal.set(true);
  }

  closeLeaveModal(): void {
    this.showLeaveModal.set(false);
  }

  async confirmLeave(): Promise<void> {
    const currentUser = this.authStore.user();
    if (!currentUser) return;
    await this.store.leave(this.id, currentUser.id);
    this.closeLeaveModal();
  }

  getFlag(name: string | null | undefined): string {
    return name ? getFlagEmoji(name) : '';
  }

  formatMatchDate(iso: string): string {
    return new Date(iso).toLocaleString('es-AR', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  positionIcon(pos: number): string {
    if (pos === 1) return '🥇';
    if (pos === 2) return '🥈';
    if (pos === 3) return '🥉';
    return `${pos}°`;
  }
}
