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
      bills: {
        Row: {
          bill_number: string
          created_at: string
          id: string
          order_id: string
          payment_method: "cash" | "card" | "digital"
        }
        Insert: {
          bill_number: string
          created_at?: string
          id?: string
          order_id: string
          payment_method: "cash" | "card" | "digital"
        }
        Update: {
          bill_number?: string
          created_at?: string
          id?: string
          order_id?: string
          payment_method?: "cash" | "card" | "digital"
        }
        Relationships: [
          {
            foreignKeyName: "bills_order_id_fkey"
            columns: ["order_id"]
            referencedRelation: "orders"
            referencedColumns: ["id"]
          }
        ]
      }
      inventory: {
        Row: {
          cost: number
          created_at: string
          id: string
          item_name: string
          low_stock_threshold: number
          quantity: number
          updated_at: string
        }
        Insert: {
          cost: number
          created_at?: string
          id?: string
          item_name: string
          low_stock_threshold?: number
          quantity?: number
          updated_at?: string
        }
        Update: {
          cost?: number
          created_at?: string
          id?: string
          item_name?: string
          low_stock_threshold?: number
          quantity?: number
          updated_at?: string
        }
        Relationships: []
      }
      menu_items: {
        Row: {
          available: boolean
          category: string
          created_at: string
          id: string
          inventory_item_id: string | null
          name: string
          price: number
          quantity_per_order: number | null
          updated_at: string
          stock?: number
          low_stock_threshold?: number
          sub_category?: string | null
          description?: string | null
          image_url?: string | null
        }
        Insert: {
          available?: boolean
          category: string
          created_at?: string
          id?: string
          inventory_item_id?: string | null
          name: string
          price: number
          quantity_per_order?: number | null
          updated_at?: string
          stock?: number
          low_stock_threshold?: number
          sub_category?: string | null
          description?: string | null
          image_url?: string | null
        }
        Update: {
          available?: boolean
          category?: string
          created_at?: string
          id?: string
          inventory_item_id?: string | null
          name?: string
          price?: number
          quantity_per_order?: number | null
          updated_at?: string
          stock?: number
          low_stock_threshold?: number
          sub_category?: string | null
          description?: string | null
          image_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "menu_items_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            referencedRelation: "inventory"
            referencedColumns: ["id"]
          }
        ]
      }
      order_items: {
        Row: {
          is_complimentary: boolean
          created_at: string
          id: string
          menu_item_id: string
          order_id: string
          quantity: number
          total_price: number
          unit_price: number
        }
        Insert: {
          is_complimentary?: boolean
          created_at?: string
          id?: string
          menu_item_id: string
          order_id: string
          quantity: number
          total_price: number
          unit_price: number
        }
        Update: {
          is_complimentary?: boolean
          created_at?: string
          id?: string
          menu_item_id?: string
          order_id?: string
          quantity?: number
          total_price?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_menu_item_id_fkey"
            columns: ["menu_item_id"]
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            referencedRelation: "orders"
            referencedColumns: ["id"]
          }
        ]
      }
      orders: {
        Row: {
          created_at: string
          customer_name: string | null
          grand_total: number
          id: string
          order_number: string
          status: "pending" | "completed" | "cancelled"
          subtotal: number
          tax_amount: number
          updated_at: string
          waiter_id: string | null
          delivery_driver_id: string | null
        }
        Insert: {
          created_at?: string
          customer_name?: string | null
          grand_total: number
          id?: string
          order_number: string
          status?: "pending" | "completed" | "cancelled"
          subtotal: number
          tax_amount: number
          updated_at?: string
          waiter_id?: string | null
          delivery_driver_id?: string | null
        }
        Update: {
          created_at?: string
          customer_name?: string | null
          grand_total?: number
          id?: string
          order_number?: string
          status?: "pending" | "completed" | "cancelled"
          subtotal?: number
          tax_amount?: number
          updated_at?: string
          waiter_id?: string | null
          delivery_driver_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_waiter_id_fkey"
            columns: ["waiter_id"]
            referencedRelation: "waiters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_delivery_driver_id_fkey"
            columns: ["delivery_driver_id"]
            referencedRelation: "delivery_drivers"
            referencedColumns: ["id"]
          }
        ]
      }
      restaurant_settings: {
        Row: {
          address: string
          contact_number: string
          created_at: string
          id: string
          registration_number?: string
          restaurant_name: string
          tax_rate?: number
          loyalty_points_enabled?: boolean
          loyalty_points_per_100?: number
          points_value?: number
          currency?: string
          print_preview_enabled?: boolean
          updated_at: string
        }
        Insert: {
          address: string
          contact_number: string
          created_at?: string
          id?: string
          registration_number?: string
          restaurant_name: string
          tax_rate?: number
          loyalty_points_enabled?: boolean
          loyalty_points_per_100?: number
          points_value?: number
          currency?: string
          print_preview_enabled?: boolean
          updated_at?: string
        }
        Update: {
          address?: string
          contact_number?: string
          created_at?: string
          id?: string
          registration_number?: string
          restaurant_name?: string
          tax_rate?: number
          loyalty_points_enabled?: boolean
          loyalty_points_per_100?: number
          points_value?: number
          currency?: string
          print_preview_enabled?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      waiters: {
        Row: {
          id: string
          name: string
          employee_id: string
          phone_number: string | null
          status: "active" | "inactive" | "on_break"
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          employee_id: string
          phone_number?: string | null
          status?: "active" | "inactive" | "on_break"
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          employee_id?: string
          phone_number?: string | null
          status?: "active" | "inactive" | "on_break"
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      delivery_drivers: {
        Row: {
          id: string
          name: string
          employee_id: string
          phone_number: string | null
          vehicle_type: string | null
          vehicle_number: string | null
          status: "active" | "inactive" | "on_delivery" | "on_break"
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          employee_id: string
          phone_number?: string | null
          vehicle_type?: string | null
          vehicle_number?: string | null
          status?: "active" | "inactive" | "on_delivery" | "on_break"
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          employee_id?: string
          phone_number?: string | null
          vehicle_type?: string | null
          vehicle_number?: string | null
          status?: "active" | "inactive" | "on_delivery" | "on_break"
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      order_status: "pending" | "completed" | "cancelled"
      payment_method: "cash" | "card" | "digital"
      waiter_status: "active" | "inactive" | "on_break"
      delivery_driver_status: "active" | "inactive" | "on_delivery" | "on_break"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}