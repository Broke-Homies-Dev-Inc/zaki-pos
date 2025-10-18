import { useState, useEffect } from 'react';
import api from '../lib/api';

export interface RevenueChartData {
  date: string;
  revenue: number;
  orders: number;
}

export type ChartPeriod = 'weekly' | 'monthly' | 'custom';

interface UseRevenueChartProps {
  period: ChartPeriod;
  startDate?: Date | null;
  endDate?: Date | null;
}

export function useRevenueChart({ period, startDate, endDate }: UseRevenueChartProps) {
  const [data, setData] = useState<RevenueChartData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchChartData = async () => {
    try {
      setLoading(true);
      setError(null);

      let url = `/dashboard/revenue-chart?period=${period}`;
      
      if (period === 'custom' && startDate && endDate) {
        url += `&startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`;
      }

      const response = await api.get<RevenueChartData[]>(url);
      setData(response.data);
    } catch (err) {
      console.error('Error fetching revenue chart data:', err);
      setError('Failed to load revenue chart data');
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (period === 'custom') {
      if (startDate && endDate) {
        fetchChartData();
      } else {
        setData([]);
        setLoading(false);
      }
    } else {
      fetchChartData();
    }
  }, [period, startDate, endDate]);

  return { data, loading, error, refetch: fetchChartData };
}
