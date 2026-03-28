import { Component, inject, OnInit, signal } from '@angular/core';
import type { GlobalStats } from '../../../core/services/stats.service';
import { StatsService } from '../../../core/services/stats.service';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-admin-stats',
  templateUrl: './stats.component.html',
})
export class AdminStatsComponent implements OnInit {
  private readonly statsService = inject(StatsService);
  private readonly toast = inject(ToastService);

  readonly stats = signal<GlobalStats | null>(null);
  readonly isLoading = signal(true);

  async ngOnInit(): Promise<void> {
    try {
      this.stats.set(await this.statsService.getGlobalStats());
    } catch (e: unknown) {
      this.toast.error(e instanceof Error ? e.message : 'Error al cargar estadísticas');
    } finally {
      this.isLoading.set(false);
    }
  }
}
