import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatchService } from '../../../core/services/match.service';
import { AuthStore } from '../../../state/auth.store';
import { GroupStore } from '../../../state/group.store';
import type { GroupWithTournament } from '../../../data/repositories/group.repository';
import type { MatchWithTeams } from '../../../data/repositories/match.repository';

@Component({
  selector: 'app-dashboard',
  imports: [RouterLink],
  templateUrl: './dashboard.component.html',
})
export class DashboardComponent implements OnInit {
  protected readonly authStore = inject(AuthStore);
  protected readonly groupStore = inject(GroupStore);
  private readonly matchService = inject(MatchService);

  readonly upcomingMatches = signal<MatchWithTeams[]>([]);
  readonly isLoadingMatches = signal(false);

  ngOnInit(): void {
    this.groupStore.loadMyGroups().then(() => this.loadUpcomingMatches());
  }

  private async loadUpcomingMatches(): Promise<void> {
    const groups = this.groupStore.groups();
    if (groups.length === 0) return;

    this.isLoadingMatches.set(true);
    try {
      const tournamentIds = [...new Set(groups.map((g) => g.tournament_id))];
      const allMatches = (
        await Promise.all(tournamentIds.map((id) => this.matchService.getByTournament(id)))
      ).flat();

      const upcoming = allMatches
        .filter((m) => m.status === 'scheduled')
        .sort((a, b) => a.match_date.localeCompare(b.match_date))
        .slice(0, 5);

      this.upcomingMatches.set(upcoming);
    } catch {
      // silently ignore — dashboard is best-effort
    } finally {
      this.isLoadingMatches.set(false);
    }
  }

  get previewGroups(): GroupWithTournament[] {
    return this.groupStore.groups().slice(0, 4);
  }

  get activeTournamentCount(): number {
    return new Set(this.groupStore.groups().map((g) => g.tournament_id)).size;
  }

  formatDate(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' });
  }

  formatTime(iso: string): string {
    return new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  }
}
