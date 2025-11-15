import { useState, useEffect } from 'react';
import { X, Gift } from 'lucide-react';
import api from '../lib/api';
import { formatCurrency } from '../lib/utils';
import type { Order } from '../hooks/useOrders'; // Assuming you have an Order type

// We need to define the shape of Order and OrderItem
interface OrderItem {
  id: string;
  menu_item_id: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  complimentary_quantity: number;
  menu_item_name?: string; // We'll fetch this
}

interface FullOrder extends Order {
  order_items: OrderItem[];
}

interface ComplimentModalProps {
  orderId: string;
  onClose: () => void;
  onSave: (updatedOrder: FullOrder) => void;
}

export function ComplimentModal({ orderId, onClose, onSave }: ComplimentModalProps) {
  const [order, setOrder] = useState<FullOrder | null>(null);
  const [compliments, setCompliments] = useState<{ [key: string]: number }>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOrderDetails = async () => {
      try {
        setLoading(true);
        // This API endpoint must return an order with its order_items
        const response = await api.get<FullOrder>(`/orders/${orderId}`);
        setOrder(response.data);
        // Initialize the compliment state
        const initialCompliments: { [key: string]: number } = {};
        response.data.order_items.forEach(item => {
          initialCompliments[item.id] = item.complimentary_quantity || 0;
        });
        setCompliments(initialCompliments);
      } catch (error) {
        console.error("Failed to fetch order details", error);
      } finally {
        setLoading(false);
      }
    };
    fetchOrderDetails();
  }, [orderId]);

  const handleComplimentChange = (itemId: string, quantity: number, maxQuantity: number) => {
    if (quantity < 0) quantity = 0;
    if (quantity > maxQuantity) quantity = maxQuantity;
    setCompliments(prev => ({ ...prev, [itemId]: quantity }));
  };

  const handleSave = async () => {
    if (!order) return;
    try {
      setLoading(true);
      const itemsToUpdate = Object.entries(compliments).map(([id, qty]) => ({
        order_item_id: id,
        quantity: qty,
      }));

      const { data: updatedOrder } = await api.post('/billing/compliment', {
        order_id: orderId,
        items: itemsToUpdate,
      });

      onSave(updatedOrder); // Pass the updated order back
      onClose();
    } catch (error) {
      console.error("Failed to save compliments", error);
      alert("Failed to save. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-xl font-semibold text-gray-800">Complimentary Items</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={24} /></button>
        </div>

        <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
          {loading && <p>Loading order items...</p>}
          {!loading && order?.order_items.map(item => (
            <div key={item.id} className="flex justify-between items-center bg-gray-50 p-3 rounded-lg">
              <div>
                <p className="font-semibold">{item.menu_item_name || `Item ID: ${item.menu_item_id}`}</p>
                <p className="text-sm text-gray-600">
                  {item.quantity} x {formatCurrency(item.unit_price)} = {formatCurrency(item.total_price)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium">Compliment:</label>
                <input
                  type="number"
                  min="0"
                  max={item.quantity}
                  value={compliments[item.id] || 0}
                  onChange={(e) => handleComplimentChange(item.id, parseInt(e.target.value), item.quantity)}
                  className="w-20 px-2 py-1 border rounded-md text-center"
                />
              </div>
            </div>
          ))}
        </div>

        <div className="p-4 bg-gray-50 border-t flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg font-semibold">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="px-4 py-2 bg-green-600 text-white rounded-lg font-semibold flex items-center gap-2 disabled:bg-gray-400"
          >
            <Gift size={18} /> {loading ? 'Saving...' : 'Save Compliments'}
          </button>
        </div>
      </div>
    </div>
  );
}