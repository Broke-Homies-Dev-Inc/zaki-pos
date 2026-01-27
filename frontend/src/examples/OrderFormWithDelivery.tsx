// Example: Adding Delivery Driver Assignment to Order Creation
// This is a reference implementation showing how to integrate delivery driver assignment

import React, { useState, useEffect } from 'react';
import { useDeliveryDrivers, DeliveryDriver } from '../hooks/useDeliveryDrivers';

interface OrderFormWithDeliveryProps {
  orderType: 'dine_in' | 'take_away' | 'delivery';
  onSubmit: (orderData: any) => void;
}

const OrderFormWithDelivery: React.FC<OrderFormWithDeliveryProps> = ({ orderType, onSubmit }) => {
  const { getAvailableDeliveryDrivers } = useDeliveryDrivers();
  const [availableDeliveryDrivers, setAvailableDeliveryDrivers] = useState<DeliveryDriver[]>([]);
  const [selectedDeliveryDriver, setSelectedDeliveryDriver] = useState<string>('');
  const [deliveryAddress, setDeliveryAddress] = useState('');

  useEffect(() => {
    if (orderType === 'delivery') {
      loadAvailableDeliveryDrivers();
    }
  }, [orderType]);

  const loadAvailableDeliveryDrivers = async () => {
    try {
      const available = await getAvailableDeliveryDrivers();
      setAvailableDeliveryDrivers(available);
      // Auto-select the least busy delivery driver
      if (available.length > 0) {
        setSelectedDeliveryDriver(available[0].id);
      }
    } catch (error) {
      console.error('Failed to load delivery drivers:', error);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const orderData = {
      order_type: orderType,
      delivery_driver_id: orderType === 'delivery' ? selectedDeliveryDriver : null,
      delivery_address: orderType === 'delivery' ? deliveryAddress : null,
      // ... other order fields
    };
    
    onSubmit(orderData);
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Other order form fields */}
      
      {orderType === 'delivery' && (
        <>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Delivery Address <span className="text-red-500">*</span>
            </label>
            <textarea
              value={deliveryAddress}
              onChange={(e) => setDeliveryAddress(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
              required
              placeholder="Enter full delivery address"
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Assign Delivery Driver <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedDeliveryDriver}
              onChange={(e) => setSelectedDeliveryDriver(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="">Select a delivery driver</option>
              {availableDeliveryDrivers.map((db) => (
                <option key={db.id} value={db.id}>
                  {db.name} ({db.employee_id}) - {db.vehicle_type || 'No vehicle'} 
                  {db.active_orders ? ` - ${db.active_orders} active` : ''}
                </option>
              ))}
            </select>
            {availableDeliveryDrivers.length === 0 && (
              <p className="mt-1 text-sm text-red-600">
                No delivery drivers available. Please add delivery staff first.
              </p>
            )}
          </div>

          {selectedDeliveryDriver && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
              {(() => {
                const db = availableDeliveryDrivers.find(d => d.id === selectedDeliveryDriver);
                return db ? (
                  <div className="text-sm">
                    <p className="font-medium text-blue-900">{db.name}</p>
                    <p className="text-blue-700">
                      📞 {db.phone_number || 'No phone'}
                    </p>
                    {db.vehicle_type && (
                      <p className="text-blue-700">
                        🚗 {db.vehicle_type} {db.vehicle_number ? `(${db.vehicle_number})` : ''}
                      </p>
                    )}
                    {db.active_orders !== undefined && (
                      <p className="text-blue-700">
                        Current workload: {db.active_orders} active {db.active_orders === 1 ? 'order' : 'orders'}
                      </p>
                    )}
                  </div>
                ) : null;
              })()}
            </div>
          )}
        </>
      )}

      <button
        type="submit"
        className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
        disabled={orderType === 'delivery' && (!selectedDeliveryDriver || !deliveryAddress)}
      >
        Create Order
      </button>
    </form>
  );
};

export default OrderFormWithDelivery;


// ============================================================================
// ALTERNATIVE: Dropdown component for existing order edit/update
// ============================================================================

interface DeliveryDriverSelectProps {
  value: string;
  onChange: (deliveryDriverId: string) => void;
  required?: boolean;
}

export const DeliveryDriverSelect: React.FC<DeliveryDriverSelectProps> = ({ 
  value, 
  onChange, 
  required = false 
}) => {
  const { getAvailableDeliveryDrivers } = useDeliveryDrivers();
  const [deliveryDrivers, setDeliveryDrivers] = useState<DeliveryDriver[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDeliveryDrivers();
  }, []);

  const loadDeliveryDrivers = async () => {
    try {
      setLoading(true);
      const available = await getAvailableDeliveryDrivers();
      setDeliveryDrivers(available);
    } catch (error) {
      console.error('Failed to load delivery drivers:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="text-sm text-gray-500">Loading delivery drivers...</div>;
  }

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
      required={required}
    >
      <option value="">
        {deliveryDrivers.length === 0 ? 'No delivery drivers available' : 'Select delivery driver'}
      </option>
      {deliveryDrivers.map((db) => (
        <option key={db.id} value={db.id}>
          {db.name} - {db.vehicle_type || 'N/A'} 
          {db.active_orders ? ` (${db.active_orders} active)` : ''}
        </option>
      ))}
    </select>
  );
};


// ============================================================================
// USAGE IN ORDERS PAGE
// ============================================================================

/*
// In your Orders.tsx or CreateOrderModal.tsx:

import { DeliveryDriverSelect } from './OrderFormWithDelivery';

// Inside your order form state:
const [orderData, setOrderData] = useState({
  order_type: 'delivery',
  delivery_driver_id: '',
  delivery_address: '',
  // ... other fields
});

// In your form JSX:
{orderData.order_type === 'delivery' && (
  <>
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Delivery Driver <span className="text-red-500">*</span>
      </label>
      <DeliveryDriverSelect
        value={orderData.delivery_driver_id}
        onChange={(id) => setOrderData({ ...orderData, delivery_driver_id: id })}
        required
      />
    </div>
    
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Delivery Address <span className="text-red-500">*</span>
      </label>
      <textarea
        value={orderData.delivery_address}
        onChange={(e) => setOrderData({ ...orderData, delivery_address: e.target.value })}
        className="w-full px-3 py-2 border border-gray-300 rounded-md"
        rows={3}
        required
      />
    </div>
  </>
)}
*/
