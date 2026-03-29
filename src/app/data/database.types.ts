export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: '14.4';
  };
  public: {
    Tables: {
      group_members: {
        Row: {
          group_id: string;
          id: string;
          joined_at: string | null;
          status: Database['public']['Enums']['member_status'];
          user_id: string;
        };
        Insert: {
          group_id: string;
          id?: string;
          joined_at?: string | null;
          status?: Database['public']['Enums']['member_status'];
          user_id: string;
        };
        Update: {
          group_id?: string;
          id?: string;
          joined_at?: string | null;
          status?: Database['public']['Enums']['member_status'];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'group_members_group_id_fkey';
            columns: ['group_id'];
            isOneToOne: false;
            referencedRelation: 'groups';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'group_members_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      groups: {
        Row: {
          created_at: string;
          id: string;
          invite_code: string;
          join_mode: Database['public']['Enums']['join_mode'];
          leader_id: string;
          name: string;
          tournament_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          invite_code?: string;
          join_mode?: Database['public']['Enums']['join_mode'];
          leader_id: string;
          name: string;
          tournament_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          invite_code?: string;
          join_mode?: Database['public']['Enums']['join_mode'];
          leader_id?: string;
          name?: string;
          tournament_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'groups_leader_id_fkey';
            columns: ['leader_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'groups_tournament_id_fkey';
            columns: ['tournament_id'];
            isOneToOne: false;
            referencedRelation: 'tournaments';
            referencedColumns: ['id'];
          },
        ];
      };
      group_standings: {
        Row: {
          calculated_at: string;
          drawn: number;
          goal_difference: number;
          goals_against: number;
          goals_for: number;
          group_name: string;
          id: string;
          lost: number;
          played: number;
          points: number;
          position: number;
          team_id: string;
          tournament_id: string;
          won: number;
        };
        Insert: {
          calculated_at?: string;
          drawn?: number;
          goals_against?: number;
          goals_for?: number;
          group_name: string;
          id?: string;
          lost?: number;
          played?: number;
          points?: number;
          position: number;
          team_id: string;
          tournament_id: string;
          won?: number;
        };
        Update: {
          calculated_at?: string;
          drawn?: number;
          goals_against?: number;
          goals_for?: number;
          group_name?: string;
          id?: string;
          lost?: number;
          played?: number;
          points?: number;
          position?: number;
          team_id?: string;
          tournament_id?: string;
          won?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'group_standings_team_id_fkey';
            columns: ['team_id'];
            isOneToOne: false;
            referencedRelation: 'teams';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'group_standings_tournament_id_fkey';
            columns: ['tournament_id'];
            isOneToOne: false;
            referencedRelation: 'tournaments';
            referencedColumns: ['id'];
          },
        ];
      };
      matches: {
        Row: {
          away_score: number | null;
          away_source_groups: string | null;
          away_source_match_id: string | null;
          away_source_position: '1st' | '2nd' | '3rd' | null;
          away_source_result: 'winner' | 'loser' | null;
          away_team_id: string | null;
          bracket_id: string | null;
          home_score: number | null;
          home_source_groups: string | null;
          home_source_match_id: string | null;
          home_source_position: '1st' | '2nd' | '3rd' | null;
          home_source_result: 'winner' | 'loser' | null;
          home_team_id: string | null;
          id: string;
          match_date: string;
          prediction_deadline: string;
          qualifier_team_id: string | null;
          requires_tiebreak: boolean;
          round: string | null;
          status: Database['public']['Enums']['match_status'];
          tiebreak_method: 'extra_time' | 'penalties' | null;
          tournament_id: string;
        };
        Insert: {
          away_score?: number | null;
          away_source_groups?: string | null;
          away_source_match_id?: string | null;
          away_source_position?: '1st' | '2nd' | '3rd' | null;
          away_source_result?: 'winner' | 'loser' | null;
          away_team_id?: string | null;
          bracket_id?: string | null;
          home_score?: number | null;
          home_source_groups?: string | null;
          home_source_match_id?: string | null;
          home_source_position?: '1st' | '2nd' | '3rd' | null;
          home_source_result?: 'winner' | 'loser' | null;
          home_team_id?: string | null;
          id?: string;
          match_date: string;
          prediction_deadline: string;
          qualifier_team_id?: string | null;
          requires_tiebreak?: boolean;
          round?: string | null;
          status?: Database['public']['Enums']['match_status'];
          tiebreak_method?: 'extra_time' | 'penalties' | null;
          tournament_id: string;
        };
        Update: {
          away_score?: number | null;
          away_source_groups?: string | null;
          away_source_match_id?: string | null;
          away_source_position?: '1st' | '2nd' | '3rd' | null;
          away_source_result?: 'winner' | 'loser' | null;
          away_team_id?: string | null;
          bracket_id?: string | null;
          home_score?: number | null;
          home_source_groups?: string | null;
          home_source_match_id?: string | null;
          home_source_position?: '1st' | '2nd' | '3rd' | null;
          home_source_result?: 'winner' | 'loser' | null;
          home_team_id?: string | null;
          id?: string;
          match_date?: string;
          prediction_deadline?: string;
          qualifier_team_id?: string | null;
          requires_tiebreak?: boolean;
          round?: string | null;
          status?: Database['public']['Enums']['match_status'];
          tiebreak_method?: 'extra_time' | 'penalties' | null;
          tournament_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'matches_away_team_id_fkey';
            columns: ['away_team_id'];
            isOneToOne: false;
            referencedRelation: 'teams';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'matches_home_team_id_fkey';
            columns: ['home_team_id'];
            isOneToOne: false;
            referencedRelation: 'teams';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'matches_tournament_id_fkey';
            columns: ['tournament_id'];
            isOneToOne: false;
            referencedRelation: 'tournaments';
            referencedColumns: ['id'];
          },
        ];
      };
      predictions: {
        Row: {
          group_id: string;
          id: string;
          last_edited_at: string | null;
          match_id: string;
          points_earned: number | null;
          predicted_away: number;
          predicted_home: number;
          predicted_qualifier_team_id: string | null;
          submitted_at: string;
          user_id: string;
        };
        Insert: {
          group_id: string;
          id?: string;
          last_edited_at?: string | null;
          match_id: string;
          points_earned?: number | null;
          predicted_away: number;
          predicted_home: number;
          predicted_qualifier_team_id?: string | null;
          submitted_at?: string;
          user_id: string;
        };
        Update: {
          group_id?: string;
          id?: string;
          last_edited_at?: string | null;
          match_id?: string;
          points_earned?: number | null;
          predicted_away?: number;
          predicted_home?: number;
          predicted_qualifier_team_id?: string | null;
          submitted_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'predictions_group_id_fkey';
            columns: ['group_id'];
            isOneToOne: false;
            referencedRelation: 'groups';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'predictions_match_id_fkey';
            columns: ['match_id'];
            isOneToOne: false;
            referencedRelation: 'matches';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'predictions_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      prodes: {
        Row: {
          created_at: string;
          final_position: number | null;
          group_id: string;
          id: string;
          total_points: number;
          tournament_id: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          final_position?: number | null;
          group_id: string;
          id?: string;
          total_points?: number;
          tournament_id: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          final_position?: number | null;
          group_id?: string;
          id?: string;
          total_points?: number;
          tournament_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'prodes_group_id_fkey';
            columns: ['group_id'];
            isOneToOne: false;
            referencedRelation: 'groups';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'prodes_tournament_id_fkey';
            columns: ['tournament_id'];
            isOneToOne: false;
            referencedRelation: 'tournaments';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'prodes_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          id: string;
          role: Database['public']['Enums']['user_role'];
          username: string;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          id: string;
          role?: Database['public']['Enums']['user_role'];
          username: string;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          id?: string;
          role?: Database['public']['Enums']['user_role'];
          username?: string;
        };
        Relationships: [];
      };
      scores: {
        Row: {
          group_id: string;
          id: string;
          last_calculated_at: string;
          total_points: number;
          tournament_id: string;
          user_id: string;
        };
        Insert: {
          group_id: string;
          id?: string;
          last_calculated_at?: string;
          total_points?: number;
          tournament_id: string;
          user_id: string;
        };
        Update: {
          group_id?: string;
          id?: string;
          last_calculated_at?: string;
          total_points?: number;
          tournament_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'scores_group_id_fkey';
            columns: ['group_id'];
            isOneToOne: false;
            referencedRelation: 'groups';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'scores_tournament_id_fkey';
            columns: ['tournament_id'];
            isOneToOne: false;
            referencedRelation: 'tournaments';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'scores_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      scoring_rules: {
        Row: {
          description: string | null;
          id: string;
          points_value: number;
          rule_key: Database['public']['Enums']['scoring_rule_key'];
          tournament_id: string;
        };
        Insert: {
          description?: string | null;
          id?: string;
          points_value: number;
          rule_key: Database['public']['Enums']['scoring_rule_key'];
          tournament_id: string;
        };
        Update: {
          description?: string | null;
          id?: string;
          points_value?: number;
          rule_key?: Database['public']['Enums']['scoring_rule_key'];
          tournament_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'scoring_rules_tournament_id_fkey';
            columns: ['tournament_id'];
            isOneToOne: false;
            referencedRelation: 'tournaments';
            referencedColumns: ['id'];
          },
        ];
      };
      teams: {
        Row: {
          id: string;
          logo_url: string | null;
          name: string;
          short_name: string | null;
          tournament_id: string;
        };
        Insert: {
          id?: string;
          logo_url?: string | null;
          name: string;
          short_name?: string | null;
          tournament_id: string;
        };
        Update: {
          id?: string;
          logo_url?: string | null;
          name?: string;
          short_name?: string | null;
          tournament_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'teams_tournament_id_fkey';
            columns: ['tournament_id'];
            isOneToOne: false;
            referencedRelation: 'tournaments';
            referencedColumns: ['id'];
          },
        ];
      };
      third_place_lookup: {
        Row: {
          bracket_slot: string;
          groups_key: string;
          id: string;
          source_group: string;
          source_side: 'home' | 'away';
        };
        Insert: {
          bracket_slot: string;
          groups_key: string;
          id?: string;
          source_group: string;
          source_side: 'home' | 'away';
        };
        Update: {
          bracket_slot?: string;
          groups_key?: string;
          id?: string;
          source_group?: string;
          source_side?: 'home' | 'away';
        };
        Relationships: [];
      };
      tournaments: {
        Row: {
          created_at: string;
          description: string | null;
          end_date: string;
          id: string;
          logo_url: string | null;
          name: string;
          start_date: string;
          status: Database['public']['Enums']['tournament_status'];
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          end_date: string;
          id?: string;
          logo_url?: string | null;
          name: string;
          start_date: string;
          status?: Database['public']['Enums']['tournament_status'];
        };
        Update: {
          created_at?: string;
          description?: string | null;
          end_date?: string;
          id?: string;
          logo_url?: string | null;
          name?: string;
          start_date?: string;
          status?: Database['public']['Enums']['tournament_status'];
        };
        Relationships: [];
      };
    };
    Views: {
      group_ranking: {
        Row: {
          avatar_url: string | null;
          group_id: string | null;
          last_calculated_at: string | null;
          position: number | null;
          total_points: number | null;
          tournament_id: string | null;
          user_id: string | null;
          username: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'scores_group_id_fkey';
            columns: ['group_id'];
            isOneToOne: false;
            referencedRelation: 'groups';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'scores_tournament_id_fkey';
            columns: ['tournament_id'];
            isOneToOne: false;
            referencedRelation: 'tournaments';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'scores_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Functions: {
      create_default_scoring_rules: {
        Args: { p_tournament_id: string };
        Returns: undefined;
      };
      is_superadmin: { Args: never; Returns: boolean };
    };
    Enums: {
      join_mode: 'open' | 'closed';
      match_status: 'scheduled' | 'in_progress' | 'finished';
      member_status: 'pending' | 'active' | 'removed';
      scoring_rule_key: 'exact_score' | 'correct_winner' | 'correct_goals_only' | 'no_match';
      tournament_status: 'draft' | 'active' | 'closed';
      user_role: 'user' | 'superadmin';
    };
    CompositeTypes: Record<never, never>;
  };
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema['Enums']
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      join_mode: ['open', 'closed'],
      match_status: ['scheduled', 'in_progress', 'finished'],
      member_status: ['pending', 'active', 'removed'],
      scoring_rule_key: ['exact_score', 'correct_winner', 'correct_goals_only', 'no_match'],
      tournament_status: ['draft', 'active', 'closed'],
      user_role: ['user', 'superadmin'],
    },
  },
} as const;

