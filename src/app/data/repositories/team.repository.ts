import { Injectable } from '@angular/core';
import { z } from 'zod';
import { supabase } from '../supabase.client';

// ─── Schemas ──────────────────────────────────────────────────

export const teamSchema = z.object({
  tournament_id: z.string().uuid(),
  name: z.string().min(1, 'El nombre es requerido'),
  short_name: z.string().max(5, 'Máximo 5 caracteres').optional().or(z.literal('')),
  logo_url: z.string().url('URL inválida').optional().or(z.literal('')).or(z.undefined()),
});

export type TeamDto = z.infer<typeof teamSchema>;

// ─── Repository ───────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class TeamRepository {
  findByTournament(tournamentId: string) {
    return supabase
      .from('teams')
      .select('*')
      .eq('tournament_id', tournamentId)
      .order('name', { ascending: true });
  }

  create(dto: TeamDto) {
    const validated = teamSchema.parse(dto);
    return supabase
      .from('teams')
      .insert({
        ...validated,
        logo_url: validated.logo_url || null,
        short_name: validated.short_name || null,
      })
      .select()
      .single();
  }

  update(id: string, dto: Partial<Omit<TeamDto, 'tournament_id'>>) {
    return supabase
      .from('teams')
      .update({ ...dto, logo_url: dto.logo_url || null, short_name: dto.short_name || null })
      .eq('id', id)
      .select()
      .single();
  }

  remove(id: string) {
    return supabase.from('teams').delete().eq('id', id);
  }
}
