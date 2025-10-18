import { useEffect, useState } from 'react';
import api from '../lib/api';
import type { Database } from '../lib/database.types';

type RestaurantSettings = Database['public']['Tables']['restaurant_settings']['Row'];
type RestaurantSettingsInsert = Database['public']['Tables']['restaurant_settings']['Insert'];

const DEFAULT_SETTINGS: Partial<RestaurantSettings> = {
  restaurant_name: 'My Restaurant',
  address: '123 Pizza Lane',
  contact_number: '555-123-4567',
};

export function useRestaurantSettings() {
  const [settings, setSettings] = useState<RestaurantSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const response = await api.get<RestaurantSettings>('/setting/settings');
      setSettings(response.data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch settings');
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async (settingsData: RestaurantSettingsInsert) => {
    try {
      const response = await api.post<RestaurantSettings>('/setting/settings', settingsData);
      setSettings(response.data);
      return { success: true, data: response.data };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to save settings',
      };
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  return {
    settings: settings || (DEFAULT_SETTINGS as RestaurantSettings),
    loading,
    error,
    saveSettings,
    refetch: fetchSettings,
  };
}