import { Injectable } from '@angular/core';
import { z } from 'zod';
import type {
  GeneratePhaseResult,
  GroupStanding,
  TablesInsert,
  TablesUpdate,
} from '../database.types';
import { supabase } from '../supabase.client';

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

// ─── Repository ───────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class TournamentRepository {
  findAll() {
    return supabase.from('tournaments').select('*').order('created_at', { ascending: false });
  }

  findOne(id: string) {
    return supabase.from('tournaments').select('*').eq('id', id).single();
  }

  create(dto: TournamentDto) {
    const validated = tournamentSchema.parse(dto);
    const insert: TablesInsert<'tournaments'> = {
      ...validated,
      logo_url: validated.logo_url || null,
    };
    return supabase.from('tournaments').insert(insert).select().single();
  }

  update(id: string, dto: Partial<TournamentDto>) {
    const update: TablesUpdate<'tournaments'> = { ...dto, logo_url: dto.logo_url || null };
    return supabase.from('tournaments').update(update).eq('id', id).select().single();
  }

  changeStatus(id: string, status: 'draft' | 'active' | 'closed') {
    return supabase.from('tournaments').update({ status }).eq('id', id).select().single();
  }

  remove(id: string) {
    return supabase.from('tournaments').delete().eq('id', id);
  }

  createDefaultRules(tournamentId: string) {
    return supabase.rpc('create_default_scoring_rules', { p_tournament_id: tournamentId });
  }

  // ─── Playoff methods ─────────────────────────────────────────

  /** Lee todos los partidos del torneo con sus bracket_id y equipos resueltos */
  findMatchesForPhaseStatus(tournamentId: string) {
    return supabase
      .from('matches')
      .select('id, bracket_id, status, home_team_id, away_team_id')
      .eq('tournament_id', tournamentId)
      .order('match_date', { ascending: true });
  }

  /** Retorna las posiciones de grupos calculadas */
  async getGroupStandings(tournamentId: string): Promise<GroupStanding[]> {
    const { data, error } = await supabase
      .from('group_standings')
      .select('*')
      .eq('tournament_id', tournamentId)
      .order('group_name')
      .order('position');
    if (error) throw new Error('No se pudieron cargar las posiciones');
    return (data ?? []) as GroupStanding[];
  }

  /** Invoca la Edge Function generate-next-phase */
  async invokeGenerateNextPhase(tournamentId: string, phase: string): Promise<GeneratePhaseResult> {
    const { data, error } = await supabase.functions.invoke<GeneratePhaseResult>(
      'generate-next-phase',
      { body: { tournament_id: tournamentId, phase } },
    );
    if (error) throw new Error(error.message ?? 'Error al invocar generate-next-phase');
    if (!data) throw new Error('Respuesta vacía de generate-next-phase');
    return data;
  }

  /** Invoca la Edge Function calculate-group-standings */
  invokeCalculateGroupStandings(tournamentId: string) {
    return supabase.functions.invoke('calculate-group-standings', {
      body: { tournament_id: tournamentId },
    });
  }
}
