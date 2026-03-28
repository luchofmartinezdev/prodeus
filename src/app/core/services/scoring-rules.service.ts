import { inject, Injectable } from '@angular/core';
import type { ScoringRule } from '../../data/database.types';
import { ScoringRulesRepository } from '../../data/repositories/scoring-rules.repository';

@Injectable({ providedIn: 'root' })
export class ScoringRulesService {
  private readonly repo = inject(ScoringRulesRepository);

  async getAll(): Promise<ScoringRule[]> {
    const { data, error } = await this.repo.findAll();
    if (error) throw new Error('No se pudieron cargar las reglas de puntuación');
    return data ?? [];
  }

  async getByTournament(tournamentId: string): Promise<ScoringRule[]> {
    const { data, error } = await this.repo.findByTournament(tournamentId);
    if (error) throw new Error('No se pudieron cargar las reglas de puntuación');
    return data ?? [];
  }

  async update(id: string, pointsValue: number, description?: string): Promise<ScoringRule> {
    const { data, error } = await this.repo.update(id, pointsValue, description);
    if (error) throw new Error('No se pudo actualizar la regla');
    return data;
  }
}
