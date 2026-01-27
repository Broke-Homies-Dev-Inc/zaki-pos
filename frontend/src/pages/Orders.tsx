import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, ChevronLeft, ChevronRight, Calendar, Search } from 'lucide-react';
import DatePicker from 'react-datepicker';
import { useOrders, type OrderWithItems, type OrderTypeFilter } from '../hooks/useOrders';
import { CreateOrderModal } from '../components/CreateOrderModal';
import { OrderDetailsModal } from '../components/OrderDetailsModal';
import { TakeawayDeliveryOrderModal } from '../components/TakeawayDeliveryOrderModal';
import { formatCurrency, formatOrderType, getStatusBadge, formatStatus } from '../lib/utils';
import { useRestaurantSettingsContext } from '../contexts/useRestaurantSettingsContext';
import { useSocket } from '../hooks/useSocket';
import "react-datepicker/dist/react-datepicker.css";

// --- Helper component to render extra info (table/car/address) ---
const OrderInfo = ({ order }: { order: OrderWithItems }) => {
  switch (order.order_type) {
    case 'dine_in':
      if (order.table_name) {
        return (
          <span className="text-gray-700">
            {order.table_name}{' '}
            <span className="text-gray-500">
              ({order.section_name}, {order.floor_name})
            </span>
          </span>
        );
      }
      return <span className="text-gray-400 italic">No table assigned</span>;

    case 'take_away':
      if (order.take_away_method === 'car' || order.take_away_method === 'carhop') {
        if (order.car_make || order.car_license_plate) {
          return (
            <span className="text-gray-700">
              {order.car_make && <div className="font-medium">{order.car_make}</div>}
              {order.car_license_plate && <div className="text-sm text-gray-500">Plate: {order.car_license_plate}</div>}
            </span>
          );
        }
        return <span className="text-gray-700">Car Pickup (Carhop)</span>;
      }
      return <span className="text-gray-700">Counter Pickup</span>;

    case 'delivery':
    case 'online_delivery':
      return (
        <span
          className="block truncate text-gray-700"
          title={order.delivery_address || ''}
        >
          {order.delivery_address?.slice(0, 25) + "..." || 'No address'}
        </span>
      );

    default:
      return null;
  }
};

