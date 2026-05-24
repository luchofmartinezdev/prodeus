import { Injectable } from '@angular/core';
import { supabase } from '../supabase.client';

@Injectable({ providedIn: 'root' })
export class ScoringRulesRepository {
  findAll(signal?: AbortSignal) {
    const query = supabase
      .from('scoring_rules')
      .select('*')
      .order('points_value', { ascending: false });
    return signal ? query.abortSignal(signal) : query;
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