// ─── Tipos de dominio (shortcuts usando los helpers generados) ─

export type Profile = Tables<'profiles'>;
export type Tournament = Tables<'tournaments'>;
export type Team = Tables<'teams'>;
export type Match = Tables<'matches'>;
export type ScoringRule = Tables<'scoring_rules'>;
export type Group = Tables<'groups'>;
export type GroupMember = Tables<'group_members'>;
export type Prode = Tables<'prodes'>;
export type Prediction = Tables<'predictions'>;
export type Score = Tables<'scores'>;
export type GroupRanking = Tables<'group_ranking'>;
export type GroupStanding = Tables<'group_standings'>;
export type ThirdPlaceLookup = Tables<'third_place_lookup'>;

// ─── Tipos de fase eliminatoria ───────────────────────────────

export type MatchPhase = 'GROUP' | 'R16' | 'R8' | 'QF' | 'SF' | 'FINAL' | 'THIRD';
export type SourceResult = 'winner' | 'loser';
export type SourcePosition = '1st' | '2nd' | '3rd';

export interface PhaseStatus {
  currentPhase: 'GROUP' | 'R16' | 'R8' | 'QF' | 'SF' | 'FINAL';
  currentPhaseComplete: boolean;
  nextPhase: 'R16' | 'R8' | 'QF' | 'SF' | 'FINAL' | null;
  pendingMatches: number;
  pendingBracketIds: string[];
}

export interface GeneratePhaseResult {
  success: boolean;
  resolved: number;
  pending: string[];
  errors: string[];
}
