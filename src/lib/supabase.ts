import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://blfieqovcvzgiucuymen.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type Database = {
  public: {
    Tables: {
      orders: {
        Row: {
          id: string
          user_id: string
          tenant_id: string
          tracking_number: string
          status: 'pending' | 'picked_up' | 'in_transit' | 'out_for_delivery' | 'delivered' | 'cancelled'
          pickup_location: string
          dropoff_location: string
          weight_range: string
          tee_time: string
          carrier_id: string
          total_amount: number
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['orders']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['orders']['Insert']>
      }
      order_items: {
        Row: {
          id: string
          order_id: string
          product_id: string
          quantity: number
          unit_price: number
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['order_items']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['order_items']['Insert']>
      }
      shipments: {
        Row: {
          id: string
          order_id: string
          carrier_id: string
          tracking_number: string
          status: 'label_created' | 'picked_up' | 'in_transit' | 'out_for_delivery' | 'delivered' | 'exception'
          estimated_delivery: string | null
          actual_delivery: string | null
          shipping_cost: number
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['shipments']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['shipments']['Insert']>
      }
      shipping_carriers: {
        Row: {
          id: string
          name: string
          code: 'fedex' | 'ups' | 'usps' | 'dhl'
          api_endpoint: string
          is_active: boolean
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['shipping_carriers']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['shipping_carriers']['Insert']>
      }
      tracking_events: {
        Row: {
          id: string
          shipment_id: string
          status: string
          description: string
          location: string | null
          timestamp: string
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['tracking_events']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['tracking_events']['Insert']>
      }
      products: {
        Row: {
          id: string
          tenant_id: string
          name: string
          description: string | null
          sku: string
          price: number
          weight: number
          dimensions: {
            length: number
            width: number
            height: number
          } | null
          category: string
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['products']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['products']['Insert']>
      }
      customers: {
        Row: {
          id: string
          user_id: string
          tenant_id: string
          first_name: string
          last_name: string
          email: string
          phone: string | null
          shipping_address: {
            street: string
            city: string
            state: string
            postal_code: string
            country: string
          }
          billing_address: {
            street: string
            city: string
            state: string
            postal_code: string
            country: string
          } | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['customers']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['customers']['Insert']>
      }
    }
  }
}
