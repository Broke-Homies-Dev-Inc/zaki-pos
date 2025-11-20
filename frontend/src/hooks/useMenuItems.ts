import { useState, useEffect, useCallback } from 'react';
import api from '../lib/api';
import type { Database } from '../lib/database.types';

type MenuItemInsert = Database['public']['Tables']['menu_items']['Insert'];
type RecipeItem = { inventory_item_id: string; quantity_used: number; item_name?: string; };
export type MenuItemWithRecipe = Omit<MenuItemInsert, 'id'> & { recipe: RecipeItem[] };
export type MenuItem = Database['public']['Tables']['menu_items']['Row'] & { 
  recipe: RecipeItem[];
  sub_category?: string | null;
  stock?: number;
  low_stock_threshold?: number;
};

export function useMenuItems() {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMenuItems = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get<MenuItem[]>('/menu');
      setMenuItems(response.data || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch menu items');
    } finally {
      setLoading(false);
    }
  }, []);

  const addMenuItem = useCallback(async (item: MenuItemWithRecipe) => {
    try {
      const response = await api.post<MenuItem>('/menu', item);
      setMenuItems((prev) => [...prev, response.data]);
    } catch (err) { console.error('Failed to add menu item:', err); }
  }, []);

  const updateMenuItem = useCallback(async (id: string, updates: Partial<MenuItemWithRecipe>) => {
    try {
      const response = await api.put<MenuItem>(`/menu/${id}`, updates);
      setMenuItems((prev) => prev.map((item) => (item.id === id ? response.data : item)));
    } catch (err) { console.error('Failed to update menu item:', err); }
  }, []);

  const deleteMenuItem = useCallback(async (id: string) => {
    try {
      await api.delete(`/menu/${id}`);
      setMenuItems((prev) => prev.filter((item) => item.id !== id));
    } catch (err) { console.error('Failed to delete menu item:', err); }
  }, []);

  const adjustStock = useCallback(async (id: string, adjustment: number) => {
    try {
      const response = await api.patch<MenuItem>(`/menu/${id}/stock`, { adjustment });
      setMenuItems((prev) => prev.map((item) => (item.id === id ? response.data : item)));
      return response.data;
    } catch (err) { 
      console.error('Failed to adjust stock:', err);
      throw err;
    }
  }, []);

  useEffect(() => {
    fetchMenuItems();
  }, [fetchMenuItems]);

  return { menuItems, loading, error, fetchMenuItems, addMenuItem, updateMenuItem, deleteMenuItem, adjustStock };
}