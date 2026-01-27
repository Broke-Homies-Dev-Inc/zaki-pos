import { useEffect, useCallback } from "react";
import { X, CheckCircle } from "lucide-react";
import { toast } from "react-toastify";
import type { RestaurantTable } from "../hooks/useSettings";
import { useRestaurantSettings } from "../hooks/useRestaurantSettings";
import { formatCurrency } from "../lib/utils";
import { printKot } from "../lib/printKot";
import api from "../lib/api";

interface AcceptOrderModalProps {
    table: RestaurantTable;
    orderDetails: any;
    onAccepted: () => void;
    onClose: () => void;
}

export function AcceptOrderModal({ table, orderDetails, onAccepted, onClose }: AcceptOrderModalProps) {
    const { settings } = useRestaurantSettings();
    const activeOrder = table.active_order;

    const handleAcceptOrder = useCallback(async () => {
        if (!activeOrder) return;

        try {
            // Call printKot function
            const kotPrinted = await printKot(activeOrder.order_id);

            if (kotPrinted) {
                // Update order status to 'confirmed'
                await api.put(`/orders/${activeOrder.order_id}/status`, {
                    status: "confirmed",
                });

                onAccepted();
            }
        } catch (error) {
            console.error("Error accepting order:", error);
            toast.error("Failed to accept order. Please try again.");
        }
    }, [activeOrder, onAccepted]);

    // Handle Enter key press
    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Enter") {
                e.preventDefault();
                handleAcceptOrder();
            } else if (e.key === "Escape") {
                onClose();
            }
        };

        document.addEventListener("keydown", onKeyDown);
        return () => document.removeEventListener("keydown", onKeyDown);
    }, [handleAcceptOrder, onClose]);

    if (!activeOrder) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
                {/* Header */}
                <div className="flex justify-between items-center p-5 border-b bg-gradient-to-r from-orange-500 to-orange-600">
                    <h2 className="text-xl font-bold text-white">
                        Accept Order - {table.table_name}
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-white/80 hover:text-white transition-colors"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-6">
                    {/* Order Info */}
                    <div className="bg-gray-50 rounded-lg p-4">
                        <div className="flex justify-between items-center mb-3">
                            <span className="text-gray-600">Order Number</span>
                            <span className="font-bold text-lg">{activeOrder.order_number}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-gray-600">Status</span>
                            <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm font-semibold">
                                Pending
                            </span>
                        </div>
                    </div>

                    {/* Order Items */}
                    {orderDetails?.order_items && orderDetails.order_items.length > 0 && (
                        <div>
                            <h3 className="font-semibold text-gray-700 mb-3">Order Items</h3>
                            <div className="space-y-2 max-h-48 overflow-y-auto">
                                {orderDetails.order_items.map((item: any, index: number) => (
                                    <div
                                        key={index}
                                        className="flex justify-between items-center bg-white border border-gray-200 rounded-lg p-3"
                                    >
                                        <div>
                                            <p className="font-medium text-gray-900">
                                                {item.menu_item_name}
                                            </p>
                                            <p className="text-sm text-gray-500">
                                                Qty: {item.quantity}
                                            </p>
                                        </div>
                                        <span className="font-semibold text-gray-700">
                                            {formatCurrency(Number(item.total_price), settings?.currency || "OMR")}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Total */}
                    <div className="bg-blue-50 rounded-lg p-4">
                        <div className="flex justify-between items-center">
                            <span className="text-lg font-semibold text-blue-900">Total Amount</span>
                            <span className="text-2xl font-bold text-blue-700">
                                {formatCurrency(
                                    orderDetails?.grand_total || activeOrder.grand_total || 0,
                                    settings?.currency || "OMR"
                                )}
                            </span>
                        </div>
                    </div>

                    {/* Action Hint */}
                    <p className="text-center text-sm text-gray-500">
                        Press <kbd className="px-2 py-1 bg-gray-200 rounded text-gray-700 font-mono">Enter</kbd> or click the button below to accept
                    </p>
                </div>

                {/* Footer */}
                <div className="p-5 bg-gray-50 border-t">
                    <button
                        onClick={handleAcceptOrder}
                        className="w-full px-6 py-4 bg-green-600 text-white rounded-lg font-bold text-lg flex items-center justify-center gap-3 hover:bg-green-700 transition-colors shadow-lg"
                    >
                        <CheckCircle size={24} />
                        Accept Order
                    </button>
                </div>
            </div>
        </div>
    );
}
