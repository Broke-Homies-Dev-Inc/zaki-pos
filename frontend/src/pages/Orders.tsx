import { useState, useEffect, useCallback } from 'react';
import { Plus, ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import DatePicker from 'react-datepicker';
import { useOrders, type OrderWithItems, type OrderTypeFilter } from '../hooks/useOrders';
import { CreateOrderModal } from '../components/CreateOrderModal';
import { OrderDetailsModal } from '../components/OrderDetailsModal';
import { formatCurrency, formatOrderType, getStatusBadge } from '../lib/utils';
import "react-datepicker/dist/react-datepicker.css"; // Import datepicker styles

// --- NEW HELPER COMPONENT to render the information cleanly ---
const OrderInfo = ({ order }: { order: OrderWithItems }) => {
  switch (order.order_type) {
    case 'dine_in':
      if (order.table_name) {
        return <span className="text-gray-700">{order.table_name} <span className="text-gray-500">({order.section_name}, {order.floor_name})</span></span>;
      }
      return <span className="text-gray-400 italic">No table assigned</span>;
    
    case 'take_away':
      if (order.take_away_method === 'car') {
        return <span className="text-gray-700">Car: <span className="font-medium">{order.car_details || 'N/A'}</span></span>;
      }
      return <span className="text-gray-700">Counter Pickup</span>;
    
    case 'delivery':
      return <span className="text-gray-700 truncate" title={order.delivery_address || ''}>{order.delivery_address || 'No address'}</span>;
      
    default:
      return null;
  }
};

export function Orders() {
  const { orders, loading, error, fetchOrders } = useOrders();
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [activeFilter, setActiveFilter] = useState<OrderTypeFilter>('all');
  const [isCreateModalOpen, setCreateModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<OrderWithItems | null>(null);

  useEffect(() => {
    if (selectedDate) {
      fetchOrders(selectedDate, activeFilter);
    }
  }, [selectedDate, activeFilter, fetchOrders]);

  const handleDateChange = (days: number) => {
    if (selectedDate) {
      const newDate = new Date(selectedDate);
      newDate.setDate(selectedDate.getDate() + days);
      setSelectedDate(newDate);
    }
  };

  const formatDateForDisplay = (date: Date) => {
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const handleOrderCreated = useCallback(() => {
    setCreateModalOpen(false);
    if (selectedDate) {
      fetchOrders(selectedDate, activeFilter);
    }
  }, [selectedDate, activeFilter, fetchOrders]);

  const isToday = () => selectedDate ? selectedDate.toDateString() === new Date().toDateString() : false;

  const filterButtons: { label: string; value: OrderTypeFilter }[] = [
    { label: 'All Orders', value: 'all' },
    { label: 'Dine In', value: 'dine_in' },
    { label: 'Take Away', value: 'take_away' },
    { label: 'Delivery', value: 'delivery' },
  ];

  return (
    <div>
      {/* Header and Filters */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Orders</h1>
          <p className="mt-1 text-gray-600">Manage all customer orders from this page.</p>
        </div>
        <button onClick={() => setCreateModalOpen(true)} className="bg-blue-600 text-white font-semibold px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700"><Plus size={20} /> Create Order</button>
      </div>
      <div className="mb-6 p-3 bg-white rounded-lg shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={() => handleDateChange(-1)} className="p-2 rounded-md hover:bg-gray-100"><ChevronLeft size={20}/></button>
          <span className="font-semibold text-lg w-48 text-center">{selectedDate ? formatDateForDisplay(selectedDate) : 'Select a Date'}</span>
          <button onClick={() => handleDateChange(1)} disabled={isToday()} className="p-2 rounded-md hover:bg-gray-100 disabled:opacity-30"><ChevronRight size={20}/></button>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={() => setSelectedDate(new Date())} className="px-4 py-2 text-sm font-semibold text-blue-600 bg-blue-50 rounded-md hover:bg-blue-100">Today</button>
          <DatePicker selected={selectedDate} onChange={(date) => setSelectedDate(date)} maxDate={new Date()} customInput={<button className="px-4 py-2 text-sm font-semibold text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 flex items-center gap-2"><Calendar size={16}/> Select Date</button>} />
        </div>
      </div>
      <div className="mb-6 flex items-center gap-2">
        {filterButtons.map(({ label, value }) => (
          <button key={value} onClick={() => setActiveFilter(value)} className={`px-4 py-2 text-sm font-semibold rounded-full transition-colors ${activeFilter === value ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-100'}`}>{label}</button>
        ))}
      </div>
      
      {/* Orders Table */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Number / ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Order Type</th>
                {/* 1. ADD THE NEW HEADER */}
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Information</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading && <tr><td colSpan={6} className="text-center py-10 text-gray-500">Loading orders...</td></tr>}
              {error && <tr><td colSpan={6} className="text-center py-10 text-red-500">{error}</td></tr>}
              {!loading && !error && orders.map((order) => (
                <tr key={order.id} onClick={() => setSelectedOrder(order)} className="hover:bg-gray-50 cursor-pointer">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{order.mobile_number || `#${order.order_number}`}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{order.customer_name || 'Walk-in'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{formatOrderType(order.order_type)}</td>
                  {/* 2. ADD THE NEW DATA CELL */}
                  <td className="px-6 py-4 whitespace-nowrap text-sm max-w-xs">
                    <OrderInfo order={order} />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-semibold text-gray-900">{formatCurrency(Number(order.grand_total))}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full capitalize ${getStatusBadge(order.status)}`}>{order.status}</span>
                  </td>
                </tr>
              ))}
              {!loading && !error && orders.length === 0 && (<tr><td colSpan={6} className="text-center py-10 text-gray-500">No orders found for this date.</td></tr>)}
            </tbody>
          </table>
        </div>
      </div>

      {isCreateModalOpen && <CreateOrderModal onClose={handleOrderCreated} />}
      {selectedOrder && <OrderDetailsModal order={selectedOrder} onClose={() => setSelectedOrder(null)} />}
    </div>
  );
}