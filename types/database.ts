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
        }
        Insert: {
          id: string
          full_name?: string | null
          phone?: string | null
          membership_tier?: 'casual' | 'club' | 'pro'
          credits?: number
          role?: 'member' | 'staff' | 'admin'
          avatar_url?: string | null
        }
        Update: {
          full_name?: string | null
          phone?: string | null
          membership_tier?: 'casual' | 'club' | 'pro'
          credits?: number
          role?: 'member' | 'staff' | 'admin'
          avatar_url?: string | null
        }
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
        }
        Insert: {
          name: string
          type: string
          sport?: string
          surface?: string | null
          is_indoor?: boolean
          price_per_hour: number
          is_active?: boolean
          description?: string | null
        }
        Update: {
          name?: string
          type?: string
          sport?: string
          surface?: string | null
          is_indoor?: boolean
          price_per_hour?: number
          is_active?: boolean
          description?: string | null
        }
      }
      bookings: {
        Row: {
          id: string
          created_at: string
          user_id: string
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
        }
        Insert: {
          user_id: string
          court_id: string
          date: string
          start_time: string
          end_time: string
          duration_minutes?: number
          status?: 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'blocked'
          price_nzd: number
          discount_applied?: number
          payment_method?: 'card' | 'credits' | 'membership_allowance' | 'staff_block'
          notes?: string | null
        }
        Update: {
          status?: 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'blocked'
          notes?: string | null
        }
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
          user_id: string
          tier: 'club' | 'pro'
          status?: 'active' | 'cancelled' | 'past_due'
          started_at?: string
          ends_at?: string | null
          monthly_allowance_used?: number
          monthly_allowance_reset_at?: string
        }
        Update: {
          status?: 'active' | 'cancelled' | 'past_due'
          ends_at?: string | null
          monthly_allowance_used?: number
          monthly_allowance_reset_at?: string
        }
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
        }
        Insert: {
          user_id: string
          amount: number
          type: 'purchase' | 'used' | 'refund' | 'membership_grant'
          booking_id?: string | null
          description?: string | null
        }
        Update: never
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
