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
  updateDoc,
  where,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../firebase.client';
import { mapFirestoreError, tsToIso, isoToTs, type RepoResult } from '../firestore-helpers';
import type { GeneratePhaseResult, GroupStanding, Tournament } from '../database.types';

// ─── Schemas ──────────────────────────────────────────────────

export const tournamentSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  description: z.string().optional(),
  logo_url: z
    .string()
    .url('URL inválida')
    .refine((url) => /^https?:\/\//i.test(url), 'Solo se permiten URLs http o https')
    .optional()
    .or(z.literal(''))
    .or(z.undefined()),
  start_date: z.string().min(1, 'La fecha de inicio es requerida'),
  end_date: z.string().min(1, 'La fecha de cierre es requerida'),
  status: z.enum(['draft', 'active', 'closed']),
});

export type TournamentDto = z.infer<typeof tournamentSchema>;

interface MatchPhaseRow {
  id: string;
  bracket_id: string | null;
  status: 'scheduled' | 'in_progress' | 'finished';
  home_team_id: string | null;
  away_team_id: string | null;
}

// ─── Row mapping ──────────────────────────────────────────────

function toRow(id: string, d: Record<string, unknown>): Tournament {
  return {
    id,
    name: d['name'] as string,
    description: (d['description'] as string | null) ?? null,
    logo_url: (d['logoUrl'] as string | null) ?? null,
    start_date: tsToIso(d['startDate']).slice(0, 10),
    end_date: tsToIso(d['endDate']).slice(0, 10),
    status: d['status'] as Tournament['status'],
    created_at: tsToIso(d['createdAt']),
  };
}

