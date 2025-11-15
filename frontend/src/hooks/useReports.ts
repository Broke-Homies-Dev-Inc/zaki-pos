// src/hooks/useReports.ts
import { useState, useCallback } from 'react';
import api from '../lib/api';

export type ReportKey =
  | 'work-period'
  | 'item-sales'
  | 'cash-transactions'
  | 'inventory-transactions'
  | 'cost'
  | 'talabat'
  | 'delivery'
  | 'takeaway'
  | 'vat/datewise'
  | 'vat/itemwise'
  | 'vat/ticketwise'
  | 'gifts';

export function useReports() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchReport = useCallback(async (key: ReportKey, params: Record<string, any> = {}) => {
    try {
      setLoading(true);
      setError(null);
      const path = `/reports/${key}`;
      const response = await api.get(path, { params });
      return response.data;
    } catch (err: any) {
      const msg = err?.response?.data?.message || err.message || 'Failed to fetch report';
      setError(msg);
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  return { fetchReport, loading, error };
}
