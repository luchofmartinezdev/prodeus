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
import { isoToTs, mapFirestoreError, tsToIso, type RepoResult } from '../firestore-helpers';

// ─── Schemas ──────────────────────────────────────────────────

export const matchSchema = z
  .object({
    tournament_id: z.string().uuid(),
    home_team_id: z.string().uuid('Seleccioná el equipo local'),
    away_team_id: z.string().uuid('Seleccioná el equipo visitante'),
    match_date: z.string().min(1, 'La fecha del partido es requerida'),
    prediction_deadline: z.string().min(1, 'El deadline es requerido'),
    round: z.string().optional().or(z.literal('')),
  })
  .refine((d) => d.home_team_id !== d.away_team_id, {
    message: 'Los equipos no pueden ser iguales',
    path: ['away_team_id'],
  });

export const matchResultSchema = z.object({
  home_score: z.number().int().min(0, 'Mínimo 0'),
  away_score: z.number().int().min(0, 'Mínimo 0'),
});

export type MatchDto = z.infer<typeof matchSchema>;
export type MatchResultDto = z.infer<typeof matchResultSchema>;

export interface MatchWithTeams {
  id: string;
  tournament_id: string;
  home_team_id: string | null;
  away_team_id: string | null;
  match_date: string;
  prediction_deadline: string;
  status: 'scheduled' | 'in_progress' | 'finished';
  home_score: number | null;
  away_score: number | null;
  round: string | null;
  bracket_id: string | null;
  home_source_match_id: string | null;
  away_source_match_id: string | null;
  home_source_result: 'winner' | 'loser' | null;
  away_source_result: 'winner' | 'loser' | null;
  home_source_position: '1st' | '2nd' | '3rd' | null;
  away_source_position: '1st' | '2nd' | '3rd' | null;
  home_source_groups: string | null;
  away_source_groups: string | null;
  home_team: {
    id: string;
    name: string;
    short_name: string | null;
    logo_url: string | null;
  } | null;
  away_team: {
    id: string;
    name: string;
    short_name: string | null;
    logo_url: string | null;
  } | null;
  isPlaceholder: boolean;
}

// ─── Row mapping ──────────────────────────────────────────────

interface TeamSnapshot {
  id: string;
  name: string;
  shortName: string | null;
  logoUrl: string | null;
}

function toTeamRow(t: TeamSnapshot | null) {
  if (!t) return null;
  return { id: t.id, name: t.name, short_name: t.shortName ?? null, logo_url: t.logoUrl ?? null };
}

function toRow(id: string, d: Record<string, unknown>): MatchWithTeams {
  const homeTeamId = (d['homeTeamId'] as string | null) ?? null;
  const awayTeamId = (d['awayTeamId'] as string | null) ?? null;
  return {
    id,
    tournament_id: d['tournamentId'] as string,
    home_team_id: homeTeamId,
    away_team_id: awayTeamId,
    match_date: tsToIso(d['matchDate']),
    prediction_deadline: tsToIso(d['predictionDeadline']),
    status: d['status'] as MatchWithTeams['status'],
    home_score: (d['homeScore'] as number | null) ?? null,
    away_score: (d['awayScore'] as number | null) ?? null,
    round: (d['round'] as string | null) ?? null,
    bracket_id: (d['bracketId'] as string | null) ?? null,
    home_source_match_id: (d['homeSourceMatchId'] as string | null) ?? null,
    away_source_match_id: (d['awaySourceMatchId'] as string | null) ?? null,
    home_source_result: (d['homeSourceResult'] as MatchWithTeams['home_source_result']) ?? null,
    away_source_result: (d['awaySourceResult'] as MatchWithTeams['away_source_result']) ?? null,
    home_source_position:
      (d['homeSourcePosition'] as MatchWithTeams['home_source_position']) ?? null,
    away_source_position:
      (d['awaySourcePosition'] as MatchWithTeams['away_source_position']) ?? null,
    home_source_groups: (d['homeSourceGroups'] as string | null) ?? null,
    away_source_groups: (d['awaySourceGroups'] as string | null) ?? null,
    home_team: toTeamRow((d['homeTeam'] as TeamSnapshot | null) ?? null),
    away_team: toTeamRow((d['awayTeam'] as TeamSnapshot | null) ?? null),
    isPlaceholder: !homeTeamId || !awayTeamId,
  };
}

