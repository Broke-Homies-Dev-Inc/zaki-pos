import { useState, useEffect, useMemo } from "react";
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
  portion_name?: string | null;
};

type MenuItem = Database["public"]["Tables"]["menu_items"]["Row"];
type Portion = { name: string; price: number };

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

  const taxRate = settings?.tax_rate ? Number(settings.tax_rate) / 100 : 0.05;

  useEffect(() => {
    setEditedCart(order.order_items || []);
    setEditedNotes(order.notes || "");
  }, [order]);

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

        // sort: items without sub first
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

  // -------- STATUS / SAVE --------
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

  // -------- CART OPERATIONS (with portions) --------
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

  const subtotal = editedCart.reduce((sum, item) => {
    const price =
      typeof item.total_price === "string"
        ? parseFloat(item.total_price)
        : item.total_price;
    return sum + (isNaN(price) ? 0 : price);
  }, 0);
  const taxAmount = subtotal * taxRate;
  const grandTotal = subtotal + taxAmount;

  // Show “Chicken biriyani (Half)”
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

  // -------- RENDER --------
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
          {/* LEFT: MENU (grouped like Create Order) */}
          {isEditing && (
            <div className="md:col-span-1 border-r pr-6">
              <h3 className="font-semibold text-lg mb-3">Menu (grouped)</h3>
              <div className="space-y-3 max-h-[450px] overflow-y-auto">
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
                                      {formatCurrency(Number(item.price))}
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
                                        {formatCurrency(Number(p.price))}
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
          )}

          {/* RIGHT: CURRENT ORDER */}
          <div className={isEditing ? "md:col-span-2" : "md:col-span-3"}>
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

                return (
                  <div
                    key={index}
                    className="flex justify-between items-center"
                  >
                    <div>
                      <p className="font-medium">
                        {item.quantity} x {displayName}
                      </p>
                      <p className="text-sm text-gray-500">
                        @ {formatCurrency(isNaN(unitPrice) ? 0 : unitPrice)}
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <p className="font-semibold">
                        {formatCurrency(isNaN(totalPrice) ? 0 : totalPrice)}
                      </p>
                      {isEditing && (
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
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Totals */}
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

            {/* Notes */}
            <div className="mt-6">
              <h4 className="font-semibold mb-2">Notes</h4>
              {isEditing ? (
                <textarea
                  value={editedNotes}
                  onChange={(e) => setEditedNotes(e.target.value)}
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

        {/* Footer */}
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
                    onClick={() => handleUpdateStatus("cancelled")}
                    className="px-4 py-2 bg-red-100 text-red-700 rounded-lg font-semibold hover:bg-red-200"
                  >
                    Cancel Order
                  </button>
                  <button
                    onClick={() => handleUpdateStatus("completed")}
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
