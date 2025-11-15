import { useEffect, useState } from 'react';
import api from '../lib/api';
import type { Database } from '../lib/database.types';
import type { OrderWithItems } from './useOrders';

type Bill = Database['public']['Tables']['bills']['Row'];
type BillInsert = Database['public']['Tables']['bills']['Insert'];

export interface BillWithOrder extends Bill {
  orders: OrderWithItems;
}

export function useBills() {
  const [bills, setBills] = useState<BillWithOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBills = async () => {
    try {
      setLoading(true);
      const response = await api.get<BillWithOrder[]>('/bills');
      setBills(response.data || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch bills');
    } finally {
      setLoading(false);
    }
  };

  const createBill = async (bill: BillInsert) => {
    try {
      const response = await api.post<BillWithOrder>('/bills', bill);
      setBills((prev) => [response.data, ...prev]);
      return { success: true, data: response.data };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to create bill' };
    }
  };

  useEffect(() => {
    fetchBills();
  }, []);

  return { bills, loading, error, createBill, refetch: fetchBills };
}