export function Orders() {
  const { orders, loading, error, fetchOrders } = useOrders();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [activeFilter, setActiveFilter] = useState<OrderTypeFilter>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreateModalOpen, setCreateModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<OrderWithItems | null>(null);

  const { settings } = useRestaurantSettingsContext();

  useEffect(() => {
    // Debounce search
    const timeoutId = setTimeout(() => {
      if (selectedDate) {
        fetchOrders(selectedDate, activeFilter, searchTerm);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [selectedDate, activeFilter, searchTerm, fetchOrders]);

  // Auto-refresh orders when new orders are created (from POS)
  useSocket('order:created', () => {
    // Only refresh if viewing today's orders
    if (selectedDate && selectedDate.toDateString() === new Date().toDateString()) {
      fetchOrders(selectedDate, activeFilter);
    }
  });

  // Auto-refresh orders when new orders come from waiter-dev
  useSocket('newOrder', () => {
    // Only refresh if viewing today's orders
    if (selectedDate && selectedDate.toDateString() === new Date().toDateString()) {
      fetchOrders(selectedDate, activeFilter);
    }
  });

  // Auto-refresh orders when order status is updated from any source
  useSocket('orderStatusUpdated', () => {
    if (selectedDate) {
      fetchOrders(selectedDate, activeFilter);
    }
  });

  // Auto-refresh orders when updates come from external systems
  useSocket('orderUpdated', () => {
    if (selectedDate) {
      fetchOrders(selectedDate, activeFilter);
    }
  });

  // Handle orderId from URL params (from notification click)
  useEffect(() => {
    const orderId = searchParams.get('orderId');
    if (orderId) {
      // First check if order is in current list
      const order = orders.find(o => o.id === orderId);
      if (order) {
        setSelectedOrder(order);
        setSearchParams({});
      } else if (!loading) {
        // Fetch the specific order from API
        const fetchOrder = async () => {
          try {
            const response = await fetch(`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000'}/api/orders/${orderId}`);
            if (response.ok) {
              const orderData = await response.json();
              setSelectedOrder(orderData);
            }
          } catch (err) {
            console.error('Failed to fetch order:', err);
          }
          setSearchParams({});
        };
        fetchOrder();
      }
    }
  }, [searchParams, orders, loading, setSearchParams]);

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

    return date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const handleOrderCreated = useCallback(() => {
    setCreateModalOpen(false);
    if (selectedDate) {
      fetchOrders(selectedDate, activeFilter, searchTerm);
    }
  }, [selectedDate, activeFilter, searchTerm, fetchOrders]);

  const isToday = () =>
    selectedDate
      ? selectedDate.toDateString() === new Date().toDateString()
      : false;

  const filterButtons: { label: string; value: OrderTypeFilter }[] = [
    { label: 'All Orders', value: 'all' },
    { label: 'Dine In', value: 'dine_in' },
    { label: 'Take Away', value: 'take_away' },
    { label: 'Delivery', value: 'delivery' },
    { label: 'Online Delivery', value: 'online_delivery' },
  ];

  return (
    <div>
      {/* Header and Create button */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Orders</h1>
          <p className="mt-1 text-gray-600">
            Manage all customer orders from this page.
          </p>
        </div>
        <button
          onClick={() => setCreateModalOpen(true)}
          className="bg-blue-600 text-white font-semibold px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700"
        >
          <Plus size={20} /> Create Order
        </button>
      </div>

      {/* Search Bar */}
      <div className="mb-6">
        <div className="relative">
          <input
            type="text"
            placeholder="Search by Receipt #, Order #, Customer Name, or Mobile Number..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
          />
          <Search className="absolute left-3 top-3.5 text-gray-400" size={20} />
        </div>
      </div>

      {/* Date controls */}
      <div className="mb-6 p-3 bg-white rounded-lg shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleDateChange(-1)}
            className="p-2 rounded-md hover:bg-gray-100"
          >
            <ChevronLeft size={20} />
          </button>
          <span className="font-semibold text-lg w-48 text-center">
            {selectedDate
              ? formatDateForDisplay(selectedDate)
              : 'Select a Date'}
          </span>
          <button
            onClick={() => handleDateChange(1)}
            disabled={isToday()}
            className="p-2 rounded-md hover:bg-gray-100 disabled:opacity-30"
          >
            <ChevronRight size={20} />
          </button>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setSelectedDate(new Date())}
            className="px-4 py-2 text-sm font-semibold text-blue-600 bg-blue-50 rounded-md hover:bg-blue-100"
          >
            Today
          </button>
          <DatePicker
            selected={selectedDate}
            onChange={(date) => setSelectedDate(date)}
            maxDate={new Date()}
            customInput={
              <button className="px-4 py-2 text-sm font-semibold text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 flex items-center gap-2">
                <Calendar size={16} /> Select Date
              </button>
            }
          />
        </div>
      </div>

      {/* Filter buttons */}
      <div className="mb-6 flex items-center gap-2">
        {filterButtons.map(({ label, value }) => (
          <button
            key={value}
            onClick={() => setActiveFilter(value)}
            className={`px-4 py-2 text-sm font-semibold rounded-full transition-colors ${activeFilter === value
              ? 'bg-blue-600 text-white'
              : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 table-fixed">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Order #
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Receipt #
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Customer Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Order Type
                </th>
                {/* Info (table/car/address) */}
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Information
                </th>
                {/* Staff Column (Waiter/Delivery Driver) */}
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Staff
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Subtotal
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Total
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading && (
                <tr>
                  <td
                    colSpan={9}
                    className="text-center py-10 text-gray-500"
                  >
                    Loading orders...
                  </td>
                </tr>
              )}
              {error && (
                <tr>
                  <td
                    colSpan={9}
                    className="text-center py-10 text-red-500"
                  >
                    {error}
                  </td>
                </tr>
              )}

              {!loading &&
                !error &&
                orders.map((order) => {
                  const subtotal = Number(order.subtotal || 0);
                  const grandTotal = Number(order.grand_total || 0);
                  const hasDiscount = subtotal > grandTotal;
                  const discountAmount = hasDiscount ? subtotal - grandTotal + Number(order.tax_amount || 0) : 0;

                  return (
                    <tr
                      key={order.id}
                      onClick={() => setSelectedOrder(order)}
                      className="hover:bg-gray-50 cursor-pointer"
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        <span className="text-blue-600 font-bold">#{order.order_number}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        <span className="font-mono text-xs">{order.receipt_number || 'N/A'}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                        {order.customer_name || 'Walk-in'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                        {formatOrderType(order.order_type)}
                      </td>
                      <td className="px-6 py-4 text-sm w-64 overflow-hidden">
                        <OrderInfo order={order} />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                        {(order.order_type === 'delivery' || order.order_type === 'online_delivery') && order.delivery_driver_id
                          ? order.delivery_driver_id
                          : order.waiter_name
                            ? order.waiter_name
                            : <span className="text-gray-400 italic">No staff assigned</span>}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-700">
                        <div>
                          {formatCurrency(subtotal, settings?.currency || 'OMR')}
                        </div>
                        {hasDiscount && (
                          <div className="text-xs text-green-600">
                            -{formatCurrency(discountAmount, settings?.currency || 'OMR')} discount
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-semibold text-gray-900">
                        {formatCurrency(grandTotal, settings?.currency || 'OMR')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span
                          className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadge(
                            order.status
                          )}`}
                        >
                          {formatStatus(order.status)}
                        </span>
                      </td>
                    </tr>
                  );
                })}

              {!loading && !error && orders.length === 0 && (
                <tr>
                  <td
                    colSpan={9}
                    className="text-center py-10 text-gray-500"
                  >
                    No orders found for this date.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isCreateModalOpen && (
        <CreateOrderModal onClose={handleOrderCreated} />
      )}
      {selectedOrder && selectedOrder.order_type === 'dine_in' && (
        <OrderDetailsModal
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onOrderUpdated={() => selectedDate && fetchOrders(selectedDate, activeFilter)}
        />
      )}
      {selectedOrder && (selectedOrder.order_type === 'take_away' || selectedOrder.order_type === 'delivery' || selectedOrder.order_type === 'online_delivery') && (
        <TakeawayDeliveryOrderModal
          order={selectedOrder as OrderWithItems & { order_type: 'take_away' | 'delivery' | 'online_delivery' }}
          onClose={() => setSelectedOrder(null)}
          onOrderUpdated={() => selectedDate && fetchOrders(selectedDate, activeFilter)}
        />
      )}
    </div>
  );
}
