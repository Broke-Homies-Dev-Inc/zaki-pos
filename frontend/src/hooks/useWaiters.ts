import { useState, useEffect } from 'react';
import api from '../lib/api';

export interface Waiter {
  id: string;
  name: string;
  employee_id: string;
  phone_number: string | null;
  status: 'active' | 'inactive' | 'on_break';
  created_at: string;
  updated_at: string;
  active_orders?: number;
  completed_today?: number;
  sales_today?: number;
  statistics?: {
    total_orders: number;
    completed_orders: number;
    active_orders: number;
    cancelled_orders: number;
    total_sales: number;
    avg_order_value: number;
  };
}

export const useWaiters = () => {
  const [waiters, setWaiters] = useState<Waiter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchWaiters = async (withStats = false, includeInactive = true) => {
    try {
      setLoading(true);
      const endpoint = withStats ? '/waiters/with-stats' : '/waiters';
      const params = new URLSearchParams();
      if (includeInactive) {
        params.append('include_inactive', 'true');
      }
      const response = await api.get(`${endpoint}?${params.toString()}`);
      setWaiters(response.data);
      setError(null);
    } catch (err) {
      setError('Failed to fetch waiters');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchWaiter = async (id: string) => {
    try {
      const response = await api.get(`/waiters/${id}`);
      return response.data;
    } catch (err) {
      console.error('Error fetching waiter:', err);
      throw err;
    }
  };

  const createWaiter = async (waiterData: Omit<Waiter, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const response = await api.post('/waiters', waiterData);
      await fetchWaiters();
      return response.data;
    } catch (err: any) {
      if (err.response?.data?.message) {
        throw new Error(err.response.data.message);
      }
      throw new Error('Failed to create waiter');
    }
  };

  const updateWaiter = async (id: string, waiterData: Partial<Waiter>) => {
    try {
      const response = await api.put(`/waiters/${id}`, waiterData);
      await fetchWaiters();
      return response.data;
    } catch (err: any) {
      if (err.response?.data?.message) {
        throw new Error(err.response.data.message);
      }
      throw new Error('Failed to update waiter');
    }
  };

  const deleteWaiter = async (id: string) => {
    try {
      await api.delete(`/waiters/${id}`);
      await fetchWaiters();
    } catch (err: any) {
      if (err.response?.data?.message) {
        throw new Error(err.response.data.message);
      }
      throw new Error('Failed to delete waiter');
    }
  };

  const getWaiterPerformance = async (id: string, startDate?: string, endDate?: string) => {
    try {
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      
      const response = await api.get(`/waiters/${id}/performance?${params.toString()}`);
      return response.data;
    } catch (err) {
      console.error('Error fetching waiter performance:', err);
      throw err;
    }
  };

  const getWaiterOrders = async (id: string, status?: string) => {
    try {
      const params = status ? `?status=${status}` : '';
      const response = await api.get(`/waiters/${id}/orders${params}`);
      return response.data;
    } catch (err) {
      console.error('Error fetching waiter orders:', err);
      throw err;
    }
  };

  useEffect(() => {
    fetchWaiters();
  }, []);

  return {
    waiters,
    loading,
    error,
    fetchWaiters,
    fetchWaiter,
    createWaiter,
    updateWaiter,
    deleteWaiter,
    getWaiterPerformance,
    getWaiterOrders,
  };
};
