import { useState, useEffect } from "react";
import { X, Edit, Trash2, Plus } from "lucide-react";
import { useOrders, type OrderWithItems } from "../hooks/useOrders";
import { useMenuItems } from "../hooks/useMenuItems";
import { useRestaurantSettings } from "../hooks/useRestaurantSettings";
import { formatCurrency, formatOrderType, getStatusBadge } from "../lib/utils";
import type { Database } from "../lib/database.types";

type CartItem = {
    menu_item_id: string;
    quantity: number;
    unit_price: number | string;
    total_price: number | string;
    menu_item_name: string;
};

type MenuItem = Database["public"]["Tables"]["menu_items"]["Row"];

export function OrderDetailsModal({
    order,
    onClose,
}: {
    order: OrderWithItems;
    onClose: () => void;
}) {
    const { updateOrderStatus, updateOrder } = useOrders();
    const { menuItems } = useMenuItems();
    const { settings } = useRestaurantSettings();
    const [isEditing, setIsEditing] = useState(false);
    const [editedCart, setEditedCart] = useState<CartItem[]>([]);
    const [editedNotes, setEditedNotes] = useState(order.notes || "");

    // Get tax rate from settings, default to 5% if not available
    const taxRate = settings?.tax_rate ? Number(settings.tax_rate) / 100 : 0.05;

    useEffect(() => {
        setEditedCart(order.order_items || []);
        setEditedNotes(order.notes || "");
    }, [order]);

    const handleUpdateStatus = async (status: "completed" | "cancelled") => {
        await updateOrderStatus(order.id, status);
        onClose();
    };

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

    const addToCart = (menuItem: MenuItem) => {
        setEditedCart((prevCart) => {
            const existingItem = prevCart.find(
                (item) => item.menu_item_id === menuItem.id
            );
            if (existingItem) {
                const unitPrice =
                    typeof existingItem.unit_price === "string"
                        ? parseFloat(existingItem.unit_price)
                        : existingItem.unit_price;
                const newQuantity = existingItem.quantity + 1;
                return prevCart.map((item) =>
                    item.menu_item_id === menuItem.id
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
                    unit_price: Number(menuItem.price),
                    total_price: Number(menuItem.price),
                    menu_item_name: menuItem.name,
                },
            ];
        });
    };

    const removeFromCart = (menuItemId: string) => {
        setEditedCart((prevCart) =>
            prevCart.filter((item) => item.menu_item_id !== menuItemId)
        );
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

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="flex justify-between items-center p-6 border-b">
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
                    </div>
                    <div>
                        {order.status === "pending" && !isEditing && (
                            <button
                                onClick={() => setIsEditing(true)}
                                className="p-2 rounded-md hover:bg-gray-100 flex items-center gap-2 text-gray-600 font-semibold"
                            >
                                <Edit size={16} /> Edit Order
                            </button>
                        )}
                        <button
                            onClick={onClose}
                            className="text-gray-400 hover:text-gray-600 ml-4"
                        >
                            <X size={24} />
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6 overflow-y-auto">
                    {isEditing && (
                        <div className="md:col-span-1 border-r pr-6">
                            <h3 className="font-semibold text-lg mb-3">
                                Add Items to Order
                            </h3>
                            <div className="space-y-2 max-h-[450px] overflow-y-auto">
                                {menuItems.map((item) => (
                                    <div
                                        key={item.id}
                                        className="flex justify-between items-center p-2 rounded-md hover:bg-gray-50"
                                    >
                                        <div>
                                            <p className="font-medium">
                                                {item.name}
                                            </p>
                                            <p className="text-sm text-gray-500">
                                                {formatCurrency(
                                                    Number(item.price)
                                                )}
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => addToCart(item)}
                                            className="bg-blue-100 text-blue-600 rounded-full w-8 h-8 flex items-center justify-center hover:bg-blue-200"
                                        >
                                            <Plus size={18} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div
                        className={
                            isEditing ? "md:col-span-2" : "md:col-span-3"
                        }
                    >
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

                                return (
                                    <div
                                        key={index}
                                        className="flex justify-between items-center"
                                    >
                                        <div>
                                            <p className="font-medium">
                                                {item.quantity} x{" "}
                                                {item.menu_item_name}
                                            </p>
                                            <p className="text-sm text-gray-500">
                                                @{" "}
                                                {formatCurrency(
                                                    isNaN(unitPrice)
                                                        ? 0
                                                        : unitPrice
                                                )}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <p className="font-semibold">
                                                {formatCurrency(
                                                    isNaN(totalPrice)
                                                        ? 0
                                                        : totalPrice
                                                )}
                                            </p>
                                            {isEditing && (
                                                <button
                                                    onClick={() =>
                                                        removeFromCart(
                                                            item.menu_item_id
                                                        )
                                                    }
                                                    className="text-red-500 hover:text-red-600"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="mt-6 pt-4 border-t space-y-2">
                            <div className="flex justify-between text-gray-600">
                                <p>Subtotal</p>
                                <p>{formatCurrency(subtotal)}</p>
                            </div>
                            <div className="flex justify-between text-gray-600">
                                <p>Tax ({(taxRate * 100).toFixed(0)}%)</p>
                                <p>{formatCurrency(taxAmount)}</p>
                            </div>
                            <div className="flex justify-between font-bold text-lg">
                                <p>Grand Total</p>
                                <p>{formatCurrency(grandTotal)}</p>
                            </div>
                        </div>

                        <div className="mt-6">
                            <h4 className="font-semibold mb-2">Notes</h4>
                            {isEditing ? (
                                <textarea
                                    value={editedNotes}
                                    onChange={(e) =>
                                        setEditedNotes(e.target.value)
                                    }
                                    className="w-full h-24 p-2 border rounded-md"
                                    placeholder="e.g., Less spicy, extra sauce..."
                                ></textarea>
                            ) : (
                                <p className="text-gray-600 bg-gray-50 p-3 rounded-md min-h-[50px]">
                                    {order.notes || "No notes for this order."}
                                </p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer Buttons */}
                <div className="p-4 mt-auto bg-gray-50 rounded-b-xl flex justify-end gap-3 border-t">
                    {isEditing ? (
                        <>
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
                        </>
                    ) : (
                        <>
                            {order.status === "pending" && (
                                <>
                                    <button
                                        onClick={() =>
                                            handleUpdateStatus("cancelled")
                                        }
                                        className="px-4 py-2 bg-red-100 text-red-700 rounded-lg font-semibold hover:bg-red-200"
                                    >
                                        Cancel Order
                                    </button>
                                    <button
                                        onClick={() =>
                                            handleUpdateStatus("completed")
                                        }
                                        className="px-6 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700"
                                    >
                                        Mark as Completed
                                    </button>
                                </>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
