import { useState, useEffect, useMemo, useCallback } from "react";
import { X, Edit, Trash2, Plus, Printer, CheckCircle, Ban, Gift, Minus, IndianRupee, CreditCard, Smartphone, BookUser, RefreshCw } from "lucide-react";
import { useOrders, type OrderWithItems } from "../hooks/useOrders";
import { useMenuItems } from "../hooks/useMenuItems";
import { useRestaurantSettings } from "../hooks/useRestaurantSettings";
import { formatCurrency, formatOrderType, getStatusBadge } from "../lib/utils";
import { printBill } from "../lib/printBill";
import { printKot } from "../lib/printKot";
import api from "../lib/api";
import type { Database } from "../lib/database.types";
import { confirmAlert } from 'react-confirm-alert';
import 'react-confirm-alert/src/react-confirm-alert.css';
import { toast } from 'react-toastify';

type CartItem = {
  menu_item_id: string;
  quantity: number;
  unit_price: number | string;
  total_price: number | string;
  menu_item_name: string;
  portion_name?: string | null;
  is_complimentary?: boolean;
};

type MenuItem = Database["public"]["Tables"]["menu_items"]["Row"];
type Portion = { name: string; price: number };

interface CustomerData {
  id: string;
  loyalty_points: number;
  name: string;
  mobile_number: string;
}

type PaymentMethod = 'cash' | 'card' | 'due' | 'other';
type Payment = { method: PaymentMethod; amount: number };

