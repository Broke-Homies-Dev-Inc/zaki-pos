import { useState, useCallback, useEffect } from 'react';
import api from '../lib/api';

// --- THIS IS THE FIX for mobile_number ---
interface ActiveOrderSummary {
  order_id: string;
  order_number: string;
  grand_total: number;
  subtotal?: number;
  tax_amount?: number;
  status: 'pending' | 'completed' | 'cancelled';
  created_at: string;
  customer_id: string | null;
  customer_mobile: string | null; // <-- ADDED
  waiter_id?: string | null;
  waiter_name?: string | null;
  waiter_employee_id?: string | null;
  order_items?: Array<{
    menu_item_id: string;
    menu_item_name: string;
    quantity: number;
    unit_price: number;
    total_price: number;
  }>;
}

export interface RestaurantTable {
  table_id: string;
  table_name: string;
  section_id: string;
  table_status: string;
  active_order: ActiveOrderSummary | null;
}
// ---------------------------------------------

export interface Section {
  section_id: string;
  section_name: string;
  floor_id: string;
  tables: RestaurantTable[];
}

export interface Floor {
  floor_id: string;
  floor_name: string;
  sections: Section[];
}

interface UseSettingsReturn {
  layout: Floor[];
  loading: boolean;
  error: string | null;
  fetchLayout: () => Promise<void>;
  addFloor: (name: string) => Promise<void>;
  addSection: (name: string, floor_id: string) => Promise<void>;
  addTable: (name: string, section_id: string) => Promise<void>;
  deleteFloor: (floorId: string) => Promise<void>;
  deleteSection: (sectionId: string) => Promise<void>;
  deleteTable: (tableId: string) => Promise<void>;
  updateTableStatus: (tableId: string, status: string) => Promise<void>;
}

export function useSettings(): UseSettingsReturn {
  const [layout, setLayout] = useState<Floor[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLayout = useCallback(async () => {
    try {
      // This API call (to /setting/layout) now returns the customer_mobile
      const response = await api.get<Floor[]>('/setting/layout');
      setLayout(response.data || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch layout');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchLayout();
  }, [fetchLayout]);

  const addFloor = useCallback(async (name: string) => { await api.post('/setting/floors', { name }); await fetchLayout(); }, [fetchLayout]);
  const addSection = useCallback(async (name: string, floor_id: string) => { await api.post('/setting/sections', { name, floor_id }); await fetchLayout(); }, [fetchLayout]);
  const addTable = useCallback(async (name: string, section_id: string) => { await api.post('/setting/tables', { name, section_id }); await fetchLayout(); }, [fetchLayout]);
  const deleteFloor = useCallback(async (floorId: string) => { await api.delete(`/setting/floors/${floorId}`); await fetchLayout(); }, [fetchLayout]);
  const deleteSection = useCallback(async (sectionId: string) => { await api.delete(`/setting/sections/${sectionId}`); await fetchLayout(); }, [fetchLayout]);
  const deleteTable = useCallback(async (tableId: string) => { await api.delete(`/setting/tables/${tableId}`); await fetchLayout(); }, [fetchLayout]);

  const updateTableStatus = useCallback(async (tableId: string, status: string) => {
    await api.put(`/setting/tables/${tableId}/status`, { status });
    setLayout(prevLayout =>
      prevLayout.map(floor => ({
        ...floor,
        sections: floor.sections.map(section => ({
          ...section,
          tables: section.tables.map(table =>
            table.table_id === tableId ? { ...table, table_status: status } : table
          )
        }))
      }))
    );
    await fetchLayout();
  }, [fetchLayout]);

  return { layout, loading, error, fetchLayout, addFloor, addSection, addTable, deleteFloor, deleteSection, deleteTable, updateTableStatus };
}