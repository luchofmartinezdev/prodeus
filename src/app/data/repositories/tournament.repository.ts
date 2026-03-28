import { Injectable } from '@angular/core';
import { z } from 'zod';
import type { TablesInsert, TablesUpdate } from '../database.types';
import { supabase } from '../supabase.client';

// ─── Schemas ──────────────────────────────────────────────────

export const tournamentSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  description: z.string().optional(),
  logo_url: z.string().url('URL inválida').optional().or(z.literal('')).or(z.undefined()),
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
}
