import { X, Printer, CheckCircle, Ban, Info, Gift, Trash2, Plus, Minus } from "lucide-react";
import { useState, useEffect } from "react";
import type { RestaurantTable } from "../hooks/useSettings";
import { useOrders } from "../hooks/useOrders";
import { useSettings } from "../hooks/useSettings";
import { useRestaurantSettings } from "../hooks/useRestaurantSettings";
import { formatCurrency, formatDateTime } from "../lib/utils";
import { printBill } from "../lib/printBill";
import api from "../lib/api";
import { PaymentModal } from "./PaymentModal"; // 1. Import the PaymentModal

interface TableBillingModalProps {
    table: RestaurantTable;
    onClose: () => void;
}

interface CustomerData {
    id: string; // We need the customer ID for the API
    loyalty_points: number;
    name: string;
    mobile_number: string;
}

export function TableBillingModal({ table, onClose }: TableBillingModalProps) {
    const { fetchOrders } = useOrders();
    const { updateTableStatus } = useSettings();
    const { settings } = useRestaurantSettings();
    const activeOrder = table.active_order;

    // 2. Add state to control the new Payment Modal
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);

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
            if (e.key === 'Escape' && !isPaymentModalOpen && activeOrder) {
                onClose();
            }
        };

        if (!isPaymentModalOpen && activeOrder) {
            document.addEventListener('keydown', onKeyDown);
        }

        return () => {
            document.removeEventListener('keydown', onKeyDown);
        };
    }, [isPaymentModalOpen, activeOrder, onClose]);

    // All your existing calculations are kept
    const loyaltyPointsEnabled = settings?.loyalty_points_enabled !== false;
    const minPointsToRedeem = settings?.min_points_to_redeem || 200; // Use setting or default
    const canRedeemPoints = customerData && customerData.loyalty_points >= minPointsToRedeem;
    const pointValueRate = settings?.points_value || 0.1;
    const pointsValue = pointsToRedeem * pointValueRate;
    const billAmount = activeOrder?.grand_total || 0;
    const maxRedeemablePoints = Math.min(
        customerData?.loyalty_points || 0,
        Math.floor(billAmount / pointValueRate)
    );
    const amountAfterRedemption = Math.max(0, billAmount - pointsValue);
    const finalAmountToPay = usePoints ? amountAfterRedemption : billAmount;


    const handlePrintBill = async () => {
        if (!activeOrder) return;
        printBill({ table });
        await updateTableStatus(table.table_id, "bill_printed");
        onClose();
    };

    // Quick Pay handler - instantly complete payment with cash
    const handleQuickPay = async () => {
        if (!activeOrder) return;
        
        try {
            const paymentData = {
                payments: [
                    {
                        method: 'cash',
                        amount: finalAmountToPay
                    }
                ],
                points_redeemed: usePoints ? pointsToRedeem : 0,
                customer_id: customerData?.id || null
            };

            await api.put(`/setting/orders/${activeOrder.order_id}/complete`, paymentData);
            
            alert(`Quick payment completed!\n✅ Paid: ${formatCurrency(finalAmountToPay, settings?.currency || 'OMR')}`);
            fetchOrders(new Date(), "all");
            updateTableStatus(table.table_id, 'cleaning');
            onClose();
        } catch (error) {
            console.error("Error completing quick payment:", error);
            alert("Failed to complete payment.");
        }
    };

    // 3. This function is RENAMED and now just opens the Payment Modal
    const handleOpenPaymentModal = () => {
        setIsPaymentModalOpen(true);
    };
    
    // 4. This function is passed to the PaymentModal to run on success
    const onPaymentSuccess = () => {
        const successMessage = usePoints
            ? `Payment complete!\n\n✅ Redeemed: ${pointsToRedeem} points\n💰 Paid: ${formatCurrency(finalAmountToPay)}\n🎉 Remaining points: ${(customerData?.loyalty_points || 0) - pointsToRedeem}`
            : `Payment complete for ${table.table_name}!`;
        
        alert(successMessage);
        setIsPaymentModalOpen(false); // Close the payment modal
        fetchOrders(new Date(), "all"); // Refresh orders list
        updateTableStatus(table.table_id, 'cleaning'); // Trigger UI update
        onClose(); // Close this modal
    };

    const handleCancelOrder = async () => {
        if (!activeOrder) return;
        if (!window.confirm(`Are you sure you want to cancel Order ${activeOrder.order_number}?`)) return;

        try {
            await api.put(`/orders/${activeOrder.order_id}/status`, {
                status: "cancelled",
            });
            await updateTableStatus(table.table_id, "available");
            alert(`Order ${activeOrder.order_number} has been cancelled.`);
            fetchOrders(new Date(), "all");
            onClose();
        } catch (error) {
            console.error("Error cancelling order:", error);
            alert("Failed to cancel order.");
        }
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

    const handleToggleComplimentary = async (itemIndex: number) => {
        if (!fullOrderDetails) return;
        
        const updatedItems = [...fullOrderDetails.order_items];
        const item = updatedItems[itemIndex];
        
        // Toggle complimentary flag - this ensures the item is not added to final cost
        item.is_complimentary = !item.is_complimentary;
        
        await updateOrderItems(updatedItems);
    };

    const handleRemoveItem = async (itemIndex: number) => {
        if (!fullOrderDetails) return;
        if (!window.confirm('Are you sure you want to remove this item?')) return;
        
        const updatedItems = fullOrderDetails.order_items.filter((_: any, index: number) => index !== itemIndex);
        
        if (updatedItems.length === 0) {
            alert('Cannot remove all items. Please cancel the order instead.');
            return;
        }
        
        await updateOrderItems(updatedItems);
        setSelectedItemIndex(null);
    };

    const updateOrderItems = async (updatedItems: any[]) => {
        if (!activeOrder) return;
        
        try {
            setLoadingOrderDetails(true);
            
            // Calculate new totals - exclude complimentary items from the cost
            const subtotal = updatedItems.reduce((sum, item) => {
                // Only add to subtotal if item is not complimentary
                if (item.is_complimentary) return sum;
                return sum + Number(item.total_price);
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
                    is_complimentary: item.is_complimentary || false
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
            alert('Failed to update order items');
        } finally {
            setLoadingOrderDetails(false);
        }
    };

    // 5. Conditionally render the PaymentModal and pass props
    if (isPaymentModalOpen && activeOrder) {
        return (
            <PaymentModal
                table={table}
                // Pass all the calculated data to the payment modal
                finalAmountToPay={finalAmountToPay}
                pointsToRedeem={usePoints ? pointsToRedeem : 0}
                customerData={customerData ? { id: customerData.id } : null}
                onClose={() => setIsPaymentModalOpen(false)}
                onPaymentSuccess={onPaymentSuccess}
            />
        );
    }

    // This is your existing modal UI
    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-end items-stretch z-50">
            <div className="bg-white shadow-2xl w-full max-w-4xl flex flex-col h-full overflow-hidden animate-slide-in-right">
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
                            <div className="flex-1 overflow-y-auto p-6 border-r border-gray-200">
                                <div className="space-y-4">
                                    <p className="text-gray-700">
                                        Order Number:{" "}
                                        <span className="font-medium">
                                            {activeOrder.order_number}
                                        </span>
                                    </p>
                                    <p className="text-gray-700">
                                        Order Placed:{" "}
                                        <span className="font-medium">
                                            {formatDateTime(activeOrder.created_at)}
                                        </span>
                                    </p>

                                    {/* Order Items Section */}
                                    <div className="border-t pt-4">
                                        <h3 className="font-semibold text-lg mb-3">
                                            Order Items
                                        </h3>
                                        {loadingOrderDetails ? (
                                            <div className="bg-white border border-gray-200 rounded-lg p-4 text-center text-gray-500">
                                                Loading order details...
                                            </div>
                                        ) : (
                                            <div className="space-y-2">
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

                                                                        {/* Make Complimentary Button */}
                                                                        <button
                                                                            onClick={() => handleToggleComplimentary(index)}
                                                                            className={`px-2 py-1.5 text-xs font-semibold rounded flex items-center justify-center gap-1 whitespace-nowrap ${
                                                                                item.is_complimentary
                                                                                    ? 'bg-green-600 text-white hover:bg-green-700'
                                                                                    : 'bg-white border border-green-600 text-green-600 hover:bg-green-50'
                                                                            }`}
                                                                        >
                                                                            <Gift size={12} />
                                                                            {item.is_complimentary ? 'Complimentary' : 'Complimentary'}
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
                                                className={`flex justify-between text-lg font-bold pt-2 ${
                                                    usePoints && pointsToRedeem > 0
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
                            <div className="w-80 flex flex-col justify-center p-6 bg-gray-50">
                                <div className="space-y-3">
                                    {/* Print Bill Button */}
                                    <button
                                        onClick={handlePrintBill}
                                        disabled={table.table_status === "paid"}
                                        className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg font-semibold flex items-center justify-center gap-2 hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
                                    >
                                        <Printer size={20} /> Print Bill
                                    </button>
                                    
                                    {/* Quick Pay Button */}
                                    <button
                                        onClick={handleQuickPay}
                                        disabled={
                                            table.table_status === "paid" || loading || loadingOrderDetails
                                        }
                                        className="w-full px-4 py-3 bg-purple-600 text-white rounded-lg font-semibold flex items-center justify-center gap-2 hover:bg-purple-700 disabled:bg-gray-400 transition-colors"
                                    >
                                        <CheckCircle size={20} />
                                        {loading || loadingOrderDetails
                                            ? "Loading..."
                                            : `Quick Pay (Cash)`}
                                    </button>

                                    {/* Complete Payment Button */}
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

                                    {/* Cancel Order Button */}
                                    <button
                                        onClick={handleCancelOrder}
                                        disabled={table.table_status === "paid"}
                                        className="w-full px-4 py-3 bg-red-500 text-white rounded-lg font-semibold flex items-center justify-center gap-2 hover:bg-red-600 disabled:bg-gray-400 transition-colors"
                                    >
                                        <Ban size={20} /> Cancel Order
                                    </button>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}