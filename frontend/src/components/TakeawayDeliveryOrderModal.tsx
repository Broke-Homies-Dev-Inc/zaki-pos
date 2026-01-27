import { useState, useEffect } from "react";
import {
  X,
  Clock,
  User,
  Phone,
  MapPin,
  Car,
  CheckCircle2,
  XCircle,
  Package,
  Motorbike,
  AlertCircle,
  RefreshCw,
  Printer,
  DollarSign,
  Undo2,
} from "lucide-react";
import api from "../lib/api";
import { useOrders } from "../hooks/useOrders";
import { formatCurrency } from "../lib/utils";
import { useRestaurantSettingsContext } from "../contexts/useRestaurantSettingsContext";
import { printKot } from "../lib/printKot";
import { useSocket } from "../hooks/useSocket";
import { confirmAlert } from 'react-confirm-alert';
import 'react-confirm-alert/src/react-confirm-alert.css';
import { toast } from 'react-toastify';

type TakeawayDeliveryOrder = {
  id: string;
  order_number: string;
  order_type: "take_away" | "delivery" | "online_delivery";
  status: string;
  subtotal: number;
  tax_amount: number;
  grand_total: number;
  created_at: string;
  notes?: string | null;
  customer_name?: string | null;
  mobile_number?: string | null;
  take_away_method?: string | null;
  car_make?: string | null;
  car_license_plate?: string | null;
  delivery_address?: string | null;
  delivery_partner?: string | null;
  delivery_driver_name?: string | null;
  delivery_driver_employee_id?: string | null;
  delivery_driver_phone?: string | null;
  order_items?: Array<{
    id: string;
    menu_item_name: string;
    quantity: number;
    unit_price: number;
    total_price: number;
    portion_name?: string;
    is_complimentary?: boolean;
  }>;
};

interface TakeawayDeliveryOrderModalProps {
  order: TakeawayDeliveryOrder;
  onClose: () => void;
  onOrderUpdated?: () => void;
}

const STATUS_CONFIG = {
  awaiting_confirmation: {
    label: "Awaiting Confirmation",
    color: "text-yellow-600",
    bgColor: "bg-yellow-50",
    borderColor: "border-yellow-300",
    icon: AlertCircle,
  },
  preparing: {
    label: "Preparing",
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-300",
    icon: RefreshCw,
  },
  ready_for_pickup: {
    label: "Ready for Pickup",
    color: "text-green-600",
    bgColor: "bg-green-50",
    borderColor: "border-green-300",
    icon: Package,
  },
  out_for_delivery: {
    label: "Out for Delivery",
    color: "text-purple-600",
    bgColor: "bg-purple-50",
    borderColor: "border-purple-300",
    icon: Motorbike,
  },
  completed: {
    label: "Completed",
    color: "text-gray-600",
    bgColor: "bg-gray-50",
    borderColor: "border-gray-300",
    icon: CheckCircle2,
  },
  cancelled: {
    label: "Cancelled",
    color: "text-red-600",
    bgColor: "bg-red-50",
    borderColor: "border-red-300",
    icon: XCircle,
  },
};

