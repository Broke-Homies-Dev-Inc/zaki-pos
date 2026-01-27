import { useState, useEffect } from 'react';
import api from '../lib/api';

export interface DeliveryDriver {
  id: string;
  name: string;
  employee_id: string;
  phone_number: string | null;
  vehicle_type: string | null;
  vehicle_number: string | null;
  status: 'active' | 'inactive' | 'on_delivery' | 'on_break';
  created_at: string;
  updated_at: string;
  active_orders?: number;
  completed_today?: number;
  sales_today?: number;
  statistics?: {
    total_orders: number;
    completed_orders: number;
    active_orders: number;
    cancelled_orders: number;
    total_sales: number;
    avg_order_value: number;
  };
}

export const useDeliveryDrivers = () => {
  const [deliveryDrivers, setDeliveryDrivers] = useState<DeliveryDriver[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDeliveryDrivers = async (withStats = false, includeInactive = true) => {
    try {
      setLoading(true);
      const endpoint = withStats ? '/delivery-drivers/with-stats' : '/delivery-drivers';
      const params = new URLSearchParams();
      if (includeInactive) {
        params.append('include_inactive', 'true');
      }
      const response = await api.get(`${endpoint}?${params.toString()}`);
      setDeliveryDrivers(response.data);
      setError(null);
    } catch (err) {
      setError('Failed to fetch delivery drivers');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchDeliveryDriver = async (id: string) => {
    try {
      const response = await api.get(`/delivery-drivers/${id}`);
      return response.data;
    } catch (err) {
      console.error('Error fetching delivery driver:', err);
      throw err;
    }
  };

  const createDeliveryDriver = async (deliveryDriverData: Omit<DeliveryDriver, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const response = await api.post('/delivery-drivers', deliveryDriverData);
      await fetchDeliveryDrivers();
      return response.data;
    } catch (err: any) {
      if (err.response?.data?.message) {
        throw new Error(err.response.data.message);
      }
      throw new Error('Failed to create delivery driver');
    }
  };

  const updateDeliveryDriver = async (id: string, deliveryDriverData: Partial<DeliveryDriver>) => {
    try {
      const response = await api.put(`/delivery-drivers/${id}`, deliveryDriverData);
      await fetchDeliveryDrivers();
      return response.data;
    } catch (err: any) {
      if (err.response?.data?.message) {
        throw new Error(err.response.data.message);
      }
      throw new Error('Failed to update delivery driver');
    }
  };

  const deleteDeliveryDriver = async (id: string) => {
    try {
      await api.delete(`/delivery-drivers/${id}`);
      await fetchDeliveryDrivers();
    } catch (err: any) {
      if (err.response?.data?.message) {
        throw new Error(err.response.data.message);
      }
      throw new Error('Failed to delete delivery driver');
    }
  };

  const getDeliveryDriverPerformance = async (id: string, startDate?: string, endDate?: string) => {
    try {
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      
      const response = await api.get(`/delivery-drivers/${id}/performance?${params.toString()}`);
      return response.data;
    } catch (err) {
      console.error('Error fetching delivery driver performance:', err);
      throw err;
    }
  };

  const getDeliveryDriverOrders = async (id: string, status?: string) => {
    try {
      const params = status ? `?status=${status}` : '';
      const response = await api.get(`/delivery-drivers/${id}/orders${params}`);
      return response.data;
    } catch (err) {
      console.error('Error fetching delivery driver orders:', err);
      throw err;
    }
  };

  const getAvailableDeliveryDrivers = async () => {
    try {
      const response = await api.get('/delivery-drivers/available/list');
      return response.data;
    } catch (err) {
      console.error('Error fetching available delivery drivers:', err);
      throw err;
    }
  };

  useEffect(() => {
    fetchDeliveryDrivers();
  }, []);

  return {
    deliveryDrivers,
    loading,
    error,
    fetchDeliveryDrivers,
    fetchDeliveryDriver,
    createDeliveryDriver,
    updateDeliveryDriver,
    deleteDeliveryDriver,
    getDeliveryDriverPerformance,
    getDeliveryDriverOrders,
    getAvailableDeliveryDrivers,
  };
};
