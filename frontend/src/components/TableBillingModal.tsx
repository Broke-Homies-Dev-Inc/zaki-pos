import { X, Printer, CheckCircle, Ban, Info, Gift } from "lucide-react";
import { useState, useEffect } from "react";
import type { RestaurantTable } from "../hooks/useSettings";
import { useOrders } from "../hooks/useOrders";
import { useSettings } from "../hooks/useSettings";
import { useRestaurantSettings } from "../hooks/useRestaurantSettings";
import { formatCurrency, formatDateTime } from "../lib/utils";
import { printBill } from "../lib/printBill";
import api from "../lib/api";

interface TableBillingModalProps {
    table: RestaurantTable;
    onClose: () => void;
}

interface CustomerData {
    loyalty_points: number;
    name: string;
    mobile_number: string;
}

export function TableBillingModal({ table, onClose }: TableBillingModalProps) {
    const { fetchOrders } = useOrders();
    const { updateTableStatus } = useSettings();
    const { settings } = useRestaurantSettings();
    const activeOrder = table.active_order;

    const [customerData, setCustomerData] = useState<CustomerData | null>(null);
    const [usePoints, setUsePoints] = useState(false);
    const [pointsToRedeem, setPointsToRedeem] = useState(0);
    const [loading, setLoading] = useState(false);

    // Fetch customer data if order has customer
    useEffect(() => {
        const fetchCustomerData = async () => {
            if (!activeOrder?.order_id) return;

            try {
                const orderResponse = await api.get(
                    `/orders/${activeOrder.order_id}`
                );
                const order = orderResponse.data;

                if (order.customer_name && order.mobile_number) {
                    // Fetch customer's current loyalty points
                    const customerResponse = await api.get(
                        `/customers/phone/${order.mobile_number}`
                    );
                    setCustomerData({
                        loyalty_points:
                            customerResponse.data.loyalty_points || 0,
                        name: order.customer_name,
                        mobile_number: order.mobile_number,
                    });
                }
            } catch (error) {
                console.error("Error fetching customer data:", error);
            }
        };

        fetchCustomerData();
    }, [activeOrder]);

    // Calculate redemption details
    const loyaltyPointsEnabled = settings?.loyalty_points_enabled !== false;
    const canRedeemPoints = customerData && customerData.loyalty_points >= 200;
    // Use dynamic points_value from settings (default: 0.1 means 10 points = ₹1)
    const pointValueRate = settings?.points_value || 0.1;
    const pointsValue = pointsToRedeem * pointValueRate;
    const billAmount = activeOrder?.grand_total || 0;
    const maxRedeemablePoints = Math.min(
        customerData?.loyalty_points || 0,
        Math.floor(billAmount / pointValueRate) // Can't redeem more than bill amount
    );
    const amountAfterRedemption = Math.max(0, billAmount - pointsValue);

    const handlePrintBill = async () => {
        if (!activeOrder) return;

        // Print the bill
        printBill({ table });

        // Update table status to 'bill_printed'
        await updateTableStatus(table.table_id, "bill_printed");
        onClose();
    };

    const handleCompletePayment = async () => {
        if (!activeOrder) return;

        const finalAmount = usePoints ? amountAfterRedemption : billAmount;
        const confirmMessage = usePoints
            ? `Redeem ${pointsToRedeem} points (₹${pointsValue.toFixed(
                  2
              )})\nFinal amount to pay: ${formatCurrency(
                  finalAmount
              )}\n\nConfirm payment?`
            : `Confirm payment for ${formatCurrency(finalAmount)}?`;

        if (!window.confirm(confirmMessage)) return;

        try {
            setLoading(true);

            // Complete the payment with redemption info
            await api.put(`/setting/orders/${activeOrder.order_id}/complete`, {
                tableId: table.table_id,
                status: "completed",
                pointsRedeemed: usePoints ? pointsToRedeem : 0,
                finalAmount: finalAmount,
                customerId: customerData ? activeOrder.order_id : null, // Will be resolved on backend
            });

            const successMessage = usePoints
                ? `Payment complete!\n\n✅ Redeemed: ${pointsToRedeem} points\n💰 Paid: ${formatCurrency(
                      finalAmount
                  )}\n🎉 Remaining points: ${
                      customerData!.loyalty_points - pointsToRedeem
                  }`
                : `Payment complete for ${table.table_name}!`;

            alert(successMessage);
            fetchOrders(new Date(), "all");
            onClose();
        } catch (error) {
            console.error("Error completing payment:", error);
            alert("Failed to complete payment.");
        } finally {
            setLoading(false);
        }
    };

    const handleCancelOrder = async () => {
        if (!activeOrder) return;
        if (
            !window.confirm(
                `Are you sure you want to cancel Order ${activeOrder.order_number}?`
            )
        )
            return;

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

                {/* Body */}
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

                                    {/* Loyalty Points Redemption Section */}
                                    {loyaltyPointsEnabled && customerData && (
                                        <div className="border-t border-gray-300 pt-2 mt-2">
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
                                                        {
                                                            customerData.loyalty_points
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
                                                                checked={
                                                                    usePoints
                                                                }
                                                                onChange={(
                                                                    e
                                                                ) => {
                                                                    setUsePoints(
                                                                        e.target
                                                                            .checked
                                                                    );
                                                                    if (
                                                                        e.target
                                                                            .checked &&
                                                                        pointsToRedeem ===
                                                                            0
                                                                    ) {
                                                                        // Auto-select 200 points by default
                                                                        setPointsToRedeem(
                                                                            Math.min(
                                                                                200,
                                                                                maxRedeemablePoints
                                                                            )
                                                                        );
                                                                    }
                                                                }}
                                                                className="w-4 h-4 text-purple-600"
                                                            />
                                                            <label
                                                                htmlFor="usePoints"
                                                                className="text-sm font-medium text-purple-900 cursor-pointer"
                                                            >
                                                                Redeem Points
                                                                (10 pts = ₹1)
                                                            </label>
                                                        </div>

                                                        {usePoints && (
                                                            <div className="space-y-2">
                                                                <div className="flex items-center gap-2">
                                                                    <input
                                                                        type="range"
                                                                        min="200"
                                                                        max={
                                                                            maxRedeemablePoints
                                                                        }
                                                                        step="10"
                                                                        value={
                                                                            pointsToRedeem
                                                                        }
                                                                        onChange={(
                                                                            e
                                                                        ) =>
                                                                            setPointsToRedeem(
                                                                                Number(
                                                                                    e
                                                                                        .target
                                                                                        .value
                                                                                )
                                                                            )
                                                                        }
                                                                        className="flex-1"
                                                                    />
                                                                    <input
                                                                        type="number"
                                                                        min="200"
                                                                        max={
                                                                            maxRedeemablePoints
                                                                        }
                                                                        step="10"
                                                                        value={
                                                                            pointsToRedeem
                                                                        }
                                                                        onChange={(
                                                                            e
                                                                        ) => {
                                                                            const val =
                                                                                Number(
                                                                                    e
                                                                                        .target
                                                                                        .value
                                                                                );
                                                                            if (
                                                                                val >=
                                                                                    200 &&
                                                                                val <=
                                                                                    maxRedeemablePoints
                                                                            ) {
                                                                                setPointsToRedeem(
                                                                                    val
                                                                                );
                                                                            }
                                                                        }}
                                                                        className="w-20 px-2 py-1 border border-purple-300 rounded text-sm"
                                                                    />
                                                                </div>
                                                                <div className="text-xs text-purple-700 space-y-1">
                                                                    <p>
                                                                        •
                                                                        Redeeming:{" "}
                                                                        {
                                                                            pointsToRedeem
                                                                        }{" "}
                                                                        points =
                                                                        ₹
                                                                        {pointsValue.toFixed(
                                                                            2
                                                                        )}
                                                                    </p>
                                                                    <p>
                                                                        •
                                                                        Remaining
                                                                        after
                                                                        payment:{" "}
                                                                        {customerData.loyalty_points -
                                                                            pointsToRedeem}{" "}
                                                                        pts
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <p className="text-xs text-purple-700 mt-1">
                                                        {customerData.loyalty_points <
                                                        200
                                                            ? `Need ${
                                                                  200 -
                                                                  customerData.loyalty_points
                                                              } more points to redeem (min: 200)`
                                                            : "Points available for redemption"}
                                                    </p>
                                                )}
                                            </div>

                                            {usePoints &&
                                                pointsToRedeem > 0 && (
                                                    <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded">
                                                        <p className="flex justify-between text-sm text-green-700">
                                                            <span>
                                                                Points Discount:
                                                            </span>
                                                            <span className="font-semibold">
                                                                -₹
                                                                {pointsValue.toFixed(
                                                                    2
                                                                )}
                                                            </span>
                                                        </p>
                                                    </div>
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
                                            {formatCurrency(
                                                usePoints
                                                    ? amountAfterRedemption
                                                    : activeOrder.grand_total
                                            )}
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
                            <button
                                onClick={handleCompletePayment}
                                disabled={
                                    table.table_status === "paid" || loading
                                }
                                className="px-4 py-3 bg-green-600 text-white rounded-lg font-semibold flex items-center justify-center gap-2 hover:bg-green-700 disabled:bg-gray-400"
                            >
                                <CheckCircle size={20} />
                                {loading
                                    ? "Processing..."
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