/** Snapshot desnormalizado de equipo — ver docs/firebase/01-firestore-schema.md */
async function teamSnapshot(teamId: string): Promise<TeamSnapshot | null> {
  const snap = await getDoc(doc(db, 'teams', teamId));
  if (!snap.exists()) return null;
  const t = snap.data();
  return {
    id: snap.id,
    name: t['name'],
    shortName: t['shortName'] ?? null,
    logoUrl: t['logoUrl'] ?? null,
  };
}

// ─── Repository ───────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class MatchRepository {
  async findByTournament(tournamentId: string): Promise<RepoResult<MatchWithTeams[]>> {
    try {
      const q = query(
        collection(db, 'matches'),
        where('tournamentId', '==', tournamentId),
        orderBy('matchDate', 'asc'),
      );
      const snap = await getDocs(q);
      return { data: snap.docs.map((d) => toRow(d.id, d.data())), error: null };
    } catch (e) {
      return { data: null, error: mapFirestoreError(e) };
    }
  }

  async create(dto: MatchDto): Promise<RepoResult<MatchWithTeams>> {
    const validated = matchSchema.parse(dto);
    try {
      const [homeTeam, awayTeam] = await Promise.all([
        teamSnapshot(validated.home_team_id),
        teamSnapshot(validated.away_team_id),
      ]);
      const ref = await addDoc(collection(db, 'matches'), {
        tournamentId: validated.tournament_id,
        homeTeamId: validated.home_team_id,
        awayTeamId: validated.away_team_id,
        homeTeam,
        awayTeam,
        matchDate: isoToTs(new Date(validated.match_date).toISOString()),
        predictionDeadline: isoToTs(new Date(validated.prediction_deadline).toISOString()),
        status: 'scheduled',
        homeScore: null,
        awayScore: null,
        round: validated.round || null,
        requiresTiebreak: false,
      });
      const snap = await getDoc(ref);
      return { data: toRow(ref.id, snap.data()!), error: null };
    } catch (e) {
      return { data: null, error: mapFirestoreError(e) };
    }
  }

  async update(
    id: string,
    dto: Partial<Omit<MatchDto, 'tournament_id'>>,
  ): Promise<RepoResult<MatchWithTeams>> {
    try {
      const patch: Record<string, unknown> = {};
      if (dto.home_team_id !== undefined) {
        patch['homeTeamId'] = dto.home_team_id;
        patch['homeTeam'] = await teamSnapshot(dto.home_team_id);
      }
      if (dto.away_team_id !== undefined) {
        patch['awayTeamId'] = dto.away_team_id;
        patch['awayTeam'] = await teamSnapshot(dto.away_team_id);
      }
      if (dto.match_date !== undefined) {
        patch['matchDate'] = isoToTs(new Date(dto.match_date).toISOString());
      }
      if (dto.prediction_deadline !== undefined) {
        patch['predictionDeadline'] = isoToTs(new Date(dto.prediction_deadline).toISOString());
      }
      if (dto.round !== undefined) patch['round'] = dto.round || null;

      const ref = doc(db, 'matches', id);
      await updateDoc(ref, patch);
      const snap = await getDoc(ref);
      return { data: toRow(id, snap.data()!), error: null };
    } catch (e) {
      return { data: null, error: mapFirestoreError(e) };
    }
  }

  async loadResult(id: string, dto: MatchResultDto): Promise<RepoResult<MatchWithTeams>> {
    const validated = matchResultSchema.parse(dto);
    try {
      const ref = doc(db, 'matches', id);
      await updateDoc(ref, {
        homeScore: validated.home_score,
        awayScore: validated.away_score,
        status: 'finished',
      });
      const snap = await getDoc(ref);
      return { data: toRow(id, snap.data()!), error: null };
    } catch (e) {
      return { data: null, error: mapFirestoreError(e) };
    }
  }

  async remove(id: string): Promise<{ error: RepoResult<never>['error'] }> {
    try {
      await deleteDoc(doc(db, 'matches', id));
      return { error: null };
    } catch (e) {
      return { error: mapFirestoreError(e) };
    }
  }

  /** Invoca la Cloud Function scoreMatch (ex Edge Function score-match) */
  async scoreMatch(matchId: string): Promise<{ error: RepoResult<never>['error'] }> {
    try {
      const call = httpsCallable(functions, 'scoreMatch');
      await call({ matchId });
      return { error: null };
    } catch (e) {
      return { error: mapFirestoreError(e) };
    }
  }
}
