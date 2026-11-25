import { inject, Injectable } from '@angular/core';
import type { Team } from '../../data/database.types';
import { TeamRepository, type TeamDto } from '../../data/repositories/team.repository';

@Injectable({ providedIn: 'root' })
export class TeamService {
  private readonly repo = inject(TeamRepository);

  /** Todos los equipos de la plataforma — usado para buscar uno existente
   *  antes de crear uno nuevo (evita duplicar clubes entre torneos). */
  async getAll(): Promise<Team[]> {
    const { data, error } = await this.repo.findAll();
    if (error) throw new Error('No se pudieron cargar los equipos');
    return data ?? [];
  }

  async create(dto: TeamDto): Promise<Team> {
    const { data, error } = await this.repo.create(dto);
    if (error) throw new Error('No se pudo crear el equipo');
    return data!;
  }

  async update(id: string, dto: Partial<TeamDto>): Promise<Team> {
    const { data, error } = await this.repo.update(id, dto);
    if (error) throw new Error('No se pudo actualizar el equipo');
    return data!;
  }

  async remove(id: string): Promise<void> {
    const { error } = await this.repo.remove(id);
    if (error) throw new Error('No se pudo eliminar el equipo');
  }
}
