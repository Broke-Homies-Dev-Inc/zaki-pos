import { X, Printer, CheckCircle, Ban, Info, Gift } from "lucide-react";
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

    // All your existing loyalty logic is kept
    const [customerData, setCustomerData] = useState<CustomerData | null>(null);
    const [usePoints, setUsePoints] = useState(false);
    const [pointsToRedeem, setPointsToRedeem] = useState(0);
    const [loading, setLoading] = useState(false);

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
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="flex justify-between items-center p-6 border-b">
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

                {/* Body (Your existing loyalty logic UI) */}
                <div className="p-6 overflow-y-auto">
                    {!activeOrder ? (
                        <div className="text-center text-gray-500 py-8">
                            <Info size={36} className="mx-auto mb-4" />
                            <p>No active order for this table.</p>
                        </div>
                    ) : (
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
                            <div className="border-t pt-4">
                                <h3 className="font-semibold text-lg mb-2">
                                    Order Summary
                                </h3>
                                <div className="bg-gray-50 p-3 rounded-md space-y-2">
                                    <p className="flex justify-between text-gray-700">
                                        <span>Bill Amount:</span>
                                        <span className="font-semibold">
                                            {formatCurrency(
                                                activeOrder.grand_total
                                            )}
                                        </span>
                                    </p>

                                    {/* Loyalty Points Section (Unchanged) */}
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
                                                            {customerData.loyalty_points
                                                            }{" "}
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
                                                                        <p>• Redeeming: {pointsToRedeem} points = ₹{pointsValue.toFixed(2)}</p>
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

                                    {/* Final Amount (Unchanged) */}
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
                                            {formatCurrency(finalAmountToPay)}
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
                    )}
                </div>

                {/* Footer with Billing Actions */}
                <div className="p-4 mt-auto bg-gray-50 rounded-b-xl flex flex-col gap-3 border-t">
                    {activeOrder ? (
                        <>
                            <button
                                onClick={handlePrintBill}
                                disabled={table.table_status === "paid"}
                                className="px-4 py-3 bg-blue-600 text-white rounded-lg font-semibold flex items-center justify-center gap-2 hover:bg-blue-700 disabled:bg-gray-400"
                            >
                                <Printer size={20} /> Print Bill
                            </button>
                            
                            {/* 6. This button now opens the new modal */}
                            <button
                                onClick={handleOpenPaymentModal}
                                disabled={
                                    table.table_status === "paid" || loading
                                }
                                className="px-4 py-3 bg-green-600 text-white rounded-lg font-semibold flex items-center justify-center gap-2 hover:bg-green-700 disabled:bg-gray-400"
                            >
                                <CheckCircle size={20} />
                                {loading
                                    ? "Loading Customer..."
                                    : `Complete Payment ${
                                        usePoints && pointsToRedeem > 0
                                            ? `(${formatCurrency(
                                                amountAfterRedemption
                                            )})`
                                            : ""
                                    }`}
                            </button>
                            <button
                                onClick={handleCancelOrder}
                                disabled={table.table_status === "paid"}
                                className="px-4 py-3 bg-red-500 text-white rounded-lg font-semibold flex items-center justify-center gap-2 hover:bg-red-600 disabled:bg-gray-400"
                            >
                                <Ban size={20} /> Cancel Order
                            </button>
                        </>
                    ) : (
                        <button
                            onClick={onClose}
                            className="px-4 py-3 bg-gray-200 text-gray-800 rounded-lg font-semibold hover:bg-gray-300"
                        >
                            Close
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}