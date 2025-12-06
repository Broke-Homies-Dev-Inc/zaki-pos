import { useState, useMemo, useEffect } from 'react'; // 1. Import useEffect
import { X, IndianRupee, CreditCard, Smartphone, BookUser, Trash2 } from 'lucide-react';
import type { RestaurantTable } from '../hooks/useSettings';
import api from '../lib/api';
import { formatCurrency, formatDateTime } from '../lib/utils';
import { useRestaurantSettingsContext } from '../contexts/useRestaurantSettingsContext';

type PaymentMethod = 'cash' | 'card' | 'due' | 'other';
type Payment = {
  method: PaymentMethod;
  amount: number;
}

interface PaymentModalProps {
  table: RestaurantTable;
  onClose: () => void;
  onPaymentSuccess: () => void;
  finalAmountToPay: number; // The post-loyalty amount
  pointsToRedeem: number;
  customerData: { id: string } | null;
}

export function PaymentModal({ 
  table, 
  onClose, 
  onPaymentSuccess, 
  finalAmountToPay, 
  pointsToRedeem, 
  customerData 
}: PaymentModalProps) {

  const activeOrder = table.active_order!;
  const { settings } = useRestaurantSettingsContext();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // --- NEW STATE for Splitting ---
  const [isSplit, setIsSplit] = useState(false);
  const [splitPayments, setSplitPayments] = useState<Payment[]>([]);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>('cash');
  
  // For non-split mode
  const [simpleAmountPaid, setSimpleAmountPaid] = useState(finalAmountToPay.toString());
  
  // For split-mode
  const totalPaid = useMemo(() => 
    splitPayments.reduce((sum, p) => sum + p.amount, 0), 
    [splitPayments]
  );
  const amountRemaining = useMemo(() => 
    finalAmountToPay - totalPaid, 
    [finalAmountToPay, totalPaid]
  );
  
  const [amountToAdd, setAmountToAdd] = useState(amountRemaining.toString());
  
  // 2. This is the FIX: Changed useState to useEffect
  useEffect(() => {
    setAmountToAdd(amountRemaining.toString());
  }, [amountRemaining]);

  // Close the modal on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);


  const paymentMethods = [
    { name: 'Cash', value: 'cash', icon: IndianRupee },
    { name: 'Card', value: 'card', icon: CreditCard },
    { name: 'Due', value: 'due', icon: BookUser },
    { name: 'Other', value: 'other', icon: Smartphone },
  ] as const;


  const handleAddPayment = () => {
    const amount = parseFloat(amountToAdd);
    if (isNaN(amount) || amount <= 0) {
      setError("Please enter a valid amount");
      return;
    }
    setSplitPayments([...splitPayments, { method: selectedMethod, amount: amount }]);
  };

  const handleRemovePayment = (index: number) => {
    setSplitPayments(splitPayments.filter((_, i) => i !== index));
  };

  const handleSettle = async () => {
    setError(null);
    setIsSubmitting(true);

    let payments: Payment[] = [];
    // 3. This is the FIX: Removed unused 'totalPaidByUser'
    
    if (isSplit) {
      if (splitPayments.length === 0) {
        setError("Please add at least one payment.");
        setIsSubmitting(false);
        return;
      }
      if (amountRemaining > 0.01) { // Use a small buffer for floating point
        setError("There is still an amount remaining to be paid.");
        setIsSubmitting(false);
        return;
      }
      payments = splitPayments;
    } else {
      // Non-split mode
      const amount = parseFloat(simpleAmountPaid);
      if (isNaN(amount)) {
        setError("Please enter a valid amount.");
        setIsSubmitting(false);
        return;
      }
      if (amount < finalAmountToPay && selectedMethod === 'cash') {
        setError("Cash paid cannot be less than the total due.");
        setIsSubmitting(false);
        return;
      }
      payments = [{ method: selectedMethod, amount: amount }];
    }

    try {
      await api.put(`/setting/orders/${activeOrder.order_id}/complete`, {
        tableId: table.table_id,
        status: "completed",
        pointsRedeemed: pointsToRedeem,
        finalAmount: finalAmountToPay,
        customerId: customerData?.id || null,
        payments: payments, // Send the array of payments
      });
      
      onPaymentSuccess();
      
    } catch (error) {
      console.error('Failed to settle payment:', error);
      setError('Failed to settle payment. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const balance = isSplit ? totalPaid - finalAmountToPay : parseFloat(simpleAmountPaid) - finalAmountToPay;
  const canSettle = isSplit ? amountRemaining <= 0.01 : (selectedMethod === 'cash' ? balance >= -0.01 : true); // Use buffer

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="p-4 border-b">
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-xl font-semibold text-gray-800">{table.table_name}</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={24} /></button>
          </div>
          <div className="flex justify-between text-sm text-gray-500">
            <span>Order #{activeOrder.order_number}</span>
            <span>{formatDateTime(activeOrder.created_at)}</span>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
          <div className="bg-gray-50 p-4 rounded-lg text-center">
            <label className="text-sm font-medium text-gray-600">Total Amount Due</label>
        <p className="text-4xl font-bold text-blue-600">{formatCurrency(finalAmountToPay, settings?.currency || 'OMR')}</p>
            {pointsToRedeem > 0 && (
              <p className="text-sm text-green-600">(After {formatCurrency(activeOrder.grand_total - finalAmountToPay, settings?.currency || 'OMR')} discount)</p>
            )}
          </div>
          
          {/* Split UI */}
          {isSplit ? (
            <div className="space-y-4">
              <div className="space-y-2">
                {splitPayments.map((p, i) => (
                  <div key={i} className="flex justify-between items-center bg-gray-100 p-2 rounded-md">
                    <span className="font-medium capitalize">{p.method}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-800">{formatCurrency(p.amount, settings?.currency || 'OMR')}</span>
                      <button onClick={() => handleRemovePayment(i)} className="text-red-500 hover:text-red-700">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {amountRemaining > 0.01 && (
                <div className="bg-yellow-50 border border-yellow-200 p-3 rounded-lg text-center">
                  <label className="text-sm font-medium text-yellow-800">Amount Remaining</label>
                  <p className="text-2xl font-bold text-yellow-900">{formatCurrency(amountRemaining, settings?.currency || 'OMR')}</p>
                </div>
              )}

              {amountRemaining > 0.01 && (
                <div className="space-y-3 p-3 border rounded-lg">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="amountToAdd" className="block text-sm font-medium text-gray-700">Amount to Add</label>
                      <input
                        type="number" id="amountToAdd"
                        value={amountToAdd}
                        onChange={(e) => setAmountToAdd(e.target.value)}
                        className="w-full px-3 py-2 border rounded-md"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Method</label>
                      <select 
                        value={selectedMethod} 
                        onChange={(e) => setSelectedMethod(e.target.value as PaymentMethod)}
                        className="w-full px-3 py-2 border rounded-md bg-white"
                      >
                        {paymentMethods.map(m => <option key={m.value} value={m.value}>{m.name}</option>)}
                      </select>
                    </div>
                  </div>
                  <button onClick={handleAddPayment} className="w-full px-4 py-2 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-600">
                    Add Payment
                  </button>
                </div>
              )}
            </div>
          ) : (
            // Non-Split UI
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="amountPaid" className="block text-sm font-medium text-gray-700">Amount Paid</label>
                  <input
                    type="number" id="amountPaid"
                    value={simpleAmountPaid}
                    onChange={(e) => setSimpleAmountPaid(e.target.value)}
                    className="w-full px-3 py-2 border rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Balance (Change)</label>
                  <input
                    type="text" readOnly
                    value={formatCurrency(balance, settings?.currency || 'OMR')}
                    className={`w-full px-3 py-2 border rounded-md bg-gray-100 ${balance < 0 ? 'text-red-600' : 'text-green-600'}`}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Payment Method</label>
                <div className="grid grid-cols-4 gap-2">
                  {paymentMethods.map(({ name, value, icon: Icon }) => (
                    <button
                      key={value}
                      onClick={() => setSelectedMethod(value)}
                      className={`p-3 border rounded-lg flex flex-col items-center justify-center transition-all ${
                        selectedMethod === value ? 'bg-blue-600 text-white shadow-lg' : 'bg-white text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <Icon size={20} className="mb-1" />
                      <span className="text-xs font-semibold">{name}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
          {error && <p className="text-sm text-red-600 text-center">{error}</p>}
        </div>

        {/* Footer */}
        <div className="p-4 bg-gray-50 border-t flex items-center gap-3">
          <button 
            onClick={() => setIsSplit(!isSplit)}
            className={`px-4 py-2 rounded-lg font-semibold w-1/2 ${isSplit ? 'bg-blue-200 text-blue-800' : 'bg-gray-200 text-gray-700'}`}
          >
            {isSplit ? 'Single Payment' : 'Split'}
          </button>
          <button className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold w-1/2 opacity-50 cursor-not-allowed" disabled>Complement</button>
          <button
            onClick={handleSettle}
            disabled={isSubmitting || !canSettle}
            className="px-6 py-2 bg-green-600 text-white rounded-lg font-semibold w-full hover:bg-green-700 disabled:bg-gray-400"
          >
            {isSubmitting ? 'Processing...' : 'Settle'}
          </button>
        </div>
      </div>
    </div>
  );
}