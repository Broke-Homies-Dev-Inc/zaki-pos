import { X, Printer, CheckCircle, Ban, Info, Gift, Trash2, Plus, Minus, IndianRupee, CreditCard, Smartphone, BookUser, ArrowRightLeft } from "lucide-react";
import { useState, useEffect } from "react";
import type { RestaurantTable } from "../hooks/useSettings";
import { useOrders } from "../hooks/useOrders";
import { useSettings } from "../hooks/useSettings";
import { useRestaurantSettings } from "../hooks/useRestaurantSettings";
import { formatCurrency, formatDateTime } from "../lib/utils";
import { printBill } from "../lib/printBill";
import api from "../lib/api";
import { confirmAlert } from 'react-confirm-alert';
import 'react-confirm-alert/src/react-confirm-alert.css';
import { toast } from 'react-toastify';

// Payment UI will be rendered inline; do not import `PaymentModal`.

interface TableBillingModalProps {
    table: RestaurantTable;
    onClose: () => void;
    onStartCombining?: (table: RestaurantTable) => void;
}

interface CustomerData {
    id: string; // We need the customer ID for the API
    loyalty_points: number;
    name: string;
    mobile_number: string;
}

export function TableBillingModal({ table, onClose, onStartCombining }: TableBillingModalProps) {
    const { fetchOrders } = useOrders();
    const { updateTableStatus } = useSettings();
    const { settings } = useRestaurantSettings();
    const activeOrder = table.active_order;

    // 2. Add state to control the new Payment Modal
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(true);
    // When true (after printing) show payment UI and hide the Print button
    const [printedAndShowPayment, setPrintedAndShowPayment] = useState(false);
    // Track if order has been accepted (for pending delivery orders)
    const [orderAccepted, setOrderAccepted] = useState(() =>
        activeOrder?.status !== 'pending' || activeOrder?.order_type !== 'delivery'
    );

    // Payment state (inlined from PaymentModal)
    type PaymentMethod = 'cash' | 'card' | 'due' | 'other';
    type Payment = { method: PaymentMethod; amount: number };
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isSplit, setIsSplit] = useState(false);
    const [splitPayments, setSplitPayments] = useState<Payment[]>([]);
    const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>('cash');
    const [simpleAmountPaid, setSimpleAmountPaid] = useState(() => String(activeOrder?.grand_total || 0));
    const totalPaid = splitPayments.reduce((sum, p) => sum + p.amount, 0);
    const [amountToAdd, setAmountToAdd] = useState('0');

    const paymentMethods = [
        { name: 'Cash', value: 'cash', icon: IndianRupee },
        { name: 'Card', value: 'card', icon: CreditCard },
        { name: 'Due', value: 'due', icon: BookUser },
        { name: 'Other', value: 'other', icon: Smartphone },
    ] as const;

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
        if (!activeOrder) return;
        setError(null);
        setIsSubmitting(true);

        let payments: Payment[] = [];
        if (isSplit) {
            if (splitPayments.length === 0) {
                setError('Please add at least one payment.');
                setIsSubmitting(false);
                return;
            }
            const currentFinal = (typeof finalAmountToPay !== 'undefined') ? finalAmountToPay : (activeOrder?.grand_total || 0);
            const currentAmountRemaining = currentFinal - totalPaid;
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
            await api.put(`/setting/orders/${activeOrder.order_id}/complete`, {
                tableId: table.table_id,
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

    // State for full order details
    const [fullOrderDetails, setFullOrderDetails] = useState<any>(null);
    const [loadingOrderDetails, setLoadingOrderDetails] = useState(false);
    const [selectedItemIndex, setSelectedItemIndex] = useState<number | null>(null);

    // All your existing loyalty logic is kept
    const [customerData, setCustomerData] = useState<CustomerData | null>(null);
    const [usePoints, setUsePoints] = useState(false);
    const [pointsToRedeem, setPointsToRedeem] = useState(0);
    const [loading, setLoading] = useState(false);

    // Fetch full order details when modal opens
    useEffect(() => {
        const fetchFullOrderDetails = async () => {
            if (activeOrder?.order_id) {
                try {
                    setLoadingOrderDetails(true);
                    const response = await api.get(`/orders/${activeOrder.order_id}`);
                    setFullOrderDetails(response.data);
                } catch (error) {
                    console.error("Error fetching order details:", error);
                } finally {
                    setLoadingOrderDetails(false);
                }
            }
        };

        fetchFullOrderDetails();
    }, [activeOrder?.order_id]);

    // Fetch customer data (This logic is improved to use active_order.customer_mobile)
    useEffect(() => {
        const fetchCustomerData = async () => {
            const mobile = activeOrder?.customer_mobile; // Get mobile from the layout query

            if (mobile) {
                try {
                    setLoading(true);
                    const customerResponse = await api.get(`/customers/phone/${mobile}`);
                    setCustomerData(customerResponse.data);
                } catch (error) {
                    console.error("Error fetching customer data:", error);
                    setCustomerData(null);
                } finally {
                    setLoading(false);
                }
            }
        };

        fetchCustomerData();
    }, [activeOrder]);

    // Close the modal when the Escape key is pressed (only when Payment Modal is not open)
    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if (activeOrder && activeOrder.status === 'pending' && activeOrder.order_type === 'delivery' && !orderAccepted) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    handleOrderAccepted();
                } else if (e.key === 'Escape') {
                    onClose();
                }
                return;
            }

            if (e.key === 'Escape' && !isPaymentModalOpen && activeOrder) {
                onClose();
            }
        };

        if (activeOrder) {
            document.addEventListener('keydown', onKeyDown);
        }

        return () => {
            document.removeEventListener('keydown', onKeyDown);
        };
    }, [isPaymentModalOpen, activeOrder, onClose, orderAccepted]);

    // All your existing calculations are kept
    const loyaltyPointsEnabled = settings?.loyalty_points_enabled !== false;
    const minPointsToRedeem = settings?.min_points_to_redeem || 200; // Use setting or default
    const canRedeemPoints = customerData && customerData.loyalty_points >= minPointsToRedeem;
    const pointValueRate = settings?.points_value || 0.1;
    const pointsValue = pointsToRedeem * pointValueRate;
    // Use fullOrderDetails.grand_total when available (it gets updated after item changes)
    const billAmount = fullOrderDetails?.grand_total ?? activeOrder?.grand_total ?? 0;
    const maxRedeemablePoints = Math.min(
        customerData?.loyalty_points || 0,
        Math.floor(billAmount / pointValueRate)
    );
    const amountAfterRedemption = Math.max(0, billAmount - pointsValue);
    const finalAmountToPay = usePoints ? amountAfterRedemption : billAmount;

    // Sync simpleAmountPaid when order total changes (e.g., when items become complimentary)
    useEffect(() => {
        setSimpleAmountPaid(String(billAmount));
    }, [billAmount]);

    // Compute derived payment values now that `finalAmountToPay` is known
    const amountRemaining = finalAmountToPay - totalPaid;
    useEffect(() => {
        setAmountToAdd(String(amountRemaining || 0));
    }, [amountRemaining]);

    const balance = isSplit ? totalPaid - finalAmountToPay : (parseFloat(simpleAmountPaid || '0') - finalAmountToPay);
    const canSettle = isSplit ? amountRemaining <= 0.01 : (selectedMethod === 'cash' ? balance >= -0.01 : true);


    const handlePrintBill = async () => {
        if (!activeOrder) return;
        try {
            printBill({ table });
            await updateTableStatus(table.table_id, "bill_printed");
            // Instead of closing, show the payment UI and remove the Print button
            setPrintedAndShowPayment(true);
            setIsPaymentModalOpen(true);
        } catch (err) {
            console.error('Error printing bill:', err);
        }
    };



    // 3. This function is RENAMED and now just opens the Payment Modal
    const handleOpenPaymentModal = () => {
        setIsPaymentModalOpen(true);
    };

    // 4. This function is passed to the PaymentModal to run on success
    const onPaymentSuccess = () => {
        const successMessage = usePoints
            ? `Payment complete! Redeemed: ${pointsToRedeem} points, Paid: ${formatCurrency(finalAmountToPay)}, Remaining points: ${(customerData?.loyalty_points || 0) - pointsToRedeem}`
            : `Payment complete for ${table.table_name}!`;

        toast.success(successMessage);
        setIsPaymentModalOpen(false); // Close the payment modal
        fetchOrders(new Date(), "all"); // Refresh orders list
        updateTableStatus(table.table_id, 'cleaning'); // Trigger UI update
        onClose(); // Close this modal
    };

    const handleCancelOrder = async () => {
        if (!activeOrder) return;
        
        confirmAlert({
            title: 'Cancel Order',
            message: `Are you sure you want to cancel Order ${activeOrder.order_number}?`,
            buttons: [
                {
                    label: 'Yes, Cancel',
                    onClick: async () => {
                        try {
                            await api.put(`/orders/${activeOrder.order_id}/status`, {
                                status: "cancelled",
                            });
                            await updateTableStatus(table.table_id, "available");
                            toast.success(`Order ${activeOrder.order_number} has been cancelled.`);
                            fetchOrders(new Date(), "all");
                            onClose();
                        } catch (error) {
                            console.error("Error cancelling order:", error);
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

    // Item modification handlers
    const handleUpdateItemQuantity = async (itemIndex: number, newQuantity: number) => {
        if (!fullOrderDetails || newQuantity < 1) return;

        const updatedItems = [...fullOrderDetails.order_items];
        const item = updatedItems[itemIndex];

        item.quantity = newQuantity;
        item.total_price = item.unit_price * newQuantity;

        await updateOrderItems(updatedItems);
    };

    const handleUpdateComplimentaryQty = async (itemIndex: number, newComplimentaryQty: number) => {
        if (!fullOrderDetails) return;

        const updatedItems = [...fullOrderDetails.order_items];
        const item = updatedItems[itemIndex];

        // Clamp complimentary quantity between 0 and item.quantity
        const clampedQty = Math.max(0, Math.min(newComplimentaryQty, item.quantity));
        item.complimentary_quantity = clampedQty;
        // Update is_complimentary flag for backward compatibility
        item.is_complimentary = clampedQty === item.quantity;

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
                            toast.error('Cannot remove all items from order. Cancel the order instead.');
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
        if (!activeOrder) return;

        try {
            setLoadingOrderDetails(true);

            // Calculate new totals - use complimentary_quantity for partial complimentary
            const subtotal = updatedItems.reduce((sum, item) => {
                const compQty = item.complimentary_quantity || 0;
                const chargedQty = item.quantity - compQty;
                return sum + (Number(item.unit_price) * chargedQty);
            }, 0);

            const taxRate = settings?.tax_rate ? Number(settings.tax_rate) / 100 : 0.05;
            const taxAmount = subtotal * taxRate;
            const grandTotal = subtotal + taxAmount;

            const orderData = {
                items: updatedItems.map(item => ({
                    menu_item_id: item.menu_item_id,
                    quantity: item.quantity,
                    unit_price: Number(item.unit_price),
                    total_price: Number(item.total_price),
                    is_complimentary: (item.complimentary_quantity || 0) === item.quantity,
                    complimentary_quantity: item.complimentary_quantity || 0
                })),
                subtotal,
                tax_amount: taxAmount,
                grand_total: grandTotal,
                notes: fullOrderDetails?.notes || ''
            };

            await api.put(`/orders/${activeOrder.order_id}`, orderData);

            // Refresh order details
            const response = await api.get(`/orders/${activeOrder.order_id}`);
            setFullOrderDetails(response.data);

        } catch (error) {
            console.error('Error updating order items:', error);
            toast.error('Failed to update order items');
        } finally {
            setLoadingOrderDetails(false);
        }
    };

    // Payment UI will be rendered inline in the right panel when `isPaymentModalOpen` is true.

    // Handler for when order is accepted from AcceptOrderModal
    const handleOrderAccepted = async () => {
        // Refresh order details to get updated status
        if (activeOrder?.order_id) {
            try {
                const response = await api.get(`/orders/${activeOrder.order_id}`);
                setFullOrderDetails(response.data);
            } catch (error) {
                console.error("Error refreshing order details:", error);
            }
        }
        setOrderAccepted(true);
        fetchOrders(new Date(), "all");
    };



    // This is your existing modal UI
    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-end items-stretch z-50">
            <div className="bg-white shadow-2xl w-full max-w-4xl flex flex-col h-full overflow-auto animate-slide-in-right">
                {/* Header */}
                <div className="flex justify-between items-center p-6 border-b bg-white">
                    <h2 className="text-2xl font-semibold text-gray-800">
                        {table.table_name} - Billing
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Body - Split Layout */}
                <div className="flex-1 flex overflow-hidden">
                    {!activeOrder ? (
                        <div className="flex-1 flex items-center justify-center text-gray-500 py-8">
                            <div className="text-center">
                                <Info size={36} className="mx-auto mb-4" />
                                <p>No active order for this table.</p>
                            </div>
                        </div>
                    ) : (
                        <>
                            {/* Left Side - Order Details (Scrollable) */}
                            <div className="flex-1 max-w-3xl p-6 border-r border-gray-200 flex flex-col min-h-0">
                                <div className="space-y-4 flex-1 flex flex-col min-h-0 overflow-auto">
                                    {/* Order number and date removed as requested */}

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
                                                                        {(item.complimentary_quantity || 0) > 0 && (
                                                                            <span className="px-2 py-0.5 text-xs font-semibold bg-green-100 text-green-700 rounded">
                                                                                {item.complimentary_quantity === item.quantity
                                                                                    ? 'Complimentary'
                                                                                    : `${item.complimentary_quantity}/${item.quantity} Comp`}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    <p className="text-sm text-gray-500">
                                                                        {item.quantity} × {formatCurrency(Number(item.unit_price), settings?.currency || 'OMR')}
                                                                    </p>
                                                                </div>
                                                                <div className="text-right">
                                                                    {(() => {
                                                                        const compQty = item.complimentary_quantity || 0;
                                                                        const chargedQty = item.quantity - compQty;
                                                                        const chargedAmount = Number(item.unit_price) * chargedQty;
                                                                        const compAmount = Number(item.unit_price) * compQty;

                                                                        if (compQty === item.quantity) {
                                                                            // All items complimentary
                                                                            return (
                                                                                <>
                                                                                    <p className="font-semibold text-green-600">
                                                                                        {formatCurrency(0, settings?.currency || 'OMR')}
                                                                                    </p>
                                                                                    <p className="text-xs text-gray-400 line-through">
                                                                                        {formatCurrency(Number(item.total_price), settings?.currency || 'OMR')}
                                                                                    </p>
                                                                                </>
                                                                            );
                                                                        } else if (compQty > 0) {
                                                                            // Partial complimentary
                                                                            return (
                                                                                <>
                                                                                    <p className="font-semibold text-gray-900">
                                                                                        {formatCurrency(chargedAmount, settings?.currency || 'OMR')}
                                                                                    </p>
                                                                                    <p className="text-xs text-green-600">
                                                                                        -{formatCurrency(compAmount, settings?.currency || 'OMR')} comp
                                                                                    </p>
                                                                                </>
                                                                            );
                                                                        } else {
                                                                            // No complimentary
                                                                            return (
                                                                                <>
                                                                                    <p className="font-semibold text-gray-900">
                                                                                        {formatCurrency(Number(item.total_price), settings?.currency || 'OMR')}
                                                                                    </p>
                                                                                    <p className="text-xs text-gray-400">
                                                                                        {selectedItemIndex === index ? 'Close' : 'Edit'}
                                                                                    </p>
                                                                                </>
                                                                            );
                                                                        }
                                                                    })()}
                                                                </div>
                                                            </div>

                                                            {/* Item Controls - Expandable */}
                                                            {selectedItemIndex === index && (
                                                                <div className="border-t border-gray-200 p-3 bg-gray-50 space-y-2">
                                                                    {/* Quantity and Action Buttons - Side by Side */}
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

                                                                        {/* Complimentary Quantity Controls */}
                                                                        <div className="flex items-center gap-1 bg-green-50 border border-green-200 rounded px-2 py-1">
                                                                            <Gift size={12} className="text-green-600" />
                                                                            <button
                                                                                onClick={() => handleUpdateComplimentaryQty(index, (item.complimentary_quantity || 0) - 1)}
                                                                                disabled={(item.complimentary_quantity || 0) <= 0}
                                                                                className="p-1 bg-white border border-green-300 rounded hover:bg-green-100 disabled:opacity-50 disabled:cursor-not-allowed"
                                                                            >
                                                                                <Minus size={12} />
                                                                            </button>
                                                                            <span className="w-6 text-center font-semibold text-xs text-green-700">
                                                                                {item.complimentary_quantity || 0}
                                                                            </span>
                                                                            <button
                                                                                onClick={() => handleUpdateComplimentaryQty(index, (item.complimentary_quantity || 0) + 1)}
                                                                                disabled={(item.complimentary_quantity || 0) >= item.quantity}
                                                                                className="p-1 bg-white border border-green-300 rounded hover:bg-green-100 disabled:opacity-50 disabled:cursor-not-allowed"
                                                                            >
                                                                                <Plus size={12} />
                                                                            </button>
                                                                            <span className="text-xs text-green-600 ml-1">Comp</span>
                                                                        </div>

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
                                                        fullOrderDetails?.subtotal || activeOrder.grand_total || 0,
                                                        settings?.currency || 'OMR'
                                                    )}
                                                </span>
                                            </p>
                                            <p className="flex justify-between text-gray-700">
                                                <span>Tax:</span>
                                                <span className="font-semibold">
                                                    {formatCurrency(
                                                        fullOrderDetails?.tax_amount || 0,
                                                        settings?.currency || 'OMR'
                                                    )}
                                                </span>
                                            </p>
                                            <p className="flex justify-between text-gray-700 text-lg font-bold border-t border-gray-300 pt-2">
                                                <span>Bill Amount:</span>
                                                <span className="font-semibold">
                                                    {formatCurrency(
                                                        fullOrderDetails?.grand_total || activeOrder.grand_total || 0,
                                                        settings?.currency || 'OMR'
                                                    )}
                                                </span>
                                            </p>

                                            {/* Loyalty Points Section */}
                                            {loyaltyPointsEnabled && (
                                                <div className="border-t border-gray-300 pt-2 mt-2">
                                                    {loading ? (<p className="text-sm text-purple-700">Loading customer details...</p>) :
                                                        customerData ? (
                                                            <div className="bg-gradient-to-r from-purple-50 to-pink-50 p-3 rounded-lg border border-purple-200">
                                                                <div className="flex items-center justify-between mb-2">
                                                                    <div className="flex items-center gap-2">
                                                                        <Gift
                                                                            size={18}
                                                                            className="text-purple-600"
                                                                        />
                                                                        <span className="font-semibold text-purple-900">
                                                                            Loyalty Points
                                                                        </span>
                                                                    </div>
                                                                    <span className="font-bold text-purple-700">
                                                                        {customerData.loyalty_points}{" "}
                                                                        pts
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
                                                                                    <p>• Redeeming: {pointsToRedeem} points = OMR{pointsValue.toFixed(2)}</p>
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
                                                    {activeOrder.status}
                                                </span>
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Right Side - Action Buttons (Fixed) */}
                            <div className={`w-96 flex flex-col ${isPaymentModalOpen || (activeOrder && activeOrder.status === 'pending' && activeOrder.order_type === 'delivery') ? 'justify-start' : 'justify-center'} items-stretch p-6 bg-gray-50`}>

                                {/* INLINE ACCEPTANCE UI */}
                                {activeOrder && activeOrder.status === 'pending' && activeOrder.order_type === 'delivery' && !orderAccepted ? (
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
                                                {formatCurrency(activeOrder.grand_total || 0, settings?.currency || "OMR")}
                                            </p>
                                        </div>

                                        <button
                                            onClick={handleOrderAccepted}
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
                                    <>
                                        {/* Inline Payment Panel (shows when isPaymentModalOpen) */}
                                        {isPaymentModalOpen && activeOrder && (
                                            <div className="bg-white rounded-xl shadow p-4 mb-4 flex flex-col flex-1 overflow-auto">
                                                {/* header removed: no label or close button as requested */}

                                                <div className="p-1.5 space-y-4 flex-1 overflow-y-auto hide-scrollbar">
                                                    <div className="bg-gray-50 p-3 rounded-lg text-center">
                                                        <label className="text-base font-medium text-gray-600">Total Amount Due</label>
                                                        <p className="text-3xl font-bold text-blue-600 mt-1">{formatCurrency(finalAmountToPay, settings?.currency || 'OMR')}</p>
                                                        {pointsToRedeem > 0 && (
                                                            <p className="text-sm text-green-600 mt-1">(After {formatCurrency(activeOrder.grand_total - finalAmountToPay, settings?.currency || 'OMR')} discount)</p>
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
                                                        className="flex-1 px-3 py-2.5 bg-gray-200 text-gray-700 rounded-lg font-semibold text-sm opacity-50 cursor-not-allowed text-center whitespace-nowrap"
                                                    >
                                                        Complement
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
                                            <div className="grid grid-cols-2 gap-2">
                                                {/* Combine Tables */}
                                                {onStartCombining && (
                                                    <button
                                                        onClick={() => onStartCombining(table)}
                                                        disabled={table.table_status === "paid"}
                                                        className="px-2 py-2.5 bg-orange-600 text-white rounded-lg font-semibold flex items-center justify-center gap-1.5 text-sm hover:bg-orange-700 disabled:bg-gray-400 transition-colors whitespace-nowrap"
                                                    >
                                                        <ArrowRightLeft size={18} />
                                                        Combine
                                                    </button>
                                                )}

                                                {/* Print - hidden after printing */}
                                                {!printedAndShowPayment && (
                                                    <button
                                                        onClick={handlePrintBill}
                                                        disabled={table.table_status === "paid"}
                                                        className="px-2 py-2.5 bg-blue-600 text-white rounded-lg font-semibold flex items-center justify-center gap-1.5 text-sm hover:bg-blue-700 disabled:bg-gray-400 transition-colors whitespace-nowrap"
                                                    >
                                                        <Printer size={18} />
                                                        Print
                                                    </button>
                                                )}

                                                {/* Cancel */}
                                                <button
                                                    onClick={handleCancelOrder}
                                                    disabled={table.table_status === "paid"}
                                                    className="px-2 py-2.5 bg-red-500 text-white rounded-lg font-semibold flex items-center justify-center gap-1.5 text-sm hover:bg-red-600 disabled:bg-gray-400 transition-colors whitespace-nowrap"
                                                >
                                                    <Ban size={18} />
                                                    Cancel
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="space-y-3">
                                                {/* Combine Tables Button */}
                                                {onStartCombining && (
                                                    <button
                                                        onClick={() => onStartCombining(table)}
                                                        disabled={table.table_status === "paid"}
                                                        className="w-full px-4 py-3 bg-orange-600 text-white rounded-lg font-semibold flex items-center justify-center gap-2 hover:bg-orange-700 disabled:bg-gray-400 transition-colors"
                                                    >
                                                        <ArrowRightLeft size={20} /> Combine Tables
                                                    </button>
                                                )}

                                                {/* Print Bill Button (hidden after printing) */}
                                                {!printedAndShowPayment && (
                                                    <button
                                                        onClick={handlePrintBill}
                                                        disabled={table.table_status === "paid"}
                                                        className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg font-semibold flex items-center justify-center gap-2 hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
                                                    >
                                                        <Printer size={20} /> Print Bill
                                                    </button>
                                                )}

                                                {/* Complete Payment Button (hidden while payment UI is visible) */}
                                                {!isPaymentModalOpen && (
                                                    <button
                                                        onClick={handleOpenPaymentModal}
                                                        disabled={
                                                            table.table_status === "paid" || loading || loadingOrderDetails
                                                        }
                                                        className="w-full px-4 py-3 bg-green-600 text-white rounded-lg font-semibold flex items-center justify-center gap-2 hover:bg-green-700 disabled:bg-gray-400 transition-colors"
                                                    >
                                                        <CheckCircle size={20} />
                                                        Complete Payment
                                                    </button>
                                                )}

                                                {/* Cancel Order Button */}
                                                <button
                                                    onClick={handleCancelOrder}
                                                    disabled={table.table_status === "paid"}
                                                    className="w-full px-4 py-3 bg-red-500 text-white rounded-lg font-semibold flex items-center justify-center gap-2 hover:bg-red-600 disabled:bg-gray-400 transition-colors"
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