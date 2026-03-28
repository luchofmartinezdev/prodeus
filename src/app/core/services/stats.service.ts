import { inject, Injectable } from '@angular/core';
import { StatsRepository } from '../../data/repositories/stats.repository';

export interface GlobalStats {
  activeGroups: number;
  totalGroups: number;
  totalPredictions: number;
  activeMembers: number;
  registeredUsers: number;
  tournamentsByStatus: { draft: number; active: number; closed: number };
}

@Injectable({ providedIn: 'root' })
export class StatsService {
  private readonly repo = inject(StatsRepository);

  async getGlobalStats(): Promise<GlobalStats> {
    // All independent queries fire simultaneously
    const [activeTournamentsRes, totalGroups, predictions, members, users, draft, active, closed] =
      await Promise.all([
        this.repo.findActiveTournamentIds(),
        this.repo.countTotalGroups(),
        this.repo.countPredictions(),
        this.repo.countActiveMembers(),
        this.repo.countRegisteredUsers(),
        this.repo.countTournamentsByStatus('draft'),
        this.repo.countTournamentsByStatus('active'),
        this.repo.countTournamentsByStatus('closed'),
      ]);

    // countGroupsByTournamentIds depends on activeTournamentsRes — runs after
    const activeTournamentIds = (activeTournamentsRes.data ?? []).map((t) => t.id);
    const activeGroups = await this.repo.countGroupsByTournamentIds(activeTournamentIds);

    return {
      activeGroups: activeGroups.count ?? 0,
      totalGroups: totalGroups.count ?? 0,
      totalPredictions: predictions.count ?? 0,
      activeMembers: members.count ?? 0,
      registeredUsers: users.count ?? 0,
      tournamentsByStatus: {
        draft: draft.count ?? 0,
        active: active.count ?? 0,
        closed: closed.count ?? 0,
      },
    };
  }
}
