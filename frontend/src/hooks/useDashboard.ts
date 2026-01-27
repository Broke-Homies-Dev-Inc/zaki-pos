import { useState, useEffect, useCallback } from 'react';
import api from '../lib/api';
import { useSocket } from './useSocket';

interface DashboardStats {
  todayRevenue: number;
  revenueChange: string;
  todayOrders: number;
  ordersChange: string;
  newCustomers: number;
  customersThisHour: number;
  pendingOrders: number;
}

export function useDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get<DashboardStats>('/dashboard');
      setStats(response.data);
      setError(null);
    } catch (err) {
      console.error('Error fetching dashboard stats:', err);
      setError('Failed to load dashboard statistics');
    } finally {
      setLoading(false);
    }
  }, []);

  // Listen for order creation events
  useSocket('order:created', () => {
    console.log('📊 Order created - refreshing dashboard stats');
    fetchStats();
  });

  // Listen for order completion events
  useSocket('order:completed', () => {
    console.log('📊 Order completed - refreshing dashboard stats');
    fetchStats();
  });

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return { stats, loading, error, refetch: fetchStats };
}
