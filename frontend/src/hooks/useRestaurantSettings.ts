import { useState, useEffect, useCallback } from 'react';
import api from '../lib/api';

// Define the "shape" of the settings object
export interface RestaurantSettings {
  id?: string;
  restaurant_name: string;
  address: string;
  contact_number: string;
  registration_number: string;
  tax_rate: number;
  loyalty_points_enabled: boolean;
  loyalty_points_per_100: number;
  points_value: number;
  print_preview_enabled: boolean;
  currency?: string;
  min_points_to_redeem: number;
  timer_green_threshold: number;
  timer_orange_threshold: number;
  order_expiry_time: number;
}

// Default state
const defaultSettings: RestaurantSettings = {
  restaurant_name: 'Your Restaurant',
  address: '123 Main St',
  contact_number: '555-1234',
  registration_number: '',
  tax_rate: 0,
  loyalty_points_enabled: true,
  loyalty_points_per_100: 10,
  points_value: 0.1,
  print_preview_enabled: true,
  min_points_to_redeem: 200,
  currency: 'OMR',
  timer_green_threshold: 10,
  timer_orange_threshold: 20,
  order_expiry_time: 60,
};

export function useRestaurantSettings() {
  const [settings, setSettings] = useState<RestaurantSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get<RestaurantSettings>('/setting/settings');
      if (response.data) {
        setSettings(response.data);
      } else {
        setSettings(defaultSettings);
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch settings');
      setSettings(defaultSettings);
    } finally {
      setLoading(false);
    }
  }, []);

  const updateSettings = useCallback(async (newSettings: Partial<RestaurantSettings>) => {
    try {
      setLoading(true);
      const response = await api.post<RestaurantSettings>('/setting/settings', newSettings);
      setSettings(response.data);
      setError(null);
      return response.data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  return { settings, loading, error, refetch: fetchSettings, saveSettings: updateSettings };
}