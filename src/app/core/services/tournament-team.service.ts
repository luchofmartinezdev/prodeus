import { inject, Injectable } from '@angular/core';
import type { Team } from '../../data/database.types';
import { TournamentTeamRepository } from '../../data/repositories/tournament-team.repository';

@Injectable({ providedIn: 'root' })
export class TournamentTeamService {
  private readonly repo = inject(TournamentTeamRepository);

  async getByTournament(tournamentId: string): Promise<Team[]> {
    const { data, error } = await this.repo.findByTournament(tournamentId);
    if (error) throw new Error('No se pudieron cargar los equipos');
    return data ?? [];
  }

  async add(tournamentId: string, teamId: string): Promise<void> {
    const { error } = await this.repo.add(tournamentId, teamId);
    if (error) throw new Error('No se pudo agregar el equipo al torneo');
  }

  async remove(tournamentId: string, teamId: string): Promise<void> {
    const { error } = await this.repo.remove(tournamentId, teamId);
    if (error) throw new Error('No se pudo quitar el equipo del torneo');
  }
}
