import { useEffect, useState } from 'react';
import api from '../lib/api';
import type { Database } from '../lib/database.types';

type InventoryItem = Database['public']['Tables']['inventory']['Row'];
type InventoryItemInsert = Database['public']['Tables']['inventory']['Insert'];
type InventoryItemUpdate = Database['public']['Tables']['inventory']['Update'];

export function useInventory() {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInventory = async () => {
    try {
      setLoading(true);
      const response = await api.get<InventoryItem[]>('/inventory');
      setInventory(response.data || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch inventory');
    } finally {
      setLoading(false);
    }
  };

  const addInventoryItem = async (item: InventoryItemInsert) => {
    try {
      const response = await api.post<InventoryItem>('/inventory', item);
      setInventory((prev) => [...prev, response.data]);
    } catch (err) {
      console.error('Failed to add inventory item:', err);
    }
  };

  const updateInventoryItem = async (id: string, updates: InventoryItemUpdate) => {
    try {
      const response = await api.put<InventoryItem>(`/inventory/${id}`, updates);
      setInventory((prev) => prev.map((item) => (item.id === id ? response.data : item)));
    } catch (err) {
      console.error('Failed to update inventory item:', err);
    }
  };

  const deleteInventoryItem = async (id: string) => {
    try {
      await api.delete(`/inventory/${id}`);
      setInventory((prev) => prev.filter((item) => item.id !== id));
    } catch (err) {
      console.error('Failed to delete inventory item:', err);
    }
  };

  useEffect(() => {
    fetchInventory();
  }, []);

  return { inventory, loading, error, addInventoryItem, updateInventoryItem, deleteInventoryItem };
}