import { Injectable } from '@angular/core';
import { z } from 'zod';
import { supabase } from '../supabase.client';

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

// ─── Tipo extendido con datos de equipos para visualización ───
// home_team / away_team son null en partidos placeholder (bracket sin equipos
// resueltos todavía).

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
  // Bracket fields (null for group-stage matches)
  bracket_id: string | null;
  home_source_match_id: string | null;
  away_source_match_id: string | null;
  home_source_result: 'winner' | 'loser' | null;
  away_source_result: 'winner' | 'loser' | null;
  home_source_position: '1st' | '2nd' | '3rd' | null;
  away_source_position: '1st' | '2nd' | '3rd' | null;
  home_source_groups: string | null;
  away_source_groups: string | null;
  // Joined team data — null when team not yet resolved
  home_team: { id: string; name: string; short_name: string | null } | null;
  away_team: { id: string; name: string; short_name: string | null } | null;
  // Computed helpers
  isPlaceholder: boolean;
}

// ─── Repository ───────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class MatchRepository {
  findByTournament(tournamentId: string) {
    return supabase
      .from('matches')
      .select(
        `
        *,
        home_team:teams!matches_home_team_id_fkey(id, name, short_name),
        away_team:teams!matches_away_team_id_fkey(id, name, short_name)
      `,
      )
      .eq('tournament_id', tournamentId)
      .order('match_date', { ascending: true });
  }

  create(dto: MatchDto) {
    const validated = matchSchema.parse(dto);
    return supabase
      .from('matches')
      .insert({
        ...validated,
        round: validated.round || null,
        match_date: new Date(validated.match_date).toISOString(),
        prediction_deadline: new Date(validated.prediction_deadline).toISOString(),
      })
      .select()
      .single();
  }

  update(id: string, dto: Partial<Omit<MatchDto, 'tournament_id'>>) {
    return supabase
      .from('matches')
      .update({
        ...dto,
        round: dto.round || null,
        ...(dto.match_date && { match_date: new Date(dto.match_date).toISOString() }),
        ...(dto.prediction_deadline && {
          prediction_deadline: new Date(dto.prediction_deadline).toISOString(),
        }),
      })
      .eq('id', id)
      .select()
      .single();
  }

  loadResult(id: string, dto: MatchResultDto) {
    const validated = matchResultSchema.parse(dto);
    return supabase
      .from('matches')
      .update({ ...validated, status: 'finished' })
      .eq('id', id)
      .select()
      .single();
  }

  remove(id: string) {
    return supabase.from('matches').delete().eq('id', id);
  }

  scoreMatch(matchId: string) {
    return supabase.functions.invoke('score-match', {
      body: { match_id: matchId },
    });
  }
}
