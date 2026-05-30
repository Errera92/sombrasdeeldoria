export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      missions: {
        Row: {
          category: string
          condition_type: string
          condition_value: number
          created_at: string
          description: string
          gems_reward: number
          icon: string
          id: string
          repeatable: boolean
          sort_order: number
          title: string
        }
        Insert: {
          category: string
          condition_type: string
          condition_value?: number
          created_at?: string
          description: string
          gems_reward?: number
          icon?: string
          id: string
          repeatable?: boolean
          sort_order?: number
          title: string
        }
        Update: {
          category?: string
          condition_type?: string
          condition_value?: number
          created_at?: string
          description?: string
          gems_reward?: number
          icon?: string
          id?: string
          repeatable?: boolean
          sort_order?: number
          title?: string
        }
        Relationships: []
      }
      player_missions: {
        Row: {
          completed_at: string | null
          mission_id: string
          player_id: string
          progress: number
          times_completed: number
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          mission_id: string
          player_id: string
          progress?: number
          times_completed?: number
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          mission_id?: string
          player_id?: string
          progress?: number
          times_completed?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_missions_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
        ]
      }
      player_upgrades: {
        Row: {
          created_at: string
          id: string
          level: number
          player_id: string
          updated_at: string
          upgrade_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          level?: number
          player_id: string
          updated_at?: string
          upgrade_id: string
        }
        Update: {
          created_at?: string
          id?: string
          level?: number
          player_id?: string
          updated_at?: string
          upgrade_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          gems: number
          high_score: number
          id: string
          nickname: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          gems?: number
          high_score?: number
          id: string
          nickname: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          gems?: number
          high_score?: number
          id?: string
          nickname?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_my_rank: {
        Args: never
        Returns: {
          high_score: number
          nickname: string
          rank: number
        }[]
      }
      get_player_missions: {
        Args: never
        Returns: {
          category: string
          completed_at: string
          condition_value: number
          description: string
          gems_reward: number
          icon: string
          id: string
          progress: number
          repeatable: boolean
          times_completed: number
          title: string
        }[]
      }
      get_top_rankings: {
        Args: { limit_count?: number }
        Returns: {
          high_score: number
          id: string
          nickname: string
        }[]
      }
      process_game_result: {
        Args: { p_gold: number; p_victory: boolean; p_wave: number }
        Returns: {
          earned: number
          gems: number
          high_score: number
          score: number
        }[]
      }
      process_phase_result: {
        Args: {
          p_all_phases_no_damage: boolean
          p_enemies_killed: number
          p_gold: number
          p_gold_spent: number
          p_phase_index: number
          p_phase_seconds: number
          p_stage_complete: boolean
          p_stage_id: number
          p_took_damage: boolean
          p_towers_used: number
          p_used_upgrade: boolean
          p_victory: boolean
          p_wave: number
        }
        Returns: {
          earned: number
          gems: number
          high_score: number
          missions_earned: Json
          score: number
        }[]
      }
      process_upgrade_purchase: {
        Args: { p_cost: number; p_max_level: number; p_upgrade_id: string }
        Returns: {
          gems: number
          level: number
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
