import { useState, useCallback, useEffect } from 'react';
import api from '../lib/api';

// --- TYPE DEFINITIONS ---

// New type for the summary of an order attached to a table
interface ActiveOrderSummary {
  order_id: string;
  order_number: string;
  grand_total: number;
  status: 'pending' | 'completed' | 'cancelled';
  created_at: string;
}

// Updated type for a single table
export interface RestaurantTable {
  table_id: string;
  table_name: string;
  table_status: string; // The table's own status (e.g., 'available', 'occupied')
  active_order: ActiveOrderSummary | null; // Details of the current order on this table
}

// Updated type for a section
export interface Section {
  section_id: string;
  section_name: string;
  tables: RestaurantTable[];
}

// Updated type for a floor
export interface Floor {
  floor_id: string;
  floor_name: string;
  sections: Section[];
}


export function useSettings() {
  const [layout, setLayout] = useState<Floor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLayout = useCallback(async () => {
    try {
      // We don't set loading to true on every poll, only on the initial load.
      // setLoading(true); 
      const response = await api.get<Floor[]>('/setting/layout');
      setLayout(response.data || []);
      setError(null);
    } catch (err) {
      console.error('Error fetching layout:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch layout');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true); // Set loading true only on the first mount
    fetchLayout();
  }, [fetchLayout]);

  const addFloor = useCallback(async (name: string) => {
    await api.post('/setting/floors', { name });
    fetchLayout();
  }, [fetchLayout]);

  const addSection = useCallback(async (name: string, floor_id: string) => {
    await api.post('/setting/sections', { name, floor_id });
    fetchLayout();
  }, [fetchLayout]);

  const addTable = useCallback(async (name: string, section_id: string) => {
    await api.post('/setting/tables', { name, section_id });
    fetchLayout();
  }, [fetchLayout]);

  const deleteFloor = useCallback(async (floorId: string) => {
    await api.delete(`/setting/floors/${floorId}`);
    fetchLayout();
  }, [fetchLayout]);

  const deleteSection = useCallback(async (sectionId: string) => {
    await api.delete(`/setting/sections/${sectionId}`);
    fetchLayout();
  }, [fetchLayout]);

  const deleteTable = useCallback(async (tableId: string) => {
    await api.delete(`/setting/tables/${tableId}`);
    fetchLayout();
  }, [fetchLayout]);

  const updateTableStatus = useCallback(async (tableId: string, status: string) => {
    try {
      await api.put(`/setting/tables/${tableId}/status`, { status });
      fetchLayout(); // Refresh layout to show the change
      return { success: true };
    } catch (err) {
      console.error('Error updating table status:', err);
      return { success: false, error: err };
    }
  }, [fetchLayout]);


  return {
    layout,
    loading,
    error,
    fetchLayout,
    addFloor,
    addSection,
    addTable,
    deleteFloor,
    deleteSection,
    deleteTable,
    updateTableStatus,
  };
}