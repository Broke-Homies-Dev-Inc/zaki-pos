import { useState, useCallback } from 'react';
import api from '../lib/api';
import type { Database } from '../lib/database.types';

// Type Definitions
type Order = Database['public']['Tables']['orders']['Row'];
type OrderItemInsert = Database['public']['Tables']['order_items']['Insert'];
type OrderItem = Database['public']['Tables']['order_items']['Row'] & { menu_item_name: string; };
type CartItem = Omit<OrderItemInsert, 'order_id' | 'id' | 'created_at'>;

export interface OrderWithItems extends Order {
  order_items: OrderItem[];
  customer_name: string | null;
  mobile_number: string | null;
  order_type: 'dine_in' | 'take_away' | 'delivery';
  notes: string | null;
  table_name: string | null;
  section_name: string | null;
  floor_name: string | null;
  // THE FIX: Add the missing optional properties here
  take_away_method?: string | null;
  car_details?: string | null;
  delivery_address?: string | null;
}
export type OrderTypeFilter = 'all' | 'dine_in' | 'take_away' | 'delivery';

interface OrderUpdatePayload {
  items: Omit<OrderItemInsert, 'order_id'>[];
  notes: string;
  subtotal: number;
  tax_amount: number;
  grand_total: number;
}

export type OrderCreatePayload = {
  order_number: string;
  order_type: 'dine_in' | 'take_away' | 'delivery';
  subtotal: number;
  tax_amount: number;
  grand_total: number;
  status: 'pending' | 'completed' | 'cancelled';
  notes: string | null;
  customer_name?: string;
  mobile_number?: string;
  restaurant_table_id?: string | null;
  take_away_method?: 'counter' | 'car' | null;
  car_details?: string | null;
  delivery_address?: string | null;
};

export function useOrders() {
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOrders = useCallback(async (date: Date, orderType: OrderTypeFilter) => {
    try {
      setLoading(true);
      const formattedDate = date.toISOString().split('T')[0];
      const params: { date: string; orderType?: string } = { date: formattedDate };
      if (orderType !== 'all') {
        params.orderType = orderType;
      }
      const response = await api.get<OrderWithItems[]>('/orders', { params });
      setOrders(response.data || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch orders');
    } finally {
      setLoading(false);
    }
  }, []);

  const createOrder = useCallback(async (order: OrderCreatePayload, items: CartItem[]) => {
    try {
      const response = await api.post<OrderWithItems>('/orders', { order, items });
      console.log('✅ Order created successfully:', response.data);
      return { success: true, data: response.data };
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || 'Failed to create order';
      console.error('❌ Failed to create order:', errorMessage, err);
      alert(`Failed to create order: ${errorMessage}`);
      return { success: false, error: errorMessage };
    }
  }, []);

  const updateOrderStatus = useCallback(async (orderId: string, status: 'completed' | 'cancelled') => {
    try {
      const response = await api.put<Order>(`/orders/${orderId}/status`, { status });
      setOrders(prev => 
        prev.map(o => (o.id === orderId ? { ...o, status: response.data.status, updated_at: response.data.updated_at } : o))
      );
      return { success: true };
    } catch (err) {
      console.error('Failed to update order status:', err);
      return { success: false, error: err };
    }
  }, []);

  const updateOrder = useCallback(async (orderId: string, payload: OrderUpdatePayload) => {
    try {
      const response = await api.put<OrderWithItems>(`/orders/${orderId}`, payload);
      setOrders(prev => prev.map(o => (o.id === orderId ? response.data : o)));
      return { success: true };
    } catch (err) {
      console.error('Failed to update order:', err);
      return { success: false, error: err };
    }
  }, []);

  return { 
    orders, 
    loading, 
    error, 
    fetchOrders, 
    createOrder, 
    updateOrderStatus,
    updateOrder
  };
}