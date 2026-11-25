import { Injectable } from '@angular/core';
import { z } from 'zod';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
} from 'firebase/firestore';
import { db } from '../firebase.client';
import { mapFirestoreError, type RepoResult } from '../firestore-helpers';
import type { Team } from '../database.types';

// ─── Schemas ──────────────────────────────────────────────────
// Los equipos son una entidad global (un club existe una sola vez,
// independiente de en qué torneo(s) participe). La relación con un
// torneo vive en `tournament_teams` — ver tournament-team.repository.ts.

export const teamSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  short_name: z.string().max(5, 'Máximo 5 caracteres').optional().or(z.literal('')),
  logo_url: z.string().url('URL inválida').optional().or(z.literal('')).or(z.undefined()),
  country: z.string().optional().or(z.literal('')).or(z.undefined()),
});

export type TeamDto = z.infer<typeof teamSchema>;

// ─── Row mapping ──────────────────────────────────────────────

function toRow(id: string, d: Record<string, unknown>): Team {
  return {
    id,
    name: d['name'] as string,
    short_name: (d['shortName'] as string | null) ?? null,
    logo_url: (d['logoUrl'] as string | null) ?? null,
    country: (d['country'] as string | null) ?? null,
  };
}

// ─── Repository ───────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class TeamRepository {
  /** Todos los equipos de la plataforma, ordenados por nombre — usado para
   *  buscar un equipo existente antes de crear uno nuevo (evita duplicados). */
  async findAll(): Promise<RepoResult<Team[]>> {
    try {
      const snap = await getDocs(query(collection(db, 'teams'), orderBy('name', 'asc')));
      return { data: snap.docs.map((d) => toRow(d.id, d.data())), error: null };
    } catch (e) {
      return { data: null, error: mapFirestoreError(e) };
    }
  }

  async findByIds(ids: string[]): Promise<RepoResult<Team[]>> {
    if (ids.length === 0) return { data: [], error: null };
    try {
      const snaps = await Promise.all(ids.map((id) => getDoc(doc(db, 'teams', id))));
      const data = snaps.filter((s) => s.exists()).map((s) => toRow(s.id, s.data()!));
      return { data, error: null };
    } catch (e) {
      return { data: null, error: mapFirestoreError(e) };
    }
  }

  async create(dto: TeamDto): Promise<RepoResult<Team>> {
    const validated = teamSchema.parse(dto);
    try {
      const ref = await addDoc(collection(db, 'teams'), {
        name: validated.name,
        shortName: validated.short_name || null,
        logoUrl: validated.logo_url || null,
        country: validated.country || null,
      });
      const snap = await getDoc(ref);
      return { data: toRow(ref.id, snap.data()!), error: null };
    } catch (e) {
      return { data: null, error: mapFirestoreError(e) };
    }
  }

  async update(id: string, dto: Partial<TeamDto>): Promise<RepoResult<Team>> {
    try {
      const { updateDoc } = await import('firebase/firestore');
      const patch: Record<string, unknown> = {};
      if (dto.name !== undefined) patch['name'] = dto.name;
      if (dto.short_name !== undefined) patch['shortName'] = dto.short_name || null;
      if (dto.logo_url !== undefined) patch['logoUrl'] = dto.logo_url || null;
      if (dto.country !== undefined) patch['country'] = dto.country || null;
      const ref = doc(db, 'teams', id);
      await updateDoc(ref, patch);
      const snap = await getDoc(ref);
      return { data: toRow(id, snap.data()!), error: null };
    } catch (e) {
      return { data: null, error: mapFirestoreError(e) };
    }
  }

  /** Borra el equipo globalmente — usar con cuidado, afecta cualquier
   *  torneo/partido que ya lo referencie. La UI normal solo debería quitarlo
   *  de un torneo (ver TournamentTeamRepository.remove), no borrarlo acá. */
  async remove(id: string): Promise<{ error: RepoResult<never>['error'] }> {
    try {
      await deleteDoc(doc(db, 'teams', id));
      return { error: null };
    } catch (e) {
      return { error: mapFirestoreError(e) };
    }
  }
}
