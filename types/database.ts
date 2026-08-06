export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          created_at: string
          full_name: string | null
          phone: string | null
          membership_tier: 'casual' | 'club' | 'pro'
          credits: number
          role: 'member' | 'staff' | 'admin'
          avatar_url: string | null
          wins: number
          losses: number
          ranking_points: number
          favourite_court: string | null
          bio: string | null
          skill_level: string | null
          member_number: number | null
          nickname: string | null
          skill_rating: number | null
          email: string | null
        }
        Insert: {
          id: string
          created_at?: string
          full_name?: string | null
          phone?: string | null
          membership_tier?: 'casual' | 'club' | 'pro'
          credits?: number
          role?: 'member' | 'staff' | 'admin'
          avatar_url?: string | null
          wins?: number
          losses?: number
          ranking_points?: number
          favourite_court?: string | null
          bio?: string | null
          skill_level?: string | null
          member_number?: number | null
          nickname?: string | null
          skill_rating?: number | null
          email?: string | null
        }
        Update: {
          id?: string
          created_at?: string
          full_name?: string | null
          phone?: string | null
          membership_tier?: 'casual' | 'club' | 'pro'
          credits?: number
          role?: 'member' | 'staff' | 'admin'
          avatar_url?: string | null
          wins?: number
          losses?: number
          ranking_points?: number
          favourite_court?: string | null
          bio?: string | null
          skill_level?: string | null
          member_number?: number | null
          nickname?: string | null
          skill_rating?: number | null
          email?: string | null
        }
        Relationships: []
      }
      courts: {
        Row: {
          id: string
          created_at: string
          name: string
          type: string
          sport: string
          surface: string | null
          is_indoor: boolean
          price_per_hour: number
          is_active: boolean
          description: string | null
          price_per_hour_peak: number | null
          venue_slug: string | null
        }
        Insert: {
          id?: string
          created_at?: string
          name: string
          type: string
          sport?: string
          surface?: string | null
          is_indoor?: boolean
          price_per_hour: number
          is_active?: boolean
          description?: string | null
          price_per_hour_peak?: number | null
          venue_slug?: string | null
        }
        Update: {
          id?: string
          created_at?: string
          name?: string
          type?: string
          sport?: string
          surface?: string | null
          is_indoor?: boolean
          price_per_hour?: number
          is_active?: boolean
          description?: string | null
          price_per_hour_peak?: number | null
          venue_slug?: string | null
        }
        Relationships: []
      }
      bookings: {
        Row: {
          id: string
          created_at: string
          user_id: string | null
          court_id: string
          date: string
          start_time: string
          end_time: string
          duration_minutes: number
          status: 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'blocked'
          price_nzd: number
          discount_applied: number
          payment_method: 'card' | 'credits' | 'membership_allowance' | 'staff_block'
          notes: string | null
          stripe_payment_id: string | null
        }
        Insert: {
          id?: string
          created_at?: string
          user_id?: string | null
          court_id: string
          date: string
          start_time: string
          end_time: string
          duration_minutes?: number
          status?: 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'blocked'
          price_nzd?: number
          discount_applied?: number
          payment_method?: 'card' | 'credits' | 'membership_allowance' | 'staff_block'
          notes?: string | null
          stripe_payment_id?: string | null
        }
        Update: {
          id?: string
          created_at?: string
          user_id?: string | null
          court_id?: string
          date?: string
          start_time?: string
          end_time?: string
          duration_minutes?: number
          status?: 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'blocked'
          price_nzd?: number
          discount_applied?: number
          payment_method?: 'card' | 'credits' | 'membership_allowance' | 'staff_block'
          notes?: string | null
          stripe_payment_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bookings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_court_id_fkey"
            columns: ["court_id"]
            isOneToOne: false
            referencedRelation: "courts"
            referencedColumns: ["id"]
          },
        ]
      }
      membership_subscriptions: {
        Row: {
          id: string
          created_at: string
          user_id: string
          tier: 'club' | 'pro'
          status: 'active' | 'cancelled' | 'past_due'
          started_at: string
          ends_at: string | null
          monthly_allowance_used: number
          monthly_allowance_reset_at: string
        }
        Insert: {
          id?: string
          created_at?: string
          user_id: string
          tier: 'club' | 'pro'
          status?: 'active' | 'cancelled' | 'past_due'
          started_at?: string
          ends_at?: string | null
          monthly_allowance_used?: number
          monthly_allowance_reset_at?: string
        }
        Update: {
          id?: string
          created_at?: string
          user_id?: string
          tier?: 'club' | 'pro'
          status?: 'active' | 'cancelled' | 'past_due'
          started_at?: string
          ends_at?: string | null
          monthly_allowance_used?: number
          monthly_allowance_reset_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "membership_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_transactions: {
        Row: {
          id: string
          created_at: string
          user_id: string
          amount: number
          type: 'purchase' | 'used' | 'refund' | 'membership_grant'
          booking_id: string | null
          description: string | null
          stripe_session_id: string | null
        }
        Insert: {
          id?: string
          created_at?: string
          user_id: string
          amount: number
          type: 'purchase' | 'used' | 'refund' | 'membership_grant'
          booking_id?: string | null
          description?: string | null
          stripe_session_id?: string | null
        }
        Update: {
          id?: string
          created_at?: string
          user_id?: string
          amount?: number
          type?: 'purchase' | 'used' | 'refund' | 'membership_grant'
          booking_id?: string | null
          description?: string | null
          stripe_session_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "credit_transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_transactions_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          id: string
          user_id: string | null
          type: string
          message: string
          read: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          type: string
          message: string
          read?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          type?: string
          message?: string
          read?: boolean
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_splits: {
        Row: {
          id: string
          booking_id: string | null
          invited_by: string | null
          user_id: string | null
          amount_nzd: number
          status: string
          created_at: string
          stripe_payment_id: string | null
        }
        Insert: {
          id?: string
          booking_id?: string | null
          invited_by?: string | null
          user_id?: string | null
          amount_nzd: number
          status?: string
          created_at?: string
          stripe_payment_id?: string | null
        }
        Update: {
          id?: string
          booking_id?: string | null
          invited_by?: string | null
          user_id?: string | null
          amount_nzd?: number
          status?: string
          created_at?: string
          stripe_payment_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "booking_splits_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_splits_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_splits_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      open_matches: {
        Row: {
          id: string
          booking_id: string | null
          organizer_id: string | null
          venue_slug: string
          court_id: string | null
          date: string
          start_time: string
          end_time: string
          visibility: 'public' | 'private'
          match_type: 'casual' | 'competitive'
          skill_min: number | null
          skill_max: number | null
          spots_total: number
          status: 'open' | 'full' | 'completed' | 'cancelled'
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          booking_id?: string | null
          organizer_id?: string | null
          venue_slug: string
          court_id?: string | null
          date: string
          start_time: string
          end_time: string
          visibility?: 'public' | 'private'
          match_type?: 'casual' | 'competitive'
          skill_min?: number | null
          skill_max?: number | null
          spots_total?: number
          status?: 'open' | 'full' | 'completed' | 'cancelled'
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          booking_id?: string | null
          organizer_id?: string | null
          venue_slug?: string
          court_id?: string | null
          date?: string
          start_time?: string
          end_time?: string
          visibility?: 'public' | 'private'
          match_type?: 'casual' | 'competitive'
          skill_min?: number | null
          skill_max?: number | null
          spots_total?: number
          status?: 'open' | 'full' | 'completed' | 'cancelled'
          notes?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "open_matches_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "open_matches_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "open_matches_court_id_fkey"
            columns: ["court_id"]
            isOneToOne: false
            referencedRelation: "courts"
            referencedColumns: ["id"]
          },
        ]
      }
      open_match_players: {
        Row: {
          id: string
          match_id: string | null
          player_id: string | null
          joined_at: string
          status: 'pending' | 'accepted' | 'declined'
        }
        Insert: {
          id?: string
          match_id?: string | null
          player_id?: string | null
          joined_at?: string
          status?: 'pending' | 'accepted' | 'declined'
        }
        Update: {
          id?: string
          match_id?: string | null
          player_id?: string | null
          joined_at?: string
          status?: 'pending' | 'accepted' | 'declined'
        }
        Relationships: [
          {
            foreignKeyName: "open_match_players_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "open_matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "open_match_players_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      matches: {
        Row: {
          id: string
          created_at: string
          booking_id: string | null
          player1_id: string
          player2_id: string
          winner_id: string | null
          score: string | null
          notes: string | null
          team1_player1_id: string | null
          team1_player2_id: string | null
          team2_player1_id: string | null
          team2_player2_id: string | null
          team1_sets: number | null
          team2_sets: number | null
          winner_team: number | null
          venue_slug: string | null
          played_at: string | null
          recorded_by: string | null
          idempotency_key: string | null
        }
        Insert: {
          id?: string
          created_at?: string
          booking_id?: string | null
          player1_id: string
          player2_id: string
          winner_id?: string | null
          score?: string | null
          notes?: string | null
          team1_player1_id?: string | null
          team1_player2_id?: string | null
          team2_player1_id?: string | null
          team2_player2_id?: string | null
          team1_sets?: number | null
          team2_sets?: number | null
          winner_team?: number | null
          venue_slug?: string | null
          played_at?: string | null
          recorded_by?: string | null
          idempotency_key?: string | null
        }
        Update: {
          id?: string
          created_at?: string
          booking_id?: string | null
          player1_id?: string
          player2_id?: string
          winner_id?: string | null
          score?: string | null
          notes?: string | null
          team1_player1_id?: string | null
          team1_player2_id?: string | null
          team2_player1_id?: string | null
          team2_player2_id?: string | null
          team1_sets?: number | null
          team2_sets?: number | null
          winner_team?: number | null
          venue_slug?: string | null
          played_at?: string | null
          recorded_by?: string | null
          idempotency_key?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "matches_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_player1_id_fkey"
            columns: ["player1_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_player2_id_fkey"
            columns: ["player2_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_winner_id_fkey"
            columns: ["winner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_team1_player1_id_fkey"
            columns: ["team1_player1_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_team1_player2_id_fkey"
            columns: ["team1_player2_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_team2_player1_id_fkey"
            columns: ["team2_player1_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_team2_player2_id_fkey"
            columns: ["team2_player2_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      increment_credits: {
        Args: { p_user_id: string; p_amount: number }
        Returns: undefined
      }
      record_match_result: {
        Args: { p_user_id: string; p_win: boolean; p_points: number }
        Returns: undefined
      }
      accept_match_player: {
        Args: { p_request_id: string }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
    }
  }
}

export type Profile = Database['public']['Tables']['profiles']['Row']
export type Court = Database['public']['Tables']['courts']['Row']
export type Booking = Database['public']['Tables']['bookings']['Row']
export type MembershipSubscription = Database['public']['Tables']['membership_subscriptions']['Row']
export type CreditTransaction = Database['public']['Tables']['credit_transactions']['Row']
export type Notification = Database['public']['Tables']['notifications']['Row']
export type BookingSplit = Database['public']['Tables']['booking_splits']['Row']
export type OpenMatch = Database['public']['Tables']['open_matches']['Row']
export type OpenMatchPlayer = Database['public']['Tables']['open_match_players']['Row']
export type Match = Database['public']['Tables']['matches']['Row']

export type MembershipTier = 'casual' | 'club' | 'pro'

export interface MembershipConfig {
  id: MembershipTier
  name: string
  priceNzd: number
  period: string
  discount: number
  bookingWindowDays: number
  monthlyFreeSessionsNzd: number
  features: string[]
  featured?: boolean
}

export const MEMBERSHIP_CONFIG: Record<MembershipTier, MembershipConfig> = {
  casual: {
    id: 'casual',
    name: 'Casual',
    priceNzd: 0,
    period: 'free',
    discount: 0,
    bookingWindowDays: 14,
    monthlyFreeSessionsNzd: 0,
    features: [
      'Book courts at full rate',
      'Book up to 3 days ahead',
      'Standard support',
    ],
  },
  club: {
    id: 'club',
    name: 'Club',
    priceNzd: 49,
    period: '/month',
    discount: 0.15,
    bookingWindowDays: 21,
    monthlyFreeSessionsNzd: 50,
    features: [
      '15% discount on all bookings',
      'Book up to 5 days ahead',
      '$50 monthly credit allowance',
      'Guest passes available',
    ],
    featured: true,
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    priceNzd: 99,
    period: '/month',
    discount: 0.25,
    bookingWindowDays: 28,
    monthlyFreeSessionsNzd: 120,
    features: [
      '25% discount on all bookings',
      'Book up to 7 days ahead',
      '$120 monthly credit allowance',
      'Priority court access',
      'Bring a guest free',
    ],
  },
}
