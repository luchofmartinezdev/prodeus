import { Injectable } from '@angular/core';
import { supabase } from '../supabase.client';

export interface RankingRow {
  userId: string;
  username: string;
  avatarUrl: string | null;
  totalPoints: number;
  position: number;
}

export interface HistorialRow {
  predictionId: string;
  matchDate: string;
  round: string | null;
  homeTeam: string;
  awayTeam: string;
  actualHome: number | null;
  actualAway: number | null;
  predictedHome: number;
  predictedAway: number;
  pointsEarned: number | null;
  matchStatus: 'scheduled' | 'in_progress' | 'finished';
}

@Injectable({ providedIn: 'root' })
export class RankingRepository {
  /** Scores for all members of a group, sorted by total_points DESC */
  async getGroupRanking(groupId: string): Promise<RankingRow[]> {
    const { data, error } = await supabase
      .from('scores')
      .select(
        `
        user_id,
        total_points,
        profile:profiles!scores_user_id_fkey(username, avatar_url)
      `,
      )
      .eq('group_id', groupId)
      .order('total_points', { ascending: false });

    if (error) throw new Error('No se pudo cargar el ranking');

    return (data ?? []).map((row, i) => ({
      userId: row.user_id,
      username:
        (row.profile as { username: string; avatar_url: string | null } | null)?.username ?? '—',
      avatarUrl:
        (row.profile as { username: string; avatar_url: string | null } | null)?.avatar_url ?? null,
      totalPoints: row.total_points,
      position: i + 1,
    }));
  }

  /** Prediction history for one user in one group, newest match first */
  async getUserHistory(userId: string, groupId: string): Promise<HistorialRow[]> {
    const { data, error } = await supabase
      .from('predictions')
      .select(
        `
        id,
        predicted_home,
        predicted_away,
        points_earned,
        match:matches!predictions_match_id_fkey(
          match_date,
          round,
          status,
          home_score,
          away_score,
          home_team:teams!matches_home_team_id_fkey(name, short_name),
          away_team:teams!matches_away_team_id_fkey(name, short_name)
        )
      `,
      )
      .eq('user_id', userId)
      .eq('group_id', groupId)
      .order('submitted_at', { ascending: false });

    if (error) throw new Error('No se pudo cargar el historial');

    interface MatchRow {
      match_date: string;
      round: string | null;
      status: 'scheduled' | 'in_progress' | 'finished';
      home_score: number | null;
      away_score: number | null;
      home_team: { name: string; short_name: string | null } | null;
      away_team: { name: string; short_name: string | null } | null;
    }

    return (data ?? []).map((row) => {
      const m = row.match as unknown as MatchRow | null;
      return {
        predictionId: row.id,
        matchDate: m?.match_date ?? '',
        round: m?.round ?? null,
        homeTeam: m?.home_team?.name ?? '?',
        awayTeam: m?.away_team?.name ?? '?',
        actualHome: m?.home_score ?? null,
        actualAway: m?.away_score ?? null,
        predictedHome: row.predicted_home,
        predictedAway: row.predicted_away,
        pointsEarned: row.points_earned ?? null,
        matchStatus: m?.status ?? 'scheduled',
      };
    });
  }
}
