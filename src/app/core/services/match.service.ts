import { inject, Injectable } from '@angular/core';
import {
  MatchRepository,
  type MatchDto,
  type MatchResultDto,
  type MatchWithTeams,
} from '../../data/repositories/match.repository';

@Injectable({ providedIn: 'root' })
export class MatchService {
  private readonly repo = inject(MatchRepository);

  async getByTournament(tournamentId: string): Promise<MatchWithTeams[]> {
    const { data, error } = await this.repo.findByTournament(tournamentId);
    if (error) throw new Error('No se pudieron cargar los partidos');
    return (data as unknown as MatchWithTeams[]) ?? [];
  }

  async create(dto: MatchDto): Promise<void> {
    const { error } = await this.repo.create(dto);
    if (error) {
      if (error.message.includes('different_teams'))
        throw new Error('Los equipos no pueden ser iguales');
      throw new Error('No se pudo crear el partido');
    }
  }

  async update(id: string, dto: Partial<Omit<MatchDto, 'tournament_id'>>): Promise<void> {
    const { error } = await this.repo.update(id, dto);
    if (error) throw new Error('No se pudo actualizar el partido');
  }

  async loadResult(id: string, dto: MatchResultDto): Promise<void> {
    const { error } = await this.repo.loadResult(id, dto);
    if (error) throw new Error('No se pudo cargar el resultado');
    // Trigger scoring asynchronously — failure doesn't block result loading
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    this.repo.scoreMatch(id).catch(() => {});
  }

  async remove(id: string): Promise<void> {
    const { error } = await this.repo.remove(id);
    if (error) throw new Error('No se pudo eliminar el partido');
  }
}
