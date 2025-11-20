// CreateOrderModal.tsx
import { useState, useMemo, useEffect } from "react";
import { X, Trash2, Plus, ChevronDown, ChevronRight } from "lucide-react";
import { useMenuItems } from "../hooks/useMenuItems";
import { useOrders, type OrderCreatePayload } from "../hooks/useOrders";
import { useSettings } from "../hooks/useSettings"; // Import the settings hook
import api from "../lib/api";
import {
  calculateTax,
  calculateGrandTotal,
  formatCurrency,
  generateOrderNumber,
} from "../lib/utils";
import type { Database } from "../lib/database.types";

type MenuItem = Database["public"]["Tables"]["menu_items"]["Row"];
type OrderItemInsert = Database["public"]["Tables"]["order_items"]["Insert"];
type CartItem = Omit<OrderItemInsert, "order_id" | "id" | "created_at"> & {
  menu_item_name: string;
};

export function CreateOrderModal({ onClose }: { onClose: () => void }) {
  const { menuItems } = useMenuItems();
  const { createOrder } = useOrders();
  const { layout: tableLayout } = useSettings(); // Get the table layout data

  // State Management
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [orderType, setOrderType] = useState<
    "dine_in" | "take_away" | "delivery"
  >("dine_in");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // New state for conditional fields
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [takeAwayMethod, setTakeAwayMethod] = useState<"counter" | "car">(
    "counter"
  );
  const [carDetails, setCarDetails] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");

  // Collapsible state for categories/subcategories
  const [expandedMain, setExpandedMain] = useState<string | null>(null); // main category name
  const [expandedSub, setExpandedSub] = useState<Record<string, string | null>>({}); // key: mainCategory -> subCategory

  // Add item or increment in cart
  const addToCart = (menuItem: MenuItem) => {
    // Check if item has stock tracking and if stock is available
    const currentStock = menuItem.stock ?? 0;
    const currentCartQty = getCartQuantity(menuItem.id);
    
    // If stock is 0 or adding would exceed available stock, show alert
    if (currentStock === 0) {
      alert(`${menuItem.name} is out of stock.`);
      return;
    }
    
    if (currentCartQty >= currentStock) {
      alert(`Cannot add more ${menuItem.name}. Only ${currentStock} available in stock.`);
      return;
    }
    
    setCart((prevCart) => {
      const existingItem = prevCart.find(
        (item) => item.menu_item_id === menuItem.id
      );
      if (existingItem) {
        return prevCart.map((item) =>
          item.menu_item_id === menuItem.id
            ? {
                ...item,
                quantity: item.quantity + 1,
                total_price: (item.quantity + 1) * Number(item.unit_price),
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

  // Decrease quantity (from menu or cart). If quantity reaches 0, remove item.
  const decreaseFromMenu = (menuItem: MenuItem) => {
    setCart((prevCart) =>
      prevCart
        .map((i) =>
          i.menu_item_id === menuItem.id
            ? {
                ...i,
                quantity: i.quantity - 1,
                total_price: (i.quantity - 1) * Number(i.unit_price),
              }
            : i
        )
        .filter((i) => i.quantity > 0)
    );
  };

  // Remove completely from cart
  const removeFromCart = (menuItemId: string) => {
    setCart((prevCart) =>
      prevCart.filter((item) => item.menu_item_id !== menuItemId)
    );
  };

  const { subtotal, taxAmount, grandTotal } = useMemo(() => {
    const sub = cart.reduce((sum, item) => sum + item.total_price, 0);
    const tax = calculateTax(sub);
    const grand = calculateGrandTotal(sub, tax);
    return { subtotal: sub, taxAmount: tax, grandTotal: grand };
  }, [cart]);

  const handleSubmit = async () => {
    if (cart.length === 0) return alert("Cannot create an empty order.");

    // Validation: Dine-in orders must have a table assigned
    if (orderType === "dine_in" && !selectedTable) {
      return alert("Please select a table for dine-in orders.");
    }

    // Validation: Delivery orders must have an address
    if (orderType === "delivery" && !deliveryAddress.trim()) {
      return alert("Please enter a delivery address.");
    }

    setIsSubmitting(true);

    const orderPayload: OrderCreatePayload = {
      order_number: generateOrderNumber(),
      customer_name: customerName,
      mobile_number: mobileNumber,
      order_type: orderType,
      subtotal,
      tax_amount: taxAmount,
      grand_total: grandTotal,
      status: "pending",
      notes: null,
      restaurant_table_id: orderType === "dine_in" ? selectedTable : null,
      take_away_method: orderType === "take_away" ? takeAwayMethod : null,
      car_details:
        orderType === "take_away" && takeAwayMethod === "car"
          ? carDetails
          : null,
      delivery_address: orderType === "delivery" ? deliveryAddress : null,
    };

    const itemsPayload = cart.map(({ menu_item_name, ...item }) => item);
    const result = await createOrder(orderPayload, itemsPayload);
    setIsSubmitting(false);

    if (result.success) {
      onClose();
    }
  };

  // Auto-fetch customer by phone number and populate name if exists
  useEffect(() => {
    const fetchByPhone = async () => {
      const phone = mobileNumber.trim();
      if (phone.length === 0) return;
      try {
        const res = await api.get(
          `/customers/phone/${encodeURIComponent(phone)}`
        );
        if (res && res.data) {
          if (res.data.name) setCustomerName(res.data.name);
        }
      } catch (err) {
        // ignore
      }
    };

    const timer = setTimeout(fetchByPhone, 400);
    return () => clearTimeout(timer);
  }, [mobileNumber]);

  // --- Conditional Input Components ---
  const DineInOptions = () => {
    const allTables: Array<{
      tableId: string;
      tableName: string;
      sectionName: string;
      floorName: string;
      status: string;
      isAvailable: boolean;
    }> = [];

    tableLayout.forEach((floor) => {
      (floor.sections || []).forEach((section) => {
        (section.tables || []).forEach((table) => {
          const tableStatus = table.table_status || "available";
          const available = tableStatus === "available";

          allTables.push({
            tableId: table.table_id,
            tableName: table.table_name,
            sectionName: section.section_name,
            floorName: floor.floor_name,
            status: tableStatus,
            isAvailable: available,
          });
        });
      });
    });

    const availableCount = allTables.filter((t) => t.isAvailable).length;

    return (
      <div className="mt-2">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Select Table <span className="text-red-500">*</span>
        </label>
        <select
          value={selectedTable || ""}
          onChange={(e) => {
            const selectedTableId = e.target.value;
            if (selectedTableId) {
              setSelectedTable(selectedTableId);
            }
          }}
          className={`w-full px-3 py-2 border rounded-md bg-white ${
            !selectedTable ? "border-red-300 bg-red-50" : "border-gray-300"
          }`}
          required
        >
          <option value="" disabled>
            {availableCount > 0
              ? "Select an available table"
              : "No tables available"}
          </option>
          {tableLayout.map((floor) => {
            const floorTables = allTables.filter(
              (t) => t.floorName === floor.floor_name
            );
            if (floorTables.length === 0) return null;

            const availableInFloor = floorTables.filter((t) => t.isAvailable)
              .length;

            return (
              <optgroup
                label={`${floor.floor_name} (${availableInFloor}/${floorTables.length} available)`}
                key={floor.floor_id}
              >
                {(floor.sections || []).map((section) =>
                  (section.tables || []).map((table) => {
                    const isAvailable = table.table_status === "available";
                    const statusLabel =
                      table.table_status === "cleaning"
                        ? "🧹 Cleaning"
                        : table.table_status === "occupied"
                        ? "👥 Occupied"
                        : table.table_status === "bill_printed"
                        ? "🧾 Bill Printed"
                        : "";

                    return (
                      <option
                        key={table.table_id}
                        value={table.table_id}
                        disabled={!isAvailable}
                        style={{
                          color: isAvailable ? "inherit" : "#9ca3af",
                          fontStyle: isAvailable ? "normal" : "italic",
                        }}
                      >
                        {`${table.table_name} - ${section.section_name}`}
                        {!isAvailable && ` (${statusLabel})`}
                      </option>
                    );
                  })
                )}
              </optgroup>
            );
          })}
        </select>
        {availableCount === 0 && (
          <p className="text-sm text-red-600 mt-1">
            ⚠️ All tables are currently occupied. Please wait for a table to
            become available or choose a different order type.
          </p>
        )}
        {!selectedTable && availableCount > 0 && (
          <p className="text-sm text-gray-500 mt-1">
            Available tables shown in black, unavailable tables greyed out
          </p>
        )}
      </div>
    );
  };

  const TakeAwayOptions = () => (
    <div className="mt-2 space-y-2">
      <div className="flex gap-4">
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name="takeaway"
            value="counter"
            checked={takeAwayMethod === "counter"}
            onChange={() => setTakeAwayMethod("counter")}
          />{" "}
          Counter
        </label>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name="takeaway"
            value="car"
            checked={takeAwayMethod === "car"}
            onChange={() => setTakeAwayMethod("car")}
          />{" "}
          Car
        </label>
      </div>
      {takeAwayMethod === "car" && (
        <input
          type="text"
          value={carDetails}
          onChange={(e) => setCarDetails(e.target.value)}
          placeholder="Enter Car Number / Details"
          className="w-full px-3 py-2 border rounded-md"
        />
      )}
    </div>
  );

  const DeliveryOptions = () => (
    <textarea
      value={deliveryAddress}
      onChange={(e) => setDeliveryAddress(e.target.value)}
      placeholder="Enter Delivery Address"
      className="w-full px-3 py-2 border rounded-md mt-2 h-24"
    />
  );

  // group menu items by main -> sub -> items
  const grouped = useMemo(() => {
    // structure: { [main]: { [sub]: MenuItem[] } }
    const g: Record<string, Record<string, MenuItem[]>> = {};
    (menuItems || []).forEach((m) => {
      const main = m.category ?? "Uncategorized";
      const sub = m.sub_category ?? "-";
      if (!g[main]) g[main] = {};
      if (!g[main][sub]) g[main][sub] = [];
      g[main][sub].push(m);
    });
    return g;
  }, [menuItems]);

  // Helper: get quantity for a menu item in the cart
  const getCartQuantity = (menuItemId: string) => {
    const it = cart.find((c) => c.menu_item_id === menuItemId);
    return it ? it.quantity : 0;
  };

  // toggle main expansion
  const toggleMain = (main: string) => {
    setExpandedMain((prev) => (prev === main ? null : main));
  };

  // toggle sub expansion for a main
  const toggleSub = (main: string, sub: string) => {
    setExpandedSub((prev) => ({
      ...prev,
      [main]: prev[main] === sub ? null : sub,
    }));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-2xl font-semibold text-gray-800">Create New Order</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={24} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 overflow-y-auto">
          {/* Left side: Menu grouped by category->subcategory */}
          <div className="border-r pr-6">
            <h3 className="font-semibold text-lg mb-3">Menu (grouped)</h3>

            <div className="space-y-2 max-h-[450px] overflow-y-auto">
              {Object.keys(grouped).length === 0 && (
                <p className="text-gray-500 text-center py-6">No menu items available.</p>
              )}

              {Object.entries(grouped).map(([main, subs]) => {
                const totalSubCount = Object.keys(subs).length;
                const mainOpen = expandedMain === main;
                return (
                  <div key={main} className="border rounded-md overflow-hidden">
                    <button
                      type="button"
                      onClick={() => toggleMain(main)}
                      className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 hover:bg-gray-100"
                    >
                      <div className="flex items-center gap-3">
                        <div className="text-gray-700 font-medium">{main}</div>
                        <div className="text-xs text-gray-500">{totalSubCount} sub</div>
                      </div>
                      <div>
                        {mainOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                      </div>
                    </button>

                    {mainOpen && (
                      <div className="bg-white px-2 py-2 space-y-2">
                        {Object.entries(subs).map(([sub, items]) => {
                          const subOpen = expandedSub[main] === sub;
                          return (
                            <div key={sub} className="rounded-md">
                              <div className="flex items-center justify-between px-2 py-1">
                                <button
                                  type="button"
                                  onClick={() => toggleSub(main, sub)}
                                  className="flex items-center gap-2 text-left w-full"
                                >
                                  <div className="text-sm text-gray-700">{sub === "-" ? <em className="text-gray-400">No sub</em> : sub}</div>
                                  <div className="text-xs text-gray-400">({items.length})</div>
                                </button>
                                {/* No "Add" near subcategory as requested */}
                                <div>
                                  {subOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                </div>
                              </div>

                              {subOpen && (
                                <div className="pl-4 pr-2 pb-2 space-y-2">
                                  {items.map((item) => {
                                    const qty = getCartQuantity(item.id);
                                    const currentStock = item.stock ?? 0;
                                    const isOutOfStock = currentStock === 0;
                                    const isLowStock = currentStock > 0 && currentStock <= (item.low_stock_threshold ?? 5);
                                    const canAddMore = qty < currentStock;
                                    
                                    return (
                                      <div key={item.id} className={`flex items-center justify-between p-2 rounded ${isOutOfStock ? 'bg-red-50 opacity-60' : 'hover:bg-gray-50'}`}>
                                        <div className="flex-1">
                                          <div className="flex items-center gap-2">
                                            <div className="font-medium text-sm">{item.name}</div>
                                            {isOutOfStock && (
                                              <span className="text-xs font-semibold text-red-700 bg-red-100 px-2 py-0.5 rounded">Out of Stock</span>
                                            )}
                                            {!isOutOfStock && isLowStock && (
                                              <span className="text-xs font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded">Low Stock</span>
                                            )}
                                          </div>
                                          <div className="flex items-center gap-2 text-xs text-gray-500">
                                            <span>{formatCurrency(Number(item.price))}</span>
                                            {!isOutOfStock && (
                                              <span className="text-gray-400">• Stock: {currentStock}</span>
                                            )}
                                          </div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                          {qty > 0 ? (
                                            <button
                                              onClick={() => decreaseFromMenu(item)}
                                              className="bg-gray-100 text-gray-800 rounded-full w-8 h-8 flex items-center justify-center hover:bg-gray-200"
                                              title="Decrease"
                                            >
                                              −
                                            </button>
                                          ) : (
                                            <div style={{ width: 32 }} />
                                          )}

                                          {qty > 0 && (
                                            <div className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-sm font-medium">{qty}</div>
                                          )}

                                          <button
                                            onClick={() => addToCart(item)}
                                            disabled={isOutOfStock || !canAddMore}
                                            className={`rounded-full w-8 h-8 flex items-center justify-center ${
                                              isOutOfStock || !canAddMore
                                                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                                : 'bg-blue-100 text-blue-600 hover:bg-blue-200'
                                            }`}
                                            title={
                                              isOutOfStock 
                                                ? 'Out of stock' 
                                                : !canAddMore 
                                                ? `Maximum ${currentStock} available`
                                                : 'Add'
                                            }
                                          >
                                            <Plus size={14} />
                                          </button>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right side: Order Details */}
          <div>
            <div className="space-y-2">
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Customer Name"
                className="w-full px-3 py-2 border rounded-md"
              />
              <input
                type="text"
                value={mobileNumber}
                onChange={(e) => setMobileNumber(e.target.value)}
                placeholder="Mobile Number (Optional)"
                className="w-full px-3 py-2 border rounded-md"
              />
              <select
                value={orderType}
                onChange={(e) => setOrderType(e.target.value as any)}
                className="w-full px-3 py-2 border rounded-md bg-white"
              >
                <option value="dine_in">Dine In</option>
                <option value="take_away">Take Away</option>
                <option value="delivery">Delivery</option>
              </select>

              {orderType === "dine_in" && <DineInOptions />}
              {orderType === "take_away" && <TakeAwayOptions />}
              {orderType === "delivery" && <DeliveryOptions />}
            </div>

            <div className="mt-4 border-t pt-4">
              <h3 className="font-semibold text-lg mb-3">Current Order</h3>
              <div className="space-y-3">
                {cart.map((item) => (
                  <div key={item.menu_item_id} className="flex justify-between items-center">
                    <div>
                      <p className="font-medium">{item.menu_item_name}</p>
                      <p className="text-sm text-gray-500">Qty: {item.quantity}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <p>{formatCurrency(item.total_price)}</p>
                      <button onClick={() => {
                        setCart((prevCart) =>
                          prevCart
                            .map((i) =>
                              i.menu_item_id === item.menu_item_id
                                ? {
                                    ...i,
                                    quantity: i.quantity - 1,
                                    total_price: (i.quantity - 1) * Number(i.unit_price),
                                  }
                                : i
                            )
                            .filter((i) => i.quantity > 0)
                        );
                      }} className="bg-gray-100 rounded-full w-8 h-8 flex items-center justify-center hover:bg-gray-200">−</button>

                      <button onClick={() => {
                        const menu = menuItems.find(m => m.id === item.menu_item_id);
                        if (menu) addToCart(menu);
                      }} className="bg-blue-100 text-blue-600 rounded-full w-8 h-8 flex items-center justify-center hover:bg-blue-200">
                        <Plus size={14} />
                      </button>

                      <button onClick={() => removeFromCart(item.menu_item_id)} className="text-red-500 hover:text-red-600">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}

                {cart.length === 0 && (
                  <p className="text-gray-500 text-center py-4">Select items from the menu to start an order.</p>
                )}
              </div>
            </div>

            {cart.length > 0 && (
              <div className="mt-4 border-t pt-4 space-y-2">
                <div className="flex justify-between text-gray-600">
                  <p>Subtotal</p>
                  <p>{formatCurrency(subtotal)}</p>
                </div>
                <div className="flex justify-between text-gray-600">
                  <p>Tax</p>
                  <p>{formatCurrency(taxAmount)}</p>
                </div>
                <div className="flex justify-between font-bold text-lg">
                  <p>Grand Total</p>
                  <p>{formatCurrency(grandTotal)}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 mt-auto bg-gray-50 rounded-b-xl flex justify-end gap-3 border-t">
          <button onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg font-semibold hover:bg-gray-300">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={
              isSubmitting ||
              cart.length === 0 ||
              (orderType === "dine_in" && !selectedTable) ||
              (orderType === "delivery" && !deliveryAddress.trim())
            }
            className="px-6 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed"
            title={
              orderType === "dine_in" && !selectedTable
                ? "Please select a table for dine-in orders"
                : orderType === "delivery" && !deliveryAddress.trim()
                ? "Please enter a delivery address"
                : cart.length === 0
                ? "Add items to the order"
                : ""
            }
          >
            {isSubmitting ? "Creating..." : "Create Order"}
          </button>
        </div>
      </div>
    </div>
  );
}
