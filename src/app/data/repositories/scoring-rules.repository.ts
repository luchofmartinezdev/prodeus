import { Injectable } from '@angular/core';
import { supabase } from '../supabase.client';

@Injectable({ providedIn: 'root' })
export class ScoringRulesRepository {
  findAll() {
    return supabase.from('scoring_rules').select('*').order('points_value', { ascending: false });
  }

  update(id: string, pointsValue: number, description?: string) {
    return supabase
      .from('scoring_rules')
      .update({ points_value: pointsValue, ...(description !== undefined && { description }) })
      .eq('id', id)
      .select()
      .single();
  }
}
