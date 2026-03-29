import { inject, Injectable } from '@angular/core';
import type { GeneratePhaseResult, Match, PhaseStatus } from '../../data/database.types';
import { TournamentRepository } from '../../data/repositories/tournament.repository';

// ─── Orden canónico de fases ──────────────────────────────────

const PHASE_ORDER = ['GROUP', 'R16', 'R8', 'QF', 'SF', 'FINAL'] as const;
type PlayablePhase = (typeof PHASE_ORDER)[number];

const NEXT_PHASE: Record<PlayablePhase, PlayablePhase | null> = {
  GROUP: 'R16',
  R16: 'R8',
  R8: 'QF',
  QF: 'SF',
  SF: 'FINAL',
  FINAL: null,
};

// ─── Helper: determinar fase desde bracket_id ─────────────────

function phaseOf(bracketId: string | null): PlayablePhase {
  if (!bracketId) return 'GROUP';
  if (bracketId.startsWith('R16_')) return 'R16';
  if (bracketId.startsWith('R8_')) return 'R8';
  if (bracketId.startsWith('QF_')) return 'QF';
  if (bracketId === 'SF_1' || bracketId === 'SF_2') return 'SF';
  // FINAL and THIRD are both resolved in the FINAL step
  return 'FINAL';
}

// ─── Service ──────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class TournamentService {
  private readonly repo = inject(TournamentRepository);

  /**
   * Calcula el estado de fase del torneo leyendo todos los partidos y
   * determinando qué fase está activa, cuántos partidos faltan y cuál es
   * la siguiente fase a generar.
   */
  async getPhaseStatus(tournamentId: string): Promise<PhaseStatus> {
    const { data, error } = await this.repo.findMatchesForPhaseStatus(tournamentId);
    if (error) throw new Error('No se pudo obtener el estado de fase');
    const matches = (data ?? []) as Pick<
      Match,
      'id' | 'bracket_id' | 'status' | 'home_team_id' | 'away_team_id'
    >[];

    // Agrupar partidos por fase
    const byPhase = new Map<PlayablePhase, typeof matches>();
    for (const phase of PHASE_ORDER) byPhase.set(phase, []);
    for (const m of matches) byPhase.get(phaseOf(m.bracket_id))!.push(m);

    // Recorrer fases en orden para encontrar la fase activa
    for (const phase of PHASE_ORDER) {
      const phaseMatches = byPhase.get(phase)!;
      if (phaseMatches.length === 0) continue;

      // Partidos con equipos resueltos (no placeholder)
      const resolved = phaseMatches.filter((m) => m.home_team_id && m.away_team_id);
      const finished = resolved.filter((m) => m.status === 'finished');
      const pending = phaseMatches.filter(
        (m) =>
          (m.home_team_id && m.away_team_id && m.status !== 'finished') ||
          !m.home_team_id ||
          !m.away_team_id,
      );

      const isComplete = resolved.length > 0 && finished.length === resolved.length;

      if (!isComplete) {
        // Esta es la fase actual (no terminada aún)
        return {
          currentPhase: phase,
          currentPhaseComplete: false,
          nextPhase: NEXT_PHASE[phase],
          pendingMatches: pending.length,
          pendingBracketIds: pending.map((m) => m.bracket_id ?? `group:${m.id}`).filter(Boolean),
        };
      }

      // Fase completa → revisar si la siguiente tiene placeholders sin resolver
      const next = NEXT_PHASE[phase];
      if (!next) {
        // Torneo finalizado
        return {
          currentPhase: phase,
          currentPhaseComplete: true,
          nextPhase: null,
          pendingMatches: 0,
          pendingBracketIds: [],
        };
      }

      const nextMatches = byPhase.get(next)!;
      const nextUnresolved = nextMatches.filter((m) => !m.home_team_id || !m.away_team_id);
      if (nextUnresolved.length > 0) {
        // Siguiente fase tiene placeholders: fase actual está completa, se puede generar la siguiente
        return {
          currentPhase: phase,
          currentPhaseComplete: true,
          nextPhase: next,
          pendingMatches: nextUnresolved.length,
          pendingBracketIds: nextUnresolved.map((m) => m.bracket_id!),
        };
      }
      // Si la siguiente fase ya está completamente resuelta, seguir al siguiente ciclo
    }

    // Todos los partidos finalizados
    return {
      currentPhase: 'FINAL',
      currentPhaseComplete: true,
      nextPhase: null,
      pendingMatches: 0,
      pendingBracketIds: [],
    };
  }

  /**
   * Llama a la Edge Function generate-next-phase para resolver los placeholders
   * de la fase indicada con los equipos reales según resultados previos.
   */
  async generateNextPhase(tournamentId: string, phase: string): Promise<GeneratePhaseResult> {
    const result = await this.repo.invokeGenerateNextPhase(tournamentId, phase);
    if (!result.success && result.errors.length > 0) {
      throw new Error(result.errors.join('; '));
    }
    return result;
  }
}