export function TakeawayDeliveryOrderModal({
  order,
  onClose,
  onOrderUpdated,
}: TakeawayDeliveryOrderModalProps) {
  const { fetchOrders } = useOrders();
  const { settings } = useRestaurantSettingsContext();

  const [fullOrderDetails, setFullOrderDetails] = useState<any>(null);
  const [loadingOrderDetails, setLoadingOrderDetails] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Refund state
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [refundInfo, setRefundInfo] = useState<any>(null);
  const [isRefunding, setIsRefunding] = useState(false);

  // Fetch full order details
  useEffect(() => {
    const fetchFullOrderDetails = async () => {
      if (order?.id) {
        try {
          setLoadingOrderDetails(true);
          const response = await api.get(`/orders/${order.id}`);
          setFullOrderDetails(response.data);
        } catch (err) {
          console.error("Error fetching order details:", err);
        } finally {
          setLoadingOrderDetails(false);
        }
      }
    };
    fetchFullOrderDetails();
  }, [order?.id]);

  // Close on Escape
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  // Listen for real-time order status updates
  useSocket('orderStatusUpdated', (data: any) => {
    if (data.orderId === order.id) {
      console.log(`📡 Real-time status update for order ${data.orderNumber}: ${data.newStatus}`);
      // Refresh order details when status changes
      const fetchUpdatedOrder = async () => {
        try {
          const response = await api.get(`/orders/${order.id}`);
          setFullOrderDetails(response.data);
        } catch (err) {
          console.error("Error fetching updated order:", err);
        }
      };
      fetchUpdatedOrder();
    }
  });

  // Listen for order updates from external systems
  useSocket('orderUpdated', (data: any) => {
    if (data.order?.id === order.id || data.order?.order_number === order.order_number) {
      console.log(`📡 External order update for ${data.order?.order_number}`);
      // Refresh order details
      const fetchUpdatedOrder = async () => {
        try {
          const response = await api.get(`/orders/${order.id}`);
          setFullOrderDetails(response.data);
        } catch (err) {
          console.error("Error fetching updated order:", err);
        }
      };
      fetchUpdatedOrder();
    }
  });

  const currentOrder = fullOrderDetails || order;
  const statusConfig = STATUS_CONFIG[currentOrder.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.awaiting_confirmation;
  const StatusIcon = statusConfig.icon;

  // Debug: Log delivery driver details
  console.log('🚚 Delivery Driver Info:', {
    order_type: currentOrder.order_type,
    delivery_driver_id: currentOrder.delivery_driver_id,
    delivery_driver_name: currentOrder.delivery_driver_name,
    delivery_driver_employee_id: currentOrder.delivery_driver_employee_id,
    delivery_driver_phone: currentOrder.delivery_driver_phone,
  });

  // Handle Accept Order
  const handleAcceptOrder = async () => {
    confirmAlert({
      title: 'Accept Order',
      message: 'Accept this order and start preparation?',
      buttons: [
        {
          label: 'Yes, Accept',
          onClick: async () => {
            try {
              setIsProcessing(true);

              // Print KOT
              await printKot(order.id);

              // Update status to preparing
              await api.put(`/orders/${order.id}/status`, {
                status: "preparing",
              });

              // Refresh order details
              const response = await api.get(`/orders/${order.id}`);
              setFullOrderDetails(response.data);

              if (onOrderUpdated) onOrderUpdated();
              fetchOrders(new Date(), "all");
            } catch (err) {
              console.error("Error accepting order:", err);
              toast.error("Failed to accept order. Please try again.");
            } finally {
              setIsProcessing(false);
            }
          },
          className: 'bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700'
        },
        {
          label: 'Cancel',
          onClick: () => { },
          className: 'bg-gray-300 text-gray-800 px-4 py-2 rounded hover:bg-gray-400'
        }
      ]
    });
  };

  // Handle Mark as Ready
  const handleMarkAsReady = async () => {
    const nextStatus = order.order_type === "take_away" ? "ready_for_pickup" : "out_for_delivery";
    const confirmMessage = order.order_type === "take_away"
      ? "Mark this order as ready for pickup?"
      : "Mark this order as out for delivery?";

    confirmAlert({
      title: 'Update Order Status',
      message: confirmMessage,
      buttons: [
        {
          label: 'Yes, Update',
          onClick: async () => {
            try {
              setIsProcessing(true);

              await api.put(`/orders/${order.id}/status`, {
                status: nextStatus,
              });

              // Refresh order details
              const response = await api.get(`/orders/${order.id}`);
              setFullOrderDetails(response.data);

              if (onOrderUpdated) onOrderUpdated();
              fetchOrders(new Date(), "all");
            } catch (err) {
              console.error("Error updating order status:", err);
              toast.error("Failed to update order status. Please try again.");
            } finally {
              setIsProcessing(false);
            }
          },
          className: 'bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700'
        },
        {
          label: 'Cancel',
          onClick: () => { },
          className: 'bg-gray-300 text-gray-800 px-4 py-2 rounded hover:bg-gray-400'
        }
      ]
    });
  };

  // Handle Complete Order
  const handleCompleteOrder = async () => {
    confirmAlert({
      title: 'Complete Order',
      message: 'Mark this order as completed?',
      buttons: [
        {
          label: 'Yes, Complete',
          onClick: async () => {
            try {
              setIsProcessing(true);

              await api.put(`/orders/${order.id}/status`, {
                status: "completed",
              });

              // Refresh order details
              const response = await api.get(`/orders/${order.id}`);
              setFullOrderDetails(response.data);

              if (onOrderUpdated) onOrderUpdated();
              fetchOrders(new Date(), "all");

              toast.success("Order completed successfully!");
              onClose();
            } catch (err) {
              console.error("Error completing order:", err);
              toast.error("Failed to complete order. Please try again.");
            } finally {
              setIsProcessing(false);
            }
          },
          className: 'bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700'
        },
        {
          label: 'Cancel',
          onClick: () => { },
          className: 'bg-gray-300 text-gray-800 px-4 py-2 rounded hover:bg-gray-400'
        }
      ]
    });
  };

  // Handle Cancel/Refund Order
  const handleCancelOrder = async () => {
    // Check if this is an online paid order - open refund modal instead
    if (currentOrder.payment_method === 'online' && currentOrder.payment_status === 'paid') {
      // Fetch refund info first
      try {
        const response = await api.get(`/refunds/order/${order.id}`);
        setRefundInfo(response.data);
        setRefundAmount(response.data.order.max_refundable.toFixed(3));
        setShowRefundModal(true);
      } catch (err) {
        console.error("Error fetching refund info:", err);
        toast.error("Failed to load refund information");
      }
      return;
    }

    // For non-online orders, just cancel
    confirmAlert({
      title: 'Cancel Order',
      message: 'Are you sure you want to cancel this order?',
      buttons: [
        {
          label: 'Yes, Cancel',
          onClick: async () => {
            try {
              setIsProcessing(true);
              await api.put(`/orders/${order.id}/status`, {
                status: "cancelled",
              });
              toast.success("Order cancelled successfully.");
              if (onOrderUpdated) onOrderUpdated();
              fetchOrders(new Date(), "all");
              onClose();
            } catch (err) {
              console.error("Error cancelling order:", err);
              toast.error("Failed to cancel order. Please try again.");
            } finally {
              setIsProcessing(false);
            }
          },
          className: 'bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700'
        },
        {
          label: 'No, Keep Order',
          onClick: () => { },
          className: 'bg-gray-300 text-gray-800 px-4 py-2 rounded hover:bg-gray-400'
        }
      ]
    });
  };

  // Handle Refund Submission
  const handleSubmitRefund = async () => {
    if (!refundAmount || parseFloat(refundAmount) <= 0) {
      toast.error("Please enter a valid refund amount");
      return;
    }
    if (!refundReason.trim()) {
      toast.error("Please provide a reason for the refund");
      return;
    }

    try {
      setIsRefunding(true);
      const response = await api.post('/refunds', {
        order_id: order.id,
        amount: parseFloat(refundAmount),
        reason: refundReason,
        created_by: 'POS Staff' // Could be enhanced with actual user info
      });

      toast.success(response.data.message || "Refund processed successfully!");
      setShowRefundModal(false);
      setRefundAmount('');
      setRefundReason('');

      // Refresh order details
      const orderResponse = await api.get(`/orders/${order.id}`);
      setFullOrderDetails(orderResponse.data);

      // If full refund, cancel the order
      if (response.data.order_refund_status === 'full') {
        await api.put(`/orders/${order.id}/status`, { status: "cancelled" });
        if (onOrderUpdated) onOrderUpdated();
        fetchOrders(new Date(), "all");
        onClose();
      } else {
        if (onOrderUpdated) onOrderUpdated();
      }
    } catch (err: any) {
      console.error("Error processing refund:", err);
      toast.error(err.response?.data?.error || "Failed to process refund");
    } finally {
      setIsRefunding(false);
    }
  };

  // Open refund modal for completed orders
  const handleIssueRefund = async () => {
    try {
      const response = await api.get(`/refunds/order/${order.id}`);
      setRefundInfo(response.data);
      if (response.data.order.max_refundable > 0) {
        setRefundAmount(response.data.order.max_refundable.toFixed(3));
        setShowRefundModal(true);
      } else {
        toast.info("This order has already been fully refunded");
      }
    } catch (err) {
      console.error("Error fetching refund info:", err);
      toast.error("Failed to load refund information");
    }
  };

  // Handle Print KOT
  const handlePrintKot = async () => {
    try {
      await printKot(order.id);
    } catch (err) {
      console.error("Error printing KOT:", err);
      toast.error("Failed to print KOT.");
    }
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getOrderAge = () => {
    const createdAt = new Date(currentOrder.created_at);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60));

    if (diffInMinutes < 60) return `${diffInMinutes} min ago`;
    const hours = Math.floor(diffInMinutes / 60);
    return `${hours}h ${diffInMinutes % 60}m ago`;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-end items-stretch z-50">
      <div className="bg-white shadow-2xl w-full max-w-3xl flex flex-col h-full overflow-hidden animate-slide-in-right">
        {/* Header */}
        <div className="flex justify-between items-start p-6 border-b bg-gradient-to-r from-blue-50 to-purple-50">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h2 className="text-2xl font-bold text-gray-900">
                Order #{currentOrder.order_number}
              </h2>
              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusConfig.bgColor} ${statusConfig.color} border ${statusConfig.borderColor}`}>
                <StatusIcon className="inline-block w-3 h-3 mr-1" />
                {statusConfig.label}
              </span>
            </div>
            <div className="flex items-center gap-4 text-sm text-gray-600">
              <span className="flex items-center gap-1">
                <Clock size={14} />
                {formatDateTime(currentOrder.created_at)}
              </span>
              <span className="font-medium text-orange-600">{getOrderAge()}</span>
              <span className="px-2 py-1 bg-white rounded text-xs font-medium capitalize">
                {currentOrder.order_type === "take_away" ? "Takeaway" : currentOrder.order_type === "online_delivery" ? "Online Delivery" : "Delivery"}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="ml-4 p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {loadingOrderDetails ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-gray-500">Loading order details...</div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Customer Information */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <User size={18} />
                  Customer Information
                </h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {currentOrder.customer_name && (
                    <div>
                      <span className="text-gray-600">Name:</span>
                      <p className="font-medium text-gray-900">{currentOrder.customer_name}</p>
                    </div>
                  )}
                  {currentOrder.mobile_number && (
                    <div>
                      <span className="text-gray-600 flex items-center gap-1">
                        <Phone size={14} />
                        Phone:
                      </span>
                      <p className="font-medium text-gray-900">{currentOrder.mobile_number}</p>
                    </div>
                  )}
                  {currentOrder.order_type === "take_away" && currentOrder.take_away_method && (
                    <div>
                      <span className="text-gray-600">Pickup Method:</span>
                      <p className="font-medium text-gray-900 capitalize">{currentOrder.take_away_method}</p>
                    </div>
                  )}
                  {currentOrder.order_type === "take_away" && (currentOrder.take_away_method === 'car' || currentOrder.take_away_method === 'carhop') && (currentOrder.car_make || currentOrder.car_license_plate) && (
                    <div>
                      <span className="text-gray-600 flex items-center gap-1">
                        <Car size={14} />
                        Car Details:
                      </span>
                      {currentOrder.car_make && <p className="font-medium text-gray-900">{currentOrder.car_make}</p>}
                      {currentOrder.car_license_plate && <p className="text-sm text-gray-600">Plate: {currentOrder.car_license_plate}</p>}
                    </div>
                  )}
                  {(currentOrder.order_type === "delivery" || currentOrder.order_type === "online_delivery") && currentOrder.delivery_address && (
                    <div className="col-span-2">
                      <span className="text-gray-600 flex items-center gap-1">
                        <MapPin size={14} />
                        Delivery Address:
                      </span>
                      <p className="font-medium text-gray-900">{currentOrder.delivery_address}</p>
                    </div>
                  )}
                  {currentOrder.order_type === "online_delivery" && currentOrder.delivery_partner && (
                    <div>
                      <span className="text-gray-600">Delivery Partner:</span>
                      <p className="font-medium text-gray-900">{currentOrder.delivery_partner}</p>
                    </div>
                  )}
                  {currentOrder.delivery_driver_name && (
                    <div className="col-span-2 bg-blue-50 p-3 rounded-md border border-blue-200">
                      <span className="text-blue-700 font-semibold flex items-center gap-1">
                        <Motorbike size={16} />
                        Delivery Driver:
                      </span>
                      <p className="font-bold text-blue-900 text-lg mt-1">{currentOrder.delivery_driver_name}</p>
                      {currentOrder.delivery_driver_phone && (
                        <p className="text-sm text-blue-600 flex items-center gap-1 mt-1">
                          <Phone size={12} />
                          {currentOrder.delivery_driver_phone}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Order Items */}
              <div className="bg-white rounded-lg border border-gray-200">
                <h3 className="font-semibold text-gray-900 p-4 border-b flex items-center gap-2">
                  <Package size={18} />
                  Order Items
                </h3>
                <div className="divide-y">
                  {currentOrder.order_items?.map((item: any) => (
                    <div key={item.id} className="p-4 hover:bg-gray-50 transition-colors">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h4 className="font-medium text-gray-900">
                            {item.menu_item_name}
                            {item.portion_name && (
                              <span className="text-sm text-gray-500 ml-2">({item.portion_name})</span>
                            )}
                          </h4>
                          <div className="text-sm text-gray-600 mt-1">
                            {formatCurrency(item.unit_price, settings?.currency)} × {item.quantity}
                          </div>
                          {item.is_complimentary && (
                            <span className="inline-block mt-1 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                              Complimentary
                            </span>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-gray-900">
                            {item.is_complimentary ? (
                              <span className="text-green-600">FREE</span>
                            ) : (
                              formatCurrency(item.total_price, settings?.currency)
                            )}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Order Notes */}
              {currentOrder.notes && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-900 mb-2">Special Instructions</h3>
                  <p className="text-gray-700 text-sm whitespace-pre-wrap">{currentOrder.notes}</p>
                </div>
              )}

              {/* Payment Summary */}
              <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg p-4 border border-gray-200">
                <h3 className="font-semibold text-gray-900 mb-3">Payment Summary</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Subtotal:</span>
                    <span className="font-medium">{formatCurrency(currentOrder.subtotal, settings?.currency)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Tax:</span>
                    <span className="font-medium">{formatCurrency(currentOrder.tax_amount, settings?.currency)}</span>
                  </div>
                  <div className="border-t border-gray-300 pt-2 mt-2">
                    <div className="flex justify-between text-lg">
                      <span className="font-bold text-gray-900">Total:</span>
                      <span className="font-bold text-gray-900">{formatCurrency(currentOrder.grand_total, settings?.currency)}</span>
                    </div>
                  </div>
                  {currentOrder.status === "awaiting_confirmation" && (
                    <div className="mt-3 pt-3 border-t border-gray-300">
                      <p className="text-xs text-gray-600 bg-blue-50 p-2 rounded">
                        ℹ️ Payment already received. Accept order to begin preparation.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer - Action Buttons */}
        <div className="border-t bg-gray-50 p-6">
          <div className="flex flex-col gap-3">
            {/* Awaiting Confirmation - Show Accept & Cancel */}
            {currentOrder.status === "awaiting_confirmation" && (
              <div className="flex gap-3">
                <button
                  onClick={handleCancelOrder}
                  disabled={isProcessing}
                  className="flex-1 px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium flex items-center justify-center gap-2"
                >
                  <XCircle size={20} />
                  Cancel & Refund
                </button>
                <button
                  onClick={handleAcceptOrder}
                  disabled={isProcessing}
                  className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium flex items-center justify-center gap-2"
                >
                  <CheckCircle2 size={20} />
                  {isProcessing ? "Accepting..." : "Accept Order"}
                </button>
              </div>
            )}

            {/* Preparing - Show Mark as Ready & Print KOT */}
            {currentOrder.status === "preparing" && (
              <>
                <div className="flex gap-3">
                  <button
                    onClick={handlePrintKot}
                    className="px-4 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium flex items-center justify-center gap-2"
                  >
                    <Printer size={20} />
                    Print KOT
                  </button>
                  <button
                    onClick={handleMarkAsReady}
                    disabled={isProcessing}
                    className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium flex items-center justify-center gap-2"
                  >
                    {order.order_type === "take_away" ? (
                      <>
                        <Package size={20} />
                        {isProcessing ? "Updating..." : "Mark Ready for Pickup"}
                      </>
                    ) : (
                      <>
                        <Motorbike size={20} />
                        {isProcessing ? "Updating..." : "Mark Out for Delivery"}
                      </>
                    )}
                  </button>
                </div>
                <button
                  onClick={handleCancelOrder}
                  disabled={isProcessing}
                  className="w-full px-4 py-2 bg-white border-2 border-red-600 text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium flex items-center justify-center gap-2"
                >
                  <XCircle size={18} />
                  Cancel Order (No Refund)
                </button>
              </>
            )}

            {/* Ready for Pickup/Out for Delivery - Show Complete */}
            {(currentOrder.status === "ready_for_pickup" || currentOrder.status === "out_for_delivery") && (
              <>
                <button
                  onClick={handleCompleteOrder}
                  disabled={isProcessing}
                  className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium flex items-center justify-center gap-2"
                >
                  <CheckCircle2 size={20} />
                  {isProcessing ? "Completing..." : "Mark as Completed"}
                </button>
                <button
                  onClick={handleCancelOrder}
                  disabled={isProcessing}
                  className="w-full px-4 py-2 bg-white border-2 border-red-600 text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium flex items-center justify-center gap-2"
                >
                  <XCircle size={18} />
                  Cancel Order (No Refund)
                </button>
              </>
            )}

            {/* Completed or Cancelled - Show Refund option for online orders */}
            {(currentOrder.status === "completed" || currentOrder.status === "cancelled") && (
              <div className="space-y-3">
                <div className="text-center text-gray-500 py-2 font-medium">
                  Order {currentOrder.status === "completed" ? "Completed" : "Cancelled"}
                </div>
                {currentOrder.payment_method === 'online' && currentOrder.payment_status === 'paid' && (
                  <button
                    onClick={handleIssueRefund}
                    className="w-full px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors font-medium flex items-center justify-center gap-2"
                  >
                    <Undo2 size={18} />
                    Issue Refund
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Refund Modal */}
      {showRefundModal && refundInfo && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 overflow-hidden">
            <div className="bg-gradient-to-r from-orange-500 to-red-500 px-6 py-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <DollarSign size={20} />
                Process Refund
              </h3>
              <p className="text-orange-100 text-sm">Order #{currentOrder.order_number}</p>
            </div>
            
            <div className="p-6 space-y-4">
              {/* Order Summary */}
              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Order Total:</span>
                  <span className="font-medium">{formatCurrency(refundInfo.order.grand_total, settings?.currency)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Already Refunded:</span>
                  <span className="font-medium text-orange-600">
                    {formatCurrency(refundInfo.order.total_refunded, settings?.currency)}
                  </span>
                </div>
                <div className="border-t pt-2 flex justify-between text-sm font-bold">
                  <span>Max Refundable:</span>
                  <span className="text-green-600">
                    {formatCurrency(refundInfo.order.max_refundable, settings?.currency)}
                  </span>
                </div>
              </div>

              {/* Refund History */}
              {refundInfo.refunds.length > 0 && (
                <div className="border rounded-lg p-3">
                  <h4 className="font-medium text-gray-700 mb-2 text-sm">Previous Refunds:</h4>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {refundInfo.refunds.map((refund: any) => (
                      <div key={refund.id} className="text-xs bg-gray-50 p-2 rounded flex justify-between">
                        <span className="text-gray-600">{refund.reason}</span>
                        <span className="font-medium">{formatCurrency(refund.amount, settings?.currency)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Refund Amount Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Refund Amount ({settings?.currency || 'OMR'})
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    step="0.001"
                    min="0.001"
                    max={refundInfo.order.max_refundable}
                    value={refundAmount}
                    onChange={(e) => setRefundAmount(e.target.value)}
                    className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    placeholder="Enter amount"
                  />
                  <button
                    onClick={() => setRefundAmount(refundInfo.order.max_refundable.toFixed(3))}
                    className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium"
                  >
                    Full
                  </button>
                </div>
              </div>

              {/* Reason Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reason for Refund *
                </label>
                <textarea
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  placeholder="Enter reason for refund..."
                />
              </div>

              {/* Quick Reasons */}
              <div className="flex flex-wrap gap-2">
                {['Wrong items', 'Quality issue', 'Customer request', 'Order cancelled'].map((reason) => (
                  <button
                    key={reason}
                    onClick={() => setRefundReason(reason)}
                    className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded hover:bg-gray-200"
                  >
                    {reason}
                  </button>
                ))}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="px-6 py-4 bg-gray-50 flex gap-3">
              <button
                onClick={() => {
                  setShowRefundModal(false);
                  setRefundAmount('');
                  setRefundReason('');
                }}
                className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitRefund}
                disabled={isRefunding || !refundAmount || !refundReason.trim()}
                className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium flex items-center justify-center gap-2"
              >
                {isRefunding ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <DollarSign size={16} />
                    Process Refund
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
