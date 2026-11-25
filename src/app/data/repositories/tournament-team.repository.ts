import { Injectable, inject } from '@angular/core';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  where,
} from 'firebase/firestore';
import { db } from '../firebase.client';
import { mapFirestoreError, type RepoResult } from '../firestore-helpers';
import type { Team } from '../database.types';
import { TeamRepository } from './team.repository';

// ─── Repository ───────────────────────────────────────────────
// Join torneo↔equipo: el "roster" de equipos de un torneo para una
// temporada dada. Doc ID = `${tournamentId}_${teamId}` (idempotente —
// agregar el mismo equipo dos veces no duplica el join).

function joinId(tournamentId: string, teamId: string): string {
  return `${tournamentId}_${teamId}`;
}

@Injectable({ providedIn: 'root' })
export class TournamentTeamRepository {
  private readonly teamRepo = inject(TeamRepository);

  async findByTournament(tournamentId: string): Promise<RepoResult<Team[]>> {
    try {
      const snap = await getDocs(
        query(collection(db, 'tournamentTeams'), where('tournamentId', '==', tournamentId)),
      );
      const teamIds = snap.docs.map((d) => d.data()['teamId'] as string);
      const { data, error } = await this.teamRepo.findByIds(teamIds);
      if (error) return { data: null, error };
      // Mantener el orden alfabético esperado por la UI
      const sorted = [...(data ?? [])].sort((a, b) => a.name.localeCompare(b.name));
      return { data: sorted, error: null };
    } catch (e) {
      return { data: null, error: mapFirestoreError(e) };
    }
  }

  /** Agrega un equipo (ya existente o recién creado) al roster de un
   *  torneo. Idempotente: si ya estaba, no hace nada. */
  async add(tournamentId: string, teamId: string): Promise<{ error: RepoResult<never>['error'] }> {
    try {
      const ref = doc(db, 'tournamentTeams', joinId(tournamentId, teamId));
      await setDoc(ref, { tournamentId, teamId, createdAt: new Date().toISOString() });
      return { error: null };
    } catch (e) {
      return { error: mapFirestoreError(e) };
    }
  }

  /** Quita un equipo del roster del torneo (p.ej. descendió/no participa
   *  esta temporada). No borra el equipo global ni sus partidos pasados. */
  async remove(
    tournamentId: string,
    teamId: string,
  ): Promise<{ error: RepoResult<never>['error'] }> {
    try {
      await deleteDoc(doc(db, 'tournamentTeams', joinId(tournamentId, teamId)));
      return { error: null };
    } catch (e) {
      return { error: mapFirestoreError(e) };
    }
  }

  async isInTournament(tournamentId: string, teamId: string): Promise<boolean> {
    const snap = await getDoc(doc(db, 'tournamentTeams', joinId(tournamentId, teamId)));
    return snap.exists();
  }
}