// ─── Repository ───────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class TournamentRepository {
  /** Todos los torneos, cualquier status — requiere superadmin (ver firestore.rules). */
  async findAll(): Promise<RepoResult<Tournament[]>> {
    try {
      const q = query(collection(db, 'tournaments'), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      return { data: snap.docs.map((d) => toRow(d.id, d.data())), error: null };
    } catch (e) {
      return { data: null, error: mapFirestoreError(e) };
    }
  }

  /**
   * Solo torneos activos — accesible a cualquier usuario autenticado. El
   * filtro `where('status','==','active')` es necesario para que la regla
   * de Firestore (`resource.data.status == 'active' || isSuperadmin()`)
   * pueda probar la query sin leer cada doc; sin el filtro, un usuario no
   * superadmin recibe permission-denied en la query completa.
   */
  async findActive(): Promise<RepoResult<Tournament[]>> {
    try {
      const q = query(
        collection(db, 'tournaments'),
        where('status', '==', 'active'),
        orderBy('createdAt', 'desc'),
      );
      const snap = await getDocs(q);
      return { data: snap.docs.map((d) => toRow(d.id, d.data())), error: null };
    } catch (e) {
      return { data: null, error: mapFirestoreError(e) };
    }
  }

  async findOne(id: string): Promise<RepoResult<Tournament>> {
    try {
      const snap = await getDoc(doc(db, 'tournaments', id));
      if (!snap.exists()) {
        return { data: null, error: { code: 'not-found', message: 'Torneo no encontrado' } };
      }
      return { data: toRow(snap.id, snap.data()), error: null };
    } catch (e) {
      return { data: null, error: mapFirestoreError(e) };
    }
  }

  async create(dto: TournamentDto): Promise<RepoResult<Tournament>> {
    const validated = tournamentSchema.parse(dto);
    try {
      const ref = await addDoc(collection(db, 'tournaments'), {
        name: validated.name,
        description: validated.description || null,
        logoUrl: validated.logo_url || null,
        startDate: isoToTs(validated.start_date),
        endDate: isoToTs(validated.end_date),
        status: validated.status,
        createdAt: isoToTs(new Date().toISOString()),
      });
      const snap = await getDoc(ref);
      return { data: toRow(ref.id, snap.data()!), error: null };
    } catch (e) {
      return { data: null, error: mapFirestoreError(e) };
    }
  }

  async update(id: string, dto: Partial<TournamentDto>): Promise<RepoResult<Tournament>> {
    try {
      const patch: Record<string, unknown> = {};
      if (dto.name !== undefined) patch['name'] = dto.name;
      if (dto.description !== undefined) patch['description'] = dto.description || null;
      if (dto.logo_url !== undefined) patch['logoUrl'] = dto.logo_url || null;
      if (dto.start_date !== undefined) patch['startDate'] = isoToTs(dto.start_date);
      if (dto.end_date !== undefined) patch['endDate'] = isoToTs(dto.end_date);
      if (dto.status !== undefined) patch['status'] = dto.status;
      const ref = doc(db, 'tournaments', id);
      await updateDoc(ref, patch);
      const snap = await getDoc(ref);
      return { data: toRow(id, snap.data()!), error: null };
    } catch (e) {
      return { data: null, error: mapFirestoreError(e) };
    }
  }

  async changeStatus(
    id: string,
    status: 'draft' | 'active' | 'closed',
  ): Promise<RepoResult<Tournament>> {
    return this.update(id, { status });
  }

  async remove(id: string): Promise<{ error: RepoResult<never>['error'] }> {
    try {
      await deleteDoc(doc(db, 'tournaments', id));
      return { error: null };
    } catch (e) {
      return { error: mapFirestoreError(e) };
    }
  }

  // ─── Playoff methods ─────────────────────────────────────────

  async findMatchesForPhaseStatus(tournamentId: string): Promise<RepoResult<MatchPhaseRow[]>> {
    try {
      const q = query(
        collection(db, 'matches'),
        where('tournamentId', '==', tournamentId),
        orderBy('matchDate', 'asc'),
      );
      const snap = await getDocs(q);
      const rows: MatchPhaseRow[] = snap.docs.map((d) => {
        const m = d.data();
        return {
          id: d.id,
          bracket_id: (m['bracketId'] as string | null) ?? null,
          status: m['status'],
          home_team_id: (m['homeTeamId'] as string | null) ?? null,
          away_team_id: (m['awayTeamId'] as string | null) ?? null,
        };
      });
      return { data: rows, error: null };
    } catch (e) {
      return { data: null, error: mapFirestoreError(e) };
    }
  }

  async getGroupStandings(tournamentId: string): Promise<GroupStanding[]> {
    const q = query(
      collection(db, 'groupStandings'),
      where('tournamentId', '==', tournamentId),
      orderBy('groupName', 'asc'),
      orderBy('position', 'asc'),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => {
      const s = d.data();
      return {
        id: d.id,
        tournament_id: s['tournamentId'],
        group_name: s['groupName'],
        team_id: s['teamId'],
        position: s['position'],
        played: s['played'],
        won: s['won'],
        drawn: s['drawn'],
        lost: s['lost'],
        goals_for: s['goalsFor'],
        goals_against: s['goalsAgainst'],
        goal_difference: s['goalDifference'],
        points: s['points'],
        calculated_at: tsToIso(s['calculatedAt']),
      } as GroupStanding;
    });
  }

  /** Invoca la Cloud Function generateNextPhase (ex Edge Function generate-next-phase) */
  async invokeGenerateNextPhase(tournamentId: string, phase: string): Promise<GeneratePhaseResult> {
    const call = httpsCallable<{ tournamentId: string; phase: string }, GeneratePhaseResult>(
      functions,
      'generateNextPhase',
    );
    try {
      const { data } = await call({ tournamentId, phase });
      return data;
    } catch (e) {
      const err = e as { message?: string; details?: GeneratePhaseResult };
      if (err.details) return err.details;
      throw new Error(err.message ?? 'Error al invocar generateNextPhase', { cause: e });
    }
  }

  /** Invoca la Cloud Function calculateGroupStandings (ex Edge Function calculate-group-standings) */
  async invokeCalculateGroupStandings(
    tournamentId: string,
  ): Promise<{ error: RepoResult<never>['error'] }> {
    const call = httpsCallable(functions, 'calculateGroupStandings');
    try {
      await call({ tournamentId });
      return { error: null };
    } catch (e) {
      return { error: mapFirestoreError(e) };
    }
  }
}
