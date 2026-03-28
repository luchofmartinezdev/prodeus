import { Injectable } from '@angular/core';
import type { TablesInsert } from '../database.types';
import { supabase } from '../supabase.client';

// ─── Types ────────────────────────────────────────────────────

export interface PredictionDto {
  group_id: string;
  user_id: string;
  match_id: string;
  predicted_home: number;
  predicted_away: number;
}

// ─── Repository ───────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class PredictionRepository {
  findByGroup(groupId: string, userId: string) {
    return supabase.from('predictions').select('*').eq('group_id', groupId).eq('user_id', userId);
  }

  upsert(dto: PredictionDto) {
    const insert: TablesInsert<'predictions'> = {
      group_id: dto.group_id,
      user_id: dto.user_id,
      match_id: dto.match_id,
      predicted_home: dto.predicted_home,
      predicted_away: dto.predicted_away,
    };
    return supabase
      .from('predictions')
      .upsert(insert, { onConflict: 'group_id,user_id,match_id' })
      .select()
      .single();
  }
}