export function OrderDetailsModal({
  order,
  onClose,
  onOrderUpdated,
}: {
  order: OrderWithItems;
  onClose: () => void;
  onOrderUpdated?: () => void;
}) {
  const { updateOrder, fetchOrders } = useOrders();
  const { menuItems } = useMenuItems();
  const { settings } = useRestaurantSettings();

  const [isEditing, setIsEditing] = useState(false);
  const [editedCart, setEditedCart] = useState<CartItem[]>([]);
  const [editedNotes, setEditedNotes] = useState(order.notes || "");

  // Payment modal state - don't auto-open for online delivery (payment handled by partner)
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(order.order_type !== 'online_delivery');
  const [printedAndShowPayment, setPrintedAndShowPayment] = useState(false);

  // Track if order has been accepted (for pending delivery orders only)
  const [orderAccepted, setOrderAccepted] = useState(() => order.status !== 'pending' || order.order_type !== 'delivery');

  // Payment state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSplit, setIsSplit] = useState(false);
  const [splitPayments, setSplitPayments] = useState<Payment[]>([]);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>('cash');
  const [simpleAmountPaid, setSimpleAmountPaid] = useState(() => String(order.grand_total || 0));
  const totalPaid = splitPayments.reduce((sum, p) => sum + p.amount, 0);
  const [amountToAdd, setAmountToAdd] = useState('0');

  // Customer loyalty state
  const [customerData, setCustomerData] = useState<CustomerData | null>(null);
  const [usePoints, setUsePoints] = useState(false);
  const [pointsToRedeem, setPointsToRedeem] = useState(0);
  const [loadingCustomer, setLoadingCustomer] = useState(false);

  // Full order details (for editing items)
  const [fullOrderDetails, setFullOrderDetails] = useState<any>(null);
  const [loadingOrderDetails, setLoadingOrderDetails] = useState(false);
  const [selectedItemIndex, setSelectedItemIndex] = useState<number | null>(null);

  // Calculate the actual tax rate used for this order based on its data
  // This ensures we use the correct rate even if settings have changed since order creation
  const actualOrderTaxRate = order.subtotal > 0
    ? (Number(order.tax_amount) / Number(order.subtotal))
    : 0;

  // Use actual order tax rate, or fallback to current settings
  const taxRate = actualOrderTaxRate > 0
    ? actualOrderTaxRate
    : (settings?.tax_rate ? Number(settings.tax_rate) / 100 : 0.05);

  const paymentMethods = [
    { name: 'Cash', value: 'cash', icon: IndianRupee },
    { name: 'Card', value: 'card', icon: CreditCard },
    { name: 'Due', value: 'due', icon: BookUser },
    { name: 'Other', value: 'other', icon: Smartphone },
  ] as const;

  // Fetch full order details when modal opens
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

  // Fetch customer data for loyalty points
  useEffect(() => {
    const fetchCustomerData = async () => {
      const mobile = order?.mobile_number;
      if (mobile) {
        try {
          setLoadingCustomer(true);
          const customerResponse = await api.get(`/customers/phone/${mobile}`);
          setCustomerData(customerResponse.data);
        } catch (err) {
          console.error("Error fetching customer data:", err);
          setCustomerData(null);
        } finally {
          setLoadingCustomer(false);
        }
      }
    };
    fetchCustomerData();
  }, [order?.mobile_number]);

  useEffect(() => {
    setEditedCart(order.order_items || []);
    setEditedNotes(order.notes || "");
  }, [order]);

  // Close modal on Escape key (only when payment modal is not open)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isPaymentModalOpen) {
        onClose();
      }
    };

    if (!isPaymentModalOpen) {
      document.addEventListener('keydown', onKeyDown);
    }

    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [isPaymentModalOpen, onClose]);

  // Check if order is completed or cancelled (cannot edit/pay)
  const isOrderFinalized = order.status === 'completed' || order.status === 'cancelled';

  // Recalculate tax for finalized orders based on item-level and section-level VAT settings
  const recalculatedTotals = useMemo(() => {
    if (!isOrderFinalized || !editedCart || editedCart.length === 0) {
      return null;
    }

    const currentTaxRate = settings?.tax_rate ? Number(settings.tax_rate) / 100 : 0.05;
    let calculatedSubtotal = 0;
    let calculatedVAT = 0;

    editedCart.forEach((cartItem) => {
      if (cartItem.is_complimentary) return;

      const itemPrice = typeof cartItem.total_price === 'string'
        ? parseFloat(cartItem.total_price)
        : cartItem.total_price;

      if (isNaN(itemPrice)) return;

      calculatedSubtotal += itemPrice;

      // Find the menu item to check VAT settings
      const menuItem = menuItems.find((mi) => mi.id === cartItem.menu_item_id);
      if (!menuItem) return;

      // Check section-level apply_vat (default true if not specified)
      const sectionApplyVat = (menuItem as any).section_apply_vat !== false;

      // Check item-level apply_vat (default based on menu item setting)
      const itemApplyVat = (menuItem as any).apply_vat !== false;

      // Only add VAT if both section and item have VAT enabled
      if (sectionApplyVat && itemApplyVat) {
        calculatedVAT += itemPrice * currentTaxRate;
      }
    });

    const calculatedGrandTotal = calculatedSubtotal + calculatedVAT;

    return {
      subtotal: calculatedSubtotal,
      taxAmount: calculatedVAT,
      grandTotal: calculatedGrandTotal,
      taxRate: currentTaxRate,
    };
  }, [isOrderFinalized, editedCart, menuItems, settings?.tax_rate]);

  // Loyalty points calculations
  const loyaltyPointsEnabled = settings?.loyalty_points_enabled !== false;
  const minPointsToRedeem = settings?.min_points_to_redeem || 200;
  const canRedeemPoints = customerData && customerData.loyalty_points >= minPointsToRedeem;
  const pointValueRate = settings?.points_value || 0.1;
  const pointsValue = pointsToRedeem * pointValueRate;
  const billAmount = recalculatedTotals?.grandTotal || fullOrderDetails?.grand_total || order.grand_total || 0;
  const maxRedeemablePoints = Math.min(
    customerData?.loyalty_points || 0,
    Math.floor(billAmount / pointValueRate)
  );
  const amountAfterRedemption = Math.max(0, billAmount - pointsValue);
  const finalAmountToPay = usePoints ? amountAfterRedemption : billAmount;

  // Payment derived values
  const amountRemaining = finalAmountToPay - totalPaid;
  useEffect(() => {
    setAmountToAdd(String(amountRemaining || 0));
  }, [amountRemaining]);

  const balance = isSplit ? totalPaid - finalAmountToPay : (parseFloat(simpleAmountPaid || '0') - finalAmountToPay);
  const canSettle = isSplit ? amountRemaining <= 0.01 : (selectedMethod === 'cash' ? balance >= -0.01 : true);

  // -------- GROUP MENU BY CATEGORY / SUB-CATEGORY (like Create Order) --------
  const groupedMenu = useMemo(() => {
    type SubGroup = { sub: string; items: MenuItem[] };
    type Group = { main: string; subs: SubGroup[] };

    const mainMap = new Map<string, Map<string, MenuItem[]>>();

    menuItems.forEach((mi) => {
      const main = (mi.category || "Uncategorized") as string;
      const subKey = (mi.sub_category || "") as string;

      if (!mainMap.has(main)) mainMap.set(main, new Map());
      const subs = mainMap.get(main)!;

      if (!subs.has(subKey)) subs.set(subKey, []);
      subs.get(subKey)!.push(mi);
    });

    const groups: Group[] = Array.from(mainMap.entries())
      .map(([main, subsMap]) => {
        const subs: SubGroup[] = Array.from(subsMap.entries()).map(
          ([sub, items]) => ({
            sub,
            items: items.sort((a, b) => a.name.localeCompare(b.name)),
          })
        );

        subs.sort((a, b) => {
          if (!a.sub && b.sub) return -1;
          if (a.sub && !b.sub) return 1;
          return a.sub.localeCompare(b.sub);
        });

        return { main, subs };
      })
      .sort((a, b) => a.main.localeCompare(b.main));

    return groups;
  }, [menuItems]);

  // -------- PAYMENT HANDLERS --------
  const handleAddPayment = () => {
    const amount = parseFloat(amountToAdd);
    if (isNaN(amount) || amount <= 0) {
      setError('Please enter a valid amount');
      return;
    }
    setSplitPayments([...splitPayments, { method: selectedMethod, amount }]);
  };

  const handleRemovePayment = (index: number) => {
    setSplitPayments(splitPayments.filter((_, i) => i !== index));
  };

  const handleSettle = async () => {
    if (!order) return;
    setError(null);
    setIsSubmitting(true);

    let payments: Payment[] = [];
    if (isSplit) {
      if (splitPayments.length === 0) {
        setError('Please add at least one payment.');
        setIsSubmitting(false);
        return;
      }
      const currentAmountRemaining = finalAmountToPay - totalPaid;
      if (currentAmountRemaining > 0.01) {
        setError('There is still an amount remaining to be paid.');
        setIsSubmitting(false);
        return;
      }
      payments = splitPayments;
    } else {
      const amount = parseFloat(simpleAmountPaid);
      if (isNaN(amount)) {
        setError('Please enter a valid amount.');
        setIsSubmitting(false);
        return;
      }
      if (amount < finalAmountToPay && selectedMethod === 'cash') {
        setError('Cash paid cannot be less than the total due.');
        setIsSubmitting(false);
        return;
      }
      payments = [{ method: selectedMethod, amount }];
    }

    try {
      await api.put(`/setting/orders/${order.id}/complete`, {
        status: 'completed',
        pointsRedeemed: pointsToRedeem,
        finalAmount: finalAmountToPay,
        customerId: customerData?.id || null,
        payments,
      });

      onPaymentSuccess();
    } catch (err) {
      console.error('Failed to settle payment:', err);
      setError('Failed to settle payment. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePrintBill = async () => {
    if (!order) return;
    try {
      // Create a mock table object for the printBill function
      const mockTable = {
        table_id: '',
        table_name: `Order #${order.order_number}`,
        table_status: order.status,
        active_order: {
          order_id: order.id,
          order_number: order.order_number,
          grand_total: order.grand_total,
          customer_name: order.customer_name,
          customer_mobile: order.mobile_number,
          status: order.status,
        },
      };
      printBill({ table: mockTable as any });
      setPrintedAndShowPayment(true);
      setIsPaymentModalOpen(true);
    } catch (err) {
      console.error('Error printing bill:', err);
    }
  };



  const handleOpenPaymentModal = () => {
    setIsPaymentModalOpen(true);
  };

  const onPaymentSuccess = () => {
    const successMessage = usePoints
      ? `Payment complete! Redeemed: ${pointsToRedeem} points, Paid: ${formatCurrency(finalAmountToPay)}, Remaining points: ${(customerData?.loyalty_points || 0) - pointsToRedeem}`
      : `Payment complete for Order #${order.order_number}!`;

    toast.success(successMessage);
    setIsPaymentModalOpen(false);
    if (onOrderUpdated) onOrderUpdated();
    fetchOrders(new Date(), "all");
    onClose();
  };

  const handleCancelOrder = async () => {
    if (!order) return;
    
    confirmAlert({
      title: 'Cancel Order',
      message: `Are you sure you want to cancel Order #${order.order_number}?`,
      buttons: [
        {
          label: 'Yes, Cancel',
          onClick: async () => {
            try {
              await api.put(`/orders/${order.id}/status`, {
                status: "cancelled",
              });
              toast.success(`Order #${order.order_number} has been cancelled.`);
              if (onOrderUpdated) onOrderUpdated();
              fetchOrders(new Date(), "all");
              onClose();
            } catch (err) {
              console.error("Error cancelling order:", err);
              toast.error("Failed to cancel order.");
            }
          },
          className: 'bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700'
        },
        {
          label: 'Cancel',
          onClick: () => {},
          className: 'bg-gray-300 text-gray-800 px-4 py-2 rounded hover:bg-gray-400'
        }
      ]
    });
  };

  // Handle status updates
  const handleUpdateStatus = async (newStatus: string) => {
    if (!order) return;

    const statusMessages: Record<string, string> = {
      confirmed: "Confirm this order?",
      preparing: "Mark this order as preparing?",
      ready: "Mark this order as ready for serving?",
    };

    confirmAlert({
      title: 'Update Order Status',
      message: statusMessages[newStatus] || `Update order status to ${newStatus}?`,
      buttons: [
        {
          label: 'Yes, Update',
          onClick: async () => {
            try {
              await api.put(`/orders/${order.id}/status`, {
                status: newStatus,
              });

              // Refresh order details
              const response = await api.get(`/orders/${order.id}`);
              setFullOrderDetails(response.data);

              if (onOrderUpdated) onOrderUpdated();
              fetchOrders(new Date(), "all");
            } catch (err) {
              console.error("Error updating order status:", err);
              toast.error("Failed to update order status.");
            }
          },
          className: 'bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700'
        },
        {
          label: 'Cancel',
          onClick: () => {},
          className: 'bg-gray-300 text-gray-800 px-4 py-2 rounded hover:bg-gray-400'
        }
      ]
    });
  };

  const handlePrintKotForDineIn = async () => {
    try {
      await printKot(order.id);
    } catch (err) {
      console.error("Error printing KOT:", err);
      toast.error("Failed to print KOT.");
    }
  };

  // -------- ITEM MODIFICATION HANDLERS --------
  const handleUpdateItemQuantity = async (itemIndex: number, newQuantity: number) => {
    if (!fullOrderDetails || newQuantity < 1) return;

    const updatedItems = [...fullOrderDetails.order_items];
    const item = updatedItems[itemIndex];

    item.quantity = newQuantity;
    item.total_price = item.unit_price * newQuantity;

    await updateOrderItems(updatedItems);
  };

  const handleToggleComplimentary = async (itemIndex: number) => {
    if (!fullOrderDetails) return;

    const updatedItems = [...fullOrderDetails.order_items];
    const item = updatedItems[itemIndex];

    item.is_complimentary = !item.is_complimentary;

    await updateOrderItems(updatedItems);
  };

  const handleRemoveItem = async (itemIndex: number) => {
    if (!fullOrderDetails) return;
    
    confirmAlert({
      title: 'Remove Item',
      message: 'Are you sure you want to remove this item?',
      buttons: [
        {
          label: 'Yes, Remove',
          onClick: async () => {
            const updatedItems = fullOrderDetails.order_items.filter((_: any, index: number) => index !== itemIndex);

            if (updatedItems.length === 0) {
              toast.error('Cannot remove all items. Please cancel the order instead.');
              return;
            }

            await updateOrderItems(updatedItems);
            setSelectedItemIndex(null);
          },
          className: 'bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700'
        },
        {
          label: 'Cancel',
          onClick: () => {},
          className: 'bg-gray-300 text-gray-800 px-4 py-2 rounded hover:bg-gray-400'
        }
      ]
    });
  };

  const updateOrderItems = async (updatedItems: any[]) => {
    if (!order) return;

    try {
      setLoadingOrderDetails(true);

      const subtotal = updatedItems.reduce((sum, item) => {
        if (item.is_complimentary) return sum;
        return sum + Number(item.total_price);
      }, 0);

      const taxAmount = subtotal * taxRate;
      const grandTotal = subtotal + taxAmount;

      const orderData = {
        items: updatedItems.map(item => ({
          menu_item_id: item.menu_item_id,
          quantity: item.quantity,
          unit_price: Number(item.unit_price),
          total_price: Number(item.total_price),
          is_complimentary: item.is_complimentary || false
        })),
        subtotal,
        tax_amount: taxAmount,
        grand_total: grandTotal,
        notes: fullOrderDetails?.notes || ''
      };

      await api.put(`/orders/${order.id}`, orderData);

      const response = await api.get(`/orders/${order.id}`);
      setFullOrderDetails(response.data);

    } catch (err) {
      console.error('Error updating order items:', err);
      alert('Failed to update order items');
    } finally {
      setLoadingOrderDetails(false);
    }
  };

  // -------- CART OPERATIONS (for editing mode) --------
  const addToCart = (menuItem: MenuItem, portion?: Portion | null) => {
    const price = portion ? Number(portion.price) : Number(menuItem.price);
    const portionName = portion ? portion.name : null;

    setEditedCart((prevCart) => {
      const existingItem = prevCart.find(
        (item) =>
          item.menu_item_id === menuItem.id &&
          (item.portion_name || null) === (portionName || null)
      );

      if (existingItem) {
        const unitPrice =
          typeof existingItem.unit_price === "string"
            ? parseFloat(existingItem.unit_price)
            : existingItem.unit_price;
        const newQuantity = existingItem.quantity + 1;
        return prevCart.map((item) =>
          item.menu_item_id === menuItem.id &&
            (item.portion_name || null) === (portionName || null)
            ? {
              ...item,
              quantity: newQuantity,
              total_price: newQuantity * unitPrice,
            }
            : item
        );
      }

      return [
        ...prevCart,
        {
          menu_item_id: menuItem.id,
          quantity: 1,
          unit_price: price,
          total_price: price,
          menu_item_name: menuItem.name,
          portion_name: portionName,
        },
      ];
    });
  };

  const removeFromCart = (menuItemId: string, portionName?: string | null) => {
    setEditedCart((prevCart) =>
      prevCart.filter(
        (item) =>
          !(
            item.menu_item_id === menuItemId &&
            (item.portion_name || null) === (portionName || null)
          )
      )
    );
  };

  // -------- STATUS / SAVE --------
  const handleSaveChanges = async () => {
    const subtotal = editedCart.reduce((sum, item) => {
      const price =
        typeof item.total_price === "string"
          ? parseFloat(item.total_price)
          : item.total_price;
      return sum + (isNaN(price) ? 0 : price);
    }, 0);
    const taxAmount = subtotal * taxRate;
    const grandTotal = subtotal + taxAmount;

    const updatedItems = editedCart.map((item) => ({
      menu_item_id: item.menu_item_id,
      quantity: item.quantity,
      unit_price:
        typeof item.unit_price === "string"
          ? parseFloat(item.unit_price)
          : item.unit_price,
      total_price:
        typeof item.total_price === "string"
          ? parseFloat(item.total_price)
          : item.total_price,
      portion_name: item.portion_name ?? null,
    }));

    await updateOrder(order.id, {
      items: updatedItems,
      notes: editedNotes,
      subtotal,
      tax_amount: taxAmount,
      grand_total: grandTotal,
    });

    setIsEditing(false);
    onClose();
  };

  const subtotal = editedCart.reduce((sum, item) => {
    const price =
      typeof item.total_price === "string"
        ? parseFloat(item.total_price)
        : item.total_price;
    return sum + (isNaN(price) ? 0 : price);
  }, 0);
  const taxAmount = subtotal * taxRate;
  const grandTotal = subtotal + taxAmount;

  // Show "Chicken biriyani (Half)"
  const getDisplayNameForItem = (cartItem: CartItem): string => {
    if (cartItem.portion_name) {
      return `${cartItem.menu_item_name} (${cartItem.portion_name})`;
    }

    const menuItem = menuItems.find((mi) => mi.id === cartItem.menu_item_id);
    if (!menuItem) return cartItem.menu_item_name;

    const unitPriceNum =
      typeof cartItem.unit_price === "string"
        ? parseFloat(cartItem.unit_price)
        : cartItem.unit_price;
    if (isNaN(unitPriceNum)) return cartItem.menu_item_name;

    const withPortions = menuItem as MenuItem & {
      portion_sizes?: Portion[] | null;
    };
    const portions = withPortions.portion_sizes || [];
    if (!Array.isArray(portions) || portions.length === 0)
      return cartItem.menu_item_name;

    const match = portions.find((p) => {
      const pPrice = Number(p.price);
      return !isNaN(pPrice) && Math.abs(pPrice - unitPriceNum) < 0.0001;
    });

    if (!match) return cartItem.menu_item_name;
    return `${cartItem.menu_item_name} (${match.name})`;
  };

  // Handler for accepting pending orders
  const handleAcceptOrder = useCallback(async () => {
    try {
      // Call printKot function
      const kotPrinted = await printKot(order.id);

      if (kotPrinted) {
        // Update order status to 'confirmed'
        await api.put(`/orders/${order.id}/status`, {
          status: "confirmed",
        });

        // Refresh order details
        const response = await api.get(`/orders/${order.id}`);
        setFullOrderDetails(response.data);

        setOrderAccepted(true);
        // Trigger parent refresh if provided
        if (onOrderUpdated) onOrderUpdated();
        fetchOrders(new Date(), "all");
      }
    } catch (err) {
      console.error("Error accepting order:", err);
      alert("Failed to accept order. Please try again.");
    }
  }, [order.id, fetchOrders]);

  // Handle keyboard events for Accept Order modal
  useEffect(() => {
    if (order.status !== 'pending' || order.order_type !== 'delivery' || orderAccepted) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleAcceptOrder();
      } else if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [order.status, orderAccepted, handleAcceptOrder, onClose]);



  // -------- RENDER --------
  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-end items-stretch z-50">
      <div className="bg-white shadow-2xl w-full max-w-4xl flex flex-col h-full overflow-hidden animate-slide-in-right">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b bg-white">
          <div>
            <h2 className="text-2xl font-semibold text-gray-800">
              Order #{order.order_number}
            </h2>
            <div className="flex items-center gap-2 mt-1">
              <span
                className={`px-3 py-1 text-xs font-semibold rounded-full capitalize ${getStatusBadge(
                  order.status
                )}`}
              >
                {order.status}
              </span>
              <span className="text-sm text-gray-500">
                {formatOrderType(order.order_type)}
              </span>
            </div>
            {(order as any).waiter_name && (
              <p className="text-sm text-gray-600 mt-1">
                👤 Served by:{" "}
                <span className="font-medium">
                  {(order as any).waiter_name}
                </span>
                {(order as any).waiter_employee_id &&
                  ` (${(order as any).waiter_employee_id})`}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {order.status === "pending" && !isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className="p-2 rounded-md hover:bg-gray-100 flex items-center gap-2 text-gray-600 font-semibold"
              >
                <Edit size={16} /> Edit
              </button>
            )}
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Body - Split Layout */}
        <div className="flex-1 flex overflow-hidden">
          {/* EDIT MODE - Full Screen Editor */}
          {isEditing ? (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="flex-1 flex overflow-hidden">
                {/* LEFT: MENU (grouped like Create Order) */}
                <div className="w-80 border-r pr-4 p-4 overflow-y-auto hide-scrollbar">
                  <h3 className="font-semibold text-lg mb-3">Add Items</h3>
                  <div className="space-y-3">
                    {groupedMenu.map((group) => (
                      <div key={group.main} className="border rounded-lg">
                        {/* Main category header */}
                        <div className="px-3 py-2 border-b bg-gray-50 flex items-center justify-between">
                          <span className="text-sm font-semibold">
                            {group.main}
                          </span>
                          <span className="text-[11px] text-gray-500">
                            {group.subs.reduce(
                              (acc, s) => acc + s.items.length,
                              0
                            )}{" "}
                            items
                          </span>
                        </div>

                        <div className="px-3 py-2 space-y-2">
                          {group.subs.map((subGroup) => (
                            <div key={subGroup.sub || "no-sub"} className="mb-1">
                              {/* Sub category label */}
                              {subGroup.sub && (
                                <div className="text-[11px] text-gray-500 mb-1">
                                  {subGroup.sub}
                                </div>
                              )}

                              {/* Items in this subcategory */}
                              {subGroup.items.map((item) => {
                                const withPortions = item as MenuItem & {
                                  portion_sizes?: Portion[] | null;
                                };
                                const portions = withPortions.portion_sizes || [];
                                const hasPortions =
                                  Array.isArray(portions) &&
                                  portions.length > 0;

                                return (
                                  <div
                                    key={item.id}
                                    className="p-2 rounded-md hover:bg-gray-50"
                                  >
                                    <div className="flex justify-between items-center">
                                      <div>
                                        <p className="font-medium text-sm">
                                          {item.name}
                                        </p>
                                        <p className="text-[11px] text-gray-500">
                                          {formatCurrency(Number(item.price), settings?.currency || 'OMR')}
                                        </p>
                                      </div>

                                      {!hasPortions && (
                                        <button
                                          type="button"
                                          onClick={() => addToCart(item, null)}
                                          className="bg-blue-100 text-blue-600 rounded-full w-8 h-8 flex items-center justify-center hover:bg-blue-200"
                                        >
                                          <Plus size={18} />
                                        </button>
                                      )}
                                    </div>

                                    {hasPortions && (
                                      <div className="mt-1 flex flex-wrap gap-2">
                                        {portions.map((p, idx) => (
                                          <button
                                            key={`${item.id}-${idx}`}
                                            type="button"
                                            onClick={() => addToCart(item, p)}
                                            className="px-3 py-1 rounded-full border text-[11px] font-medium
                                                       border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100"
                                          >
                                            {p.name}{" "}
                                            {formatCurrency(Number(p.price), settings?.currency || 'OMR')}
                                          </button>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* RIGHT: CURRENT CART */}
                <div className="flex-1 p-4 overflow-y-auto">
                  <h3 className="font-semibold text-lg mb-3">Current Order</h3>
                  <div className="space-y-4">
                    {(editedCart || []).map((item, index) => {
                      const unitPrice =
                        typeof item.unit_price === "string"
                          ? parseFloat(item.unit_price)
                          : item.unit_price;
                      const totalPrice =
                        typeof item.total_price === "string"
                          ? parseFloat(item.total_price)
                          : item.total_price;

                      const displayName = getDisplayNameForItem(item);

                      // Check if this item has a discount (compare with menu item price)
                      const menuItem = menuItems.find(mi => mi.id === item.menu_item_id);
                      const originalPrice = menuItem ? Number(menuItem.price) : unitPrice;
                      const hasDiscount = originalPrice > unitPrice && unitPrice > 0;
                      const discountPercent = hasDiscount ? ((originalPrice - unitPrice) / originalPrice * 100).toFixed(0) : 0;

                      return (
                        <div
                          key={index}
                          className="flex justify-between items-center bg-gray-50 p-3 rounded-lg"
                        >
                          <div className="flex-1">
                            <p className="font-medium">
                              {item.quantity} x {displayName}
                              {hasDiscount && (
                                <span className="ml-2 text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full">
                                  {discountPercent}% off
                                </span>
                              )}
                            </p>
                            <div className="flex items-center gap-2">
                              <p className="text-sm text-gray-500">
                                @ {formatCurrency(isNaN(unitPrice) ? 0 : unitPrice, settings?.currency || 'OMR')}
                              </p>
                              {hasDiscount && (
                                <p className="text-xs text-gray-400 line-through">
                                  {formatCurrency(originalPrice, settings?.currency || 'OMR')}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <p className="font-semibold">
                              {formatCurrency(isNaN(totalPrice) ? 0 : totalPrice, settings?.currency || 'OMR')}
                            </p>
                            <button
                              onClick={() =>
                                removeFromCart(
                                  item.menu_item_id,
                                  item.portion_name || null
                                )
                              }
                              className="text-red-500 hover:text-red-600"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Totals */}
                  <div className="mt-6 pt-4 border-t space-y-2">
                    <div className="flex justify-between text-gray-600">
                      <p>Subtotal</p>
                      <p>{formatCurrency(subtotal, settings?.currency || 'OMR')}</p>
                    </div>
                    <div className="flex justify-between text-gray-600">
                      <p>Tax ({(taxRate * 100).toFixed(0)}%)</p>
                      <p>{formatCurrency(taxAmount, settings?.currency || 'OMR')}</p>
                    </div>
                    <div className="flex justify-between font-bold text-lg border-t pt-2">
                      <p>Grand Total</p>
                      <p>{formatCurrency(grandTotal, settings?.currency || 'OMR')}</p>
                    </div>
                  </div>

                  {/* Notes */}
                  <div className="mt-6">
                    <h4 className="font-semibold mb-2">Notes</h4>
                    <textarea
                      value={editedNotes}
                      onChange={(e) => setEditedNotes(e.target.value)}
                      className="w-full h-24 p-2 border rounded-md"
                      placeholder="e.g., Less spicy, extra sauce..."
                    ></textarea>
                  </div>
                </div>
              </div>

              {/* Edit Mode Footer */}
              <div className="p-4 bg-gray-50 border-t flex justify-end gap-3">
                <button
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg font-semibold hover:bg-gray-300"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveChanges}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700"
                >
                  Save Changes
                </button>
              </div>
            </div>
          ) : isOrderFinalized ? (
            // If order is finalized, show simple view
            <div className="flex-1 p-6 overflow-y-auto">
              <div className="space-y-4">
                <h3 className="font-semibold text-lg">Order Items</h3>
                {(editedCart || []).map((item, index) => {
                  const unitPrice =
                    typeof item.unit_price === "string"
                      ? parseFloat(item.unit_price)
                      : item.unit_price;
                  const totalPrice =
                    typeof item.total_price === "string"
                      ? parseFloat(item.total_price)
                      : item.total_price;
                  const displayName = getDisplayNameForItem(item);

                  return (
                    <div key={index} className="flex justify-between items-center bg-gray-50 p-3 rounded-lg">
                      <div className="flex-1">
                        <p className="font-medium">{item.quantity} x {displayName}</p>
                        <p className="text-sm text-gray-500">
                          @ {formatCurrency(isNaN(unitPrice) ? 0 : unitPrice, settings?.currency || 'OMR')}
                        </p>
                      </div>
                      <p className="font-semibold">
                        {formatCurrency(isNaN(totalPrice) ? 0 : totalPrice, settings?.currency || 'OMR')}
                      </p>
                    </div>
                  );
                })}

                {/* Totals */}
                <div className="mt-6 pt-4 border-t space-y-2">
                  <div className="flex justify-between text-gray-600">
                    <p>Subtotal</p>
                    <p>{formatCurrency(recalculatedTotals?.subtotal || subtotal, settings?.currency || 'OMR')}</p>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <p>Tax {recalculatedTotals ? ` (${(recalculatedTotals.taxRate * 100).toFixed(0)}%)` : taxRate > 0 ? ` (${(taxRate * 100).toFixed(0)}%)` : ''}</p>
                    <p>{formatCurrency(recalculatedTotals?.taxAmount || taxAmount, settings?.currency || 'OMR')}</p>
                  </div>
                  <div className="flex justify-between font-bold text-lg border-t pt-2">
                    <p>Grand Total</p>
                    <p>{formatCurrency(recalculatedTotals?.grandTotal || grandTotal, settings?.currency || 'OMR')}</p>
                  </div>
                </div>

                {/* Notes */}
                <div className="mt-6">
                  <h4 className="font-semibold mb-2">Notes</h4>
                  <p className="text-gray-600 bg-gray-50 p-3 rounded-md min-h-[50px]">
                    {order.notes || "No notes for this order."}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Left Side - Order Details (Scrollable) */}
              <div className={`flex-1 p-6 border-r border-gray-200 flex flex-col min-h-0 ${isEditing ? 'max-w-md' : ''}`}>
                <div className="space-y-4 flex-1 flex flex-col min-h-0">
                  {/* Order Items Section (scrollable) */}
                  <div className="border-t pt-4 flex-1 overflow-y-auto hide-scrollbar">
                    <h3 className="font-semibold text-lg mb-3">
                      Order Items
                    </h3>
                    {loadingOrderDetails ? (
                      <div className="bg-white border border-gray-200 rounded-lg p-4 text-center text-gray-500">
                        Loading order details...
                      </div>
                    ) : (
                      <div className="space-y-2 p-1">
                        {fullOrderDetails?.order_items && fullOrderDetails.order_items.length > 0 ? (
                          fullOrderDetails.order_items.map((item: any, index: number) => (
                            <div
                              key={index}
                              className="bg-white border border-gray-200 rounded-lg overflow-hidden"
                            >
                              {/* Item Header - Clickable */}
                              <div
                                onClick={() => setSelectedItemIndex(selectedItemIndex === index ? null : index)}
                                className="flex justify-between items-start p-3 hover:bg-gray-50 cursor-pointer"
                              >
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <p className="font-medium text-gray-900">
                                      {item.menu_item_name}
                                    </p>
                                    {item.is_complimentary && (
                                      <span className="px-2 py-0.5 text-xs font-semibold bg-green-100 text-green-700 rounded">
                                        Complimentary
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-sm text-gray-500">
                                    {item.quantity} × {formatCurrency(Number(item.unit_price), settings?.currency || 'OMR')}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <p className="font-semibold text-gray-900">
                                    {formatCurrency(Number(item.total_price), settings?.currency || 'OMR')}
                                  </p>
                                  <p className="text-xs text-gray-400">
                                    {selectedItemIndex === index ? 'Close' : 'Edit'}
                                  </p>
                                </div>
                              </div>

                              {/* Item Controls - Expandable */}
                              {selectedItemIndex === index && (
                                <div className="border-t border-gray-200 p-3 bg-gray-50 space-y-2">
                                  <div className="flex items-center gap-2">
                                    {/* Quantity Controls */}
                                    <div className="flex items-center gap-1">
                                      <button
                                        onClick={() => handleUpdateItemQuantity(index, item.quantity - 1)}
                                        disabled={item.quantity <= 1}
                                        className="p-1.5 bg-white border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                                      >
                                        <Minus size={14} />
                                      </button>
                                      <span className="w-8 text-center font-semibold text-sm">
                                        {item.quantity}
                                      </span>
                                      <button
                                        onClick={() => handleUpdateItemQuantity(index, item.quantity + 1)}
                                        className="p-1.5 bg-white border border-gray-300 rounded hover:bg-gray-100"
                                      >
                                        <Plus size={14} />
                                      </button>
                                    </div>

                                    {/* Make Complimentary Button */}
                                    <button
                                      onClick={() => handleToggleComplimentary(index)}
                                      className={`px-2 py-1.5 text-xs font-semibold rounded flex items-center justify-center gap-1 whitespace-nowrap ${item.is_complimentary
                                        ? 'bg-green-600 text-white hover:bg-green-700'
                                        : 'bg-white border border-green-600 text-green-600 hover:bg-green-50'
                                        }`}
                                    >
                                      <Gift size={12} />
                                      Complimentary
                                    </button>

                                    {/* Remove Button */}
                                    <button
                                      onClick={() => handleRemoveItem(index)}
                                      className="px-2 py-1.5 text-xs font-semibold bg-red-50 border border-red-600 text-red-600 rounded hover:bg-red-100 flex items-center justify-center gap-1 whitespace-nowrap"
                                    >
                                      <Trash2 size={12} />
                                      Remove
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          ))
                        ) : (
                          <div className="p-4 text-center text-gray-500 bg-white border border-gray-200 rounded-lg">
                            No items in this order
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Order Summary (fixed) */}
                  <div className="border-t pt-4">
                    <h3 className="font-semibold text-lg mb-2">
                      Order Summary
                    </h3>
                    <div className="bg-gray-50 p-3 rounded-md space-y-2">
                      <p className="flex justify-between text-gray-700">
                        <span>Subtotal:</span>
                        <span className="font-semibold">
                          {formatCurrency(
                            recalculatedTotals?.subtotal || fullOrderDetails?.subtotal || order.grand_total || 0,
                            settings?.currency || 'OMR'
                          )}
                        </span>
                      </p>
                      <p className="flex justify-between text-gray-700">
                        <span>Tax{recalculatedTotals ? ` (${(recalculatedTotals.taxRate * 100).toFixed(0)}%)` : ''}:</span>
                        <span className="font-semibold">
                          {formatCurrency(
                            recalculatedTotals?.taxAmount || fullOrderDetails?.tax_amount || 0,
                            settings?.currency || 'OMR'
                          )}
                        </span>
                      </p>
                      <p className="flex justify-between text-gray-700 text-lg font-bold border-t border-gray-300 pt-2">
                        <span>Bill Amount:</span>
                        <span className="font-semibold">
                          {formatCurrency(
                            recalculatedTotals?.grandTotal || fullOrderDetails?.grand_total || order.grand_total || 0,
                            settings?.currency || 'OMR'
                          )}
                        </span>
                      </p>

                      {/* Loyalty Points Section */}
                      {loyaltyPointsEnabled && (
                        <div className="border-t border-gray-300 pt-2 mt-2">
                          {loadingCustomer ? (<p className="text-sm text-purple-700">Loading customer details...</p>) :
                            customerData ? (
                              <div className="bg-gradient-to-r from-purple-50 to-pink-50 p-3 rounded-lg border border-purple-200">
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-2">
                                    <Gift size={18} className="text-purple-600" />
                                    <span className="font-semibold text-purple-900">
                                      Loyalty Points
                                    </span>
                                  </div>
                                  <span className="font-bold text-purple-700">
                                    {customerData.loyalty_points} pts
                                  </span>
                                </div>

                                {canRedeemPoints ? (
                                  <div className="space-y-2">
                                    <div className="flex items-center gap-2">
                                      <input
                                        type="checkbox"
                                        id="usePoints"
                                        checked={usePoints}
                                        onChange={(e) => {
                                          setUsePoints(e.target.checked);
                                          if (e.target.checked && pointsToRedeem === 0) {
                                            setPointsToRedeem(Math.min(minPointsToRedeem, maxRedeemablePoints));
                                          }
                                        }}
                                        className="w-4 h-4 text-purple-600"
                                      />
                                      <label
                                        htmlFor="usePoints"
                                        className="text-sm font-medium text-purple-900 cursor-pointer"
                                      >
                                        Redeem Points
                                      </label>
                                    </div>
                                    {usePoints && (
                                      <div className="space-y-2">
                                        <div className="flex items-center gap-2">
                                          <input type="range" min={minPointsToRedeem} max={maxRedeemablePoints} step="10" value={pointsToRedeem}
                                            onChange={(e) => setPointsToRedeem(Number(e.target.value))}
                                            className="flex-1" />
                                          <input type="number" min={minPointsToRedeem} max={maxRedeemablePoints} step="10" value={pointsToRedeem}
                                            onChange={(e) => {
                                              const val = Number(e.target.value);
                                              if (val <= maxRedeemablePoints) { setPointsToRedeem(val); }
                                            }}
                                            onBlur={() => { if (pointsToRedeem < minPointsToRedeem) { setPointsToRedeem(minPointsToRedeem); } }}
                                            className="w-20 px-2 py-1 border border-purple-300 rounded text-sm" />
                                        </div>
                                        <div className="text-xs text-purple-700 space-y-1">
                                          <p>• Redeeming: {pointsToRedeem} points = {settings?.currency || 'OMR'}{pointsValue.toFixed(2)}</p>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <p className="text-xs text-purple-700 mt-1">
                                    {customerData.loyalty_points < minPointsToRedeem ? `Need ${minPointsToRedeem - customerData.loyalty_points} more points to redeem` : "Not enough points"}
                                  </p>
                                )}
                              </div>
                            ) : (
                              <p className="text-sm text-gray-500">No customer attached to order.</p>
                            )}
                        </div>
                      )}

                      {/* Final Amount */}
                      <div
                        className={`flex justify-between text-lg font-bold pt-2 ${usePoints && pointsToRedeem > 0
                          ? "border-t border-gray-300"
                          : ""
                          }`}
                      >
                        <span className="text-gray-900">
                          Amount to Pay:
                        </span>
                        <span className="text-green-600">
                          {formatCurrency(finalAmountToPay, settings?.currency || 'OMR')}
                        </span>
                      </div>

                      <p className="text-sm text-gray-500 text-right mt-1">
                        Status:{" "}
                        <span className="capitalize font-medium">
                          {order.status}
                        </span>
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Side - Payment Panel / Action Buttons */}
              <div className={`w-96 flex flex-col ${isPaymentModalOpen || (order.status === 'pending' && order.order_type === 'delivery') ? 'justify-start' : 'justify-center'} items-stretch p-6 bg-gray-50`}>

                {/* INLINE ACCEPTANCE UI */}
                {order.status === 'pending' && order.order_type === 'delivery' && !orderAccepted ? (
                  <div className="bg-white rounded-xl shadow p-6 flex flex-col gap-6 items-center text-center">
                    <div className="p-4 bg-orange-50 rounded-full text-orange-600">
                      <CheckCircle size={48} />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-xl font-bold text-gray-900">Accept Order</h3>
                      <p className="text-gray-500 text-sm">Review details and click accept to proceed to billing.</p>
                    </div>

                    <div className="w-full bg-gray-50 p-4 rounded-lg">
                      <p className="text-sm text-gray-500 mb-1">Total Amount</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {formatCurrency(order.grand_total || 0, settings?.currency || "OMR")}
                      </p>
                    </div>

                    <button
                      onClick={handleAcceptOrder}
                      className="w-full px-6 py-4 bg-green-600 text-white rounded-lg font-bold text-lg flex items-center justify-center gap-2 hover:bg-green-700 transition-colors shadow-sm"
                    >
                      <CheckCircle size={20} />
                      Accept Order
                    </button>

                    <p className="text-xs text-gray-400">
                      Press <kbd className="font-mono bg-gray-100 px-1 rounded">Enter</kbd> to accept
                    </p>
                  </div>
                ) : (
                  /* Standard Billing UI */
                  <>
                    {/* Inline Payment Panel */}
                    {isPaymentModalOpen && (
                      <div className="bg-white rounded-xl shadow p-4 mb-4 flex flex-col flex-1">
                        <div className="p-3 space-y-4 flex-1 overflow-y-auto hide-scrollbar">
                          <div className="bg-gray-50 p-4 rounded-lg text-center">
                            <label className="text-base font-medium text-gray-600">Total Amount Due</label>
                            <p className="text-3xl font-bold text-blue-600 mt-1">{formatCurrency(finalAmountToPay, settings?.currency || 'OMR')}</p>
                            {pointsToRedeem > 0 && (
                              <p className="text-sm text-green-600 mt-1">(After {formatCurrency((fullOrderDetails?.grand_total || order.grand_total) - finalAmountToPay, settings?.currency || 'OMR')} discount)</p>
                            )}
                          </div>

                          {isSplit ? (
                            <div className="space-y-4">
                              <div className="space-y-2">
                                {splitPayments.map((p, i) => (
                                  <div key={i} className="flex justify-between items-center bg-gray-100 p-3 rounded-md">
                                    <span className="font-semibold text-base capitalize">{p.method}</span>
                                    <div className="flex items-center gap-3">
                                      <span className="text-gray-800 text-base font-medium">{formatCurrency(p.amount, settings?.currency || 'OMR')}</span>
                                      <button onClick={() => handleRemovePayment(i)} className="text-red-500 hover:text-red-700">
                                        <Trash2 size={18} />
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>

                              {amountRemaining > 0.01 && (
                                <div className="bg-yellow-50 border border-yellow-200 p-3 rounded-lg text-center">
                                  <label className="text-base font-medium text-yellow-800">Amount Remaining</label>
                                  <p className="text-xl font-bold text-yellow-900">{formatCurrency(amountRemaining, settings?.currency || 'OMR')}</p>
                                </div>
                              )}

                              {amountRemaining > 0.01 && (
                                <div className="space-y-3 p-3 border rounded-lg">
                                  <div className="grid grid-cols-2 gap-3">
                                    <div>
                                      <label className="block text-sm font-medium text-gray-700 mb-1">Amount to Add</label>
                                      <input type="number" value={amountToAdd} onChange={(e) => setAmountToAdd(e.target.value)} className="w-full px-3 py-2 border rounded-md text-base" />
                                    </div>
                                    <div>
                                      <label className="block text-sm font-medium text-gray-700 mb-1">Method</label>
                                      <select value={selectedMethod} onChange={(e) => setSelectedMethod(e.target.value as PaymentMethod)} className="w-full px-3 py-2 border rounded-md text-base bg-white">
                                        {paymentMethods.map(m => <option key={m.value} value={m.value}>{m.name}</option>)}
                                      </select>
                                    </div>
                                  </div>
                                  <button onClick={handleAddPayment} className="w-full px-3 py-2 bg-blue-500 text-white rounded font-semibold text-sm">Add Payment</button>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="space-y-4">
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-1">Amount Paid</label>
                                  <input type="number" value={simpleAmountPaid} onChange={(e) => setSimpleAmountPaid(e.target.value)} className="w-full px-3 py-2.5 border rounded-md text-base" />
                                </div>
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-1">Balance (Change)</label>
                                  <input type="text" readOnly value={formatCurrency(balance, settings?.currency || 'OMR')} className={`w-full px-3 py-2.5 border rounded-md bg-gray-100 text-base font-medium ${balance < 0 ? 'text-red-600' : 'text-green-600'}`} />
                                </div>
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2 text-center">Payment Method</label>
                                <div className="grid grid-cols-4 gap-2">
                                  {paymentMethods.map(({ name, value, icon: Icon }) => (
                                    <button key={value} onClick={() => setSelectedMethod(value)} className={`p-3 border rounded-lg flex flex-col items-center justify-center ${selectedMethod === value ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-100'}`}>
                                      <Icon size={22} className="mb-1" />
                                      <span className="text-sm font-semibold">{name}</span>
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </div>
                          )}

                          {error && <p className="text-sm text-red-600 text-center">{error}</p>}
                        </div>

                        <div className="p-3 bg-gray-50 border-t flex items-stretch gap-2">
                          <button
                            onClick={() => setIsSplit(!isSplit)}
                            className={`flex-1 px-3 py-2.5 rounded-lg font-semibold text-sm text-center whitespace-nowrap ${isSplit ? 'bg-blue-200 text-blue-800' : 'bg-gray-200 text-gray-700'}`}
                          >
                            {isSplit ? 'Single' : 'Split'}
                          </button>

                          <button
                            onClick={handleSettle}
                            disabled={isSubmitting || !canSettle}
                            className="flex-1 px-3 py-2.5 bg-green-600 text-white rounded-lg font-semibold text-sm disabled:bg-gray-400 text-center whitespace-nowrap"
                          >
                            {isSubmitting ? 'Processing...' : 'Settle'}
                          </button>
                        </div>
                      </div>
                    )}

                    {isPaymentModalOpen ? (
                      <div className="flex justify-center gap-2 items-center">
                        {/* Print (compact) - hidden after printing */}
                        {!printedAndShowPayment && (
                          <button
                            onClick={handlePrintBill}
                            className="flex-1 px-2 py-2.5 bg-blue-600 text-white rounded-lg font-semibold flex items-center justify-center gap-1.5 text-sm hover:bg-blue-700 transition-colors whitespace-nowrap"
                          >
                            <Printer size={18} />
                            Print
                          </button>
                        )}

                        {/* Cancel (compact) */}
                        <button
                          onClick={handleCancelOrder}
                          className="flex-1 px-2 py-2.5 bg-red-500 text-white rounded-lg font-semibold flex items-center justify-center gap-1.5 text-sm hover:bg-red-600 transition-colors whitespace-nowrap"
                        >
                          <Ban size={18} />
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {/* Status-based action buttons */}
                        {fullOrderDetails?.status === 'confirmed' && (
                          <>
                            <button
                              onClick={handlePrintKotForDineIn}
                              className="w-full px-4 py-3 bg-gray-600 text-white rounded-lg font-semibold flex items-center justify-center gap-2 hover:bg-gray-700 transition-colors"
                            >
                              <Printer size={20} /> Print KOT
                            </button>
                            <button
                              onClick={() => handleUpdateStatus('preparing')}
                              className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg font-semibold flex items-center justify-center gap-2 hover:bg-blue-700 transition-colors"
                            >
                              <RefreshCw size={20} /> Mark as Preparing
                            </button>
                          </>
                        )}

                        {fullOrderDetails?.status === 'preparing' && (
                          <>
                            <button
                              onClick={handlePrintKotForDineIn}
                              className="w-full px-4 py-3 bg-gray-600 text-white rounded-lg font-semibold flex items-center justify-center gap-2 hover:bg-gray-700 transition-colors"
                            >
                              <Printer size={20} /> Print KOT
                            </button>
                            <button
                              onClick={() => handleUpdateStatus('ready')}
                              className="w-full px-4 py-3 bg-green-600 text-white rounded-lg font-semibold flex items-center justify-center gap-2 hover:bg-green-700 transition-colors"
                            >
                              <CheckCircle size={20} /> Mark as Ready
                            </button>
                          </>
                        )}

                        {/* Print Bill Button - show for ready or pending payment */}
                        {(fullOrderDetails?.status === 'ready' || !fullOrderDetails?.status || fullOrderDetails?.status === 'confirmed' || fullOrderDetails?.status === 'preparing') && (
                          <button
                            onClick={handlePrintBill}
                            className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg font-semibold flex items-center justify-center gap-2 hover:bg-blue-700 transition-colors"
                          >
                            <Printer size={20} /> Print Bill
                          </button>
                        )}

                        {/* Complete Payment Button */}
                        <button
                          onClick={handleOpenPaymentModal}
                          disabled={loadingCustomer || loadingOrderDetails}
                          className="w-full px-4 py-3 bg-green-600 text-white rounded-lg font-semibold flex items-center justify-center gap-2 hover:bg-green-700 disabled:bg-gray-400 transition-colors"
                        >
                          <CheckCircle size={20} />
                          Complete Payment
                        </button>

                        {/* Cancel Order Button */}
                        <button
                          onClick={handleCancelOrder}
                          className="w-full px-4 py-3 bg-white border-2 border-red-600 text-red-600 rounded-lg font-semibold flex items-center justify-center gap-2 hover:bg-red-50 transition-colors"
                        >
                          <Ban size={20} /> Cancel Order
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
