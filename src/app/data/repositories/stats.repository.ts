import { Injectable } from '@angular/core';
import { supabase } from '../supabase.client';

@Injectable({ providedIn: 'root' })
export class StatsRepository {
  findActiveTournamentIds() {
    return supabase.from('tournaments').select('id').eq('status', 'active');
  }

  countGroupsByTournamentIds(ids: string[]) {
    if (ids.length === 0) {
      return supabase.from('groups').select('id', { count: 'exact', head: true }).eq('id', 'none');
    }
    return supabase
      .from('groups')
      .select('id', { count: 'exact', head: true })
      .in('tournament_id', ids);
  }

  countTotalGroups() {
    return supabase.from('groups').select('id', { count: 'exact', head: true });
  }

  countPredictions() {
    return supabase.from('predictions').select('id', { count: 'exact', head: true });
  }

  countActiveMembers() {
    return supabase
      .from('group_members')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active');
  }

  countRegisteredUsers() {
    return supabase.from('profiles').select('id', { count: 'exact', head: true });
  }

  countTournamentsByStatus(status: 'draft' | 'active' | 'closed') {
    return supabase
      .from('tournaments')
      .select('id', { count: 'exact', head: true })
      .eq('status', status);
  }
}
