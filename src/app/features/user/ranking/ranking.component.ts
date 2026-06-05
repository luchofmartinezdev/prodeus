import {
  ChangeDetectionStrategy,
  Component,
  inject,
  Input,
  OnDestroy,
  OnInit,
  SimpleChanges,
  signal,
  OnChanges,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthStore } from '../../../state/auth.store';
import { GroupStore } from '../../../state/group.store';
import { RankingStore } from '../../../state/ranking.store';
import { getFlagEmoji } from '../../../shared/utils/flags';

@Component({
  selector: 'app-ranking',
  imports: [RouterLink],
  templateUrl: './ranking.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RankingComponent implements OnInit, OnDestroy, OnChanges {
  @Input() id!: string; // group id

  protected readonly rankingStore = inject(RankingStore);
  protected readonly groupStore = inject(GroupStore);
  protected readonly authStore = inject(AuthStore);

  readonly activeTab = signal<'ranking' | 'historial'>('ranking');
  readonly isLoadingRanking = signal(true);

  // Arrow function preserves `this` for removeEventListener
  private readonly onVisibilityChange = () => {
    if (document.visibilityState !== 'visible') return;
    // Realtime may have missed updates while the tab was backgrounded — reload manually.
    this.rankingStore.loadRanking(this.id).catch(() => undefined);
    const userId = this.currentUserId;
    if (userId) this.rankingStore.loadHistorial(userId, this.id).catch(() => undefined);
  };

  ngOnInit(): void {
    this.loadRankingData(this.id);
    document.addEventListener('visibilitychange', this.onVisibilityChange);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['id'] && !changes['id'].firstChange) {
      this.loadRankingData(this.id);
    }
  }

  ngOnDestroy(): void {
    this.rankingStore.unsubscribe();
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
  }

  private loadRankingData(id: string): void {
    this.isLoadingRanking.set(true);
    this.groupStore.loadOne(id);
    this.rankingStore.loadRanking(id).finally(() => this.isLoadingRanking.set(false));
    this.rankingStore.subscribeToGroup(id);

    const userId = this.authStore.user()?.id;
    if (userId) {
      this.rankingStore.loadHistorial(userId, id);
    }
  }

  switchTab(tab: 'ranking' | 'historial'): void {
    this.activeTab.set(tab);
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

  pointsBadgeClass(points: number | null): string {
    if (points === null) return 'bg-gray-700 text-gray-400';
    if (points === 0) return 'bg-red-900 text-red-300';
    if (points >= 3) return 'bg-green-900 text-green-300';
    return 'bg-yellow-900 text-yellow-300';
  }

  positionClass(pos: number): string {
    if (pos === 1) return 'text-yellow-400 font-black';
    if (pos === 2) return 'text-gray-300 font-bold';
    if (pos === 3) return 'text-amber-600 font-bold';
    return 'text-gray-500';
  }

  positionIcon(pos: number): string {
    if (pos === 1) return '🥇';
    if (pos === 2) return '🥈';
    if (pos === 3) return '🥉';
    return `${pos}°`;
  }

  getFlag(name: string): string {
    return getFlagEmoji(name);
  }

  get currentUserId(): string | undefined {
    return this.authStore.user()?.id;
  }
}
