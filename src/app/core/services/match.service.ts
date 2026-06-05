import { inject, Injectable } from '@angular/core';
import {
  MatchRepository,
  type MatchDto,
  type MatchResultDto,
  type MatchWithTeams,
} from '../../data/repositories/match.repository';
import { ToastService } from './toast.service';

const MATCH_CACHE_TTL = 60_000;

@Injectable({ providedIn: 'root' })
export class MatchService {
  private readonly repo = inject(MatchRepository);
  private readonly toast = inject(ToastService);
  private readonly _cache = new Map<string, { data: MatchWithTeams[]; ts: number }>();

  async getByTournament(tournamentId: string): Promise<MatchWithTeams[]> {
    const cached = this._cache.get(tournamentId);
    if (cached && Date.now() - cached.ts < MATCH_CACHE_TTL) return cached.data;
    const { data, error } = await this.repo.findByTournament(tournamentId);
    if (error) throw new Error('No se pudieron cargar los partidos');
    const matches = (data as unknown as MatchWithTeams[]) ?? [];
    this._cache.set(tournamentId, { data: matches, ts: Date.now() });
    return matches;
  }

  invalidateCache(tournamentId?: string): void {
    if (tournamentId) this._cache.delete(tournamentId);
    else this._cache.clear();
  }

  async create(dto: MatchDto): Promise<void> {
    const { error } = await this.repo.create(dto);
    if (error) {
      if (error.message.includes('different_teams'))
        throw new Error('Los equipos no pueden ser iguales');
      throw new Error('No se pudo crear el partido');
    }
    this.invalidateCache(dto.tournament_id);
  }

  async update(id: string, dto: Partial<Omit<MatchDto, 'tournament_id'>>): Promise<void> {
    const { error } = await this.repo.update(id, dto);
    if (error) throw new Error('No se pudo actualizar el partido');
    this.invalidateCache();
  }

  async loadResult(id: string, dto: MatchResultDto): Promise<void> {
    const { error } = await this.repo.loadResult(id, dto);
    if (error) throw new Error('No se pudo cargar el resultado');
    this.invalidateCache();
    try {
      const { error: scoreErr } = await this.repo.scoreMatch(id);
      if (scoreErr) {
        this.toast.error('Resultado guardado, pero falló el cálculo de puntos');
      }
    } catch {
      this.toast.error('Resultado guardado, pero falló el cálculo de puntos');
    }
  }

  async remove(id: string): Promise<void> {
    const { error } = await this.repo.remove(id);
    if (error) throw new Error('No se pudo eliminar el partido');
    this.invalidateCache();
  }
}
