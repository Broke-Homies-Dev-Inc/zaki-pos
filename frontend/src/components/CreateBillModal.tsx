import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { useBills } from '../hooks/useBills';
import { generateBillNumber, formatCurrency } from '../lib/utils';
import type { OrderWithItems } from '../hooks/useOrders';

interface CreateBillModalProps {
  completedOrders: OrderWithItems[];
  preselectedOrderId: string | null;
  onClose: () => void;
}

export function CreateBillModal({ completedOrders, preselectedOrderId, onClose }: CreateBillModalProps) {
  const { createBill } = useBills();
  const [selectedOrderId, setSelectedOrderId] = useState(preselectedOrderId || '');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'digital'>('cash');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (preselectedOrderId) {
      setSelectedOrderId(preselectedOrderId);
    }
  }, [preselectedOrderId]);

  const selectedOrder = completedOrders.find((order) => order.id === selectedOrderId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedOrderId) {
      setError('Please select an order');
      return;
    }

    setLoading(true);

    const billNumber = generateBillNumber();

    const result = await createBill({
      order_id: selectedOrderId,
      bill_number: billNumber,
      payment_method: paymentMethod,
    });

    setLoading(false);

    if (result) {
      onClose();
    } else {
      setError('Failed to generate bill. The order might already be billed.');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
        <div className="flex justify-between items-center p-6 border-b border-gray-200">
          <h2 className="text-2xl font-semibold text-gray-800">Generate New Bill</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={24} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6">
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Select a Completed Order</label>
            <select
              value={selectedOrderId}
              onChange={(e) => setSelectedOrderId(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="" disabled>-- Select an Order --</option>
              {completedOrders.map((order) => (
                <option key={order.id} value={order.id}>
                  Order #{order.order_number} ({order.customer_name})
                </option>
              ))}
            </select>
          </div>

          {selectedOrder && (
            <>
              <div className="bg-gray-50 p-4 rounded-lg mb-4">
                <h3 className="font-semibold mb-2">Order Summary</h3>
                <div className="flex justify-between text-gray-700">
                  <span>Grand Total:</span>
                  <span className="font-bold text-lg">{formatCurrency(selectedOrder.grand_total)}</span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Payment Method</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['cash', 'card', 'digital'] as const).map((method) => (
                    <button
                      key={method}
                      type="button"
                      onClick={() => setPaymentMethod(method)}
                      className={`px-4 py-2 rounded-lg font-medium capitalize transition-colors ${
                        paymentMethod === method
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {method}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || !selectedOrderId}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-blue-400"
                >
                  {loading ? 'Generating...' : 'Generate Bill'}
                </button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  );
}