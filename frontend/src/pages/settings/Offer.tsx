// src/pages/settings/Offer.tsx
import React, { useEffect, useMemo, useState } from "react";
import { ChevronLeft, Edit, Trash2, X, Plus, Save, Info } from "lucide-react";
import api from "../../lib/api";

/**
 * Offer management page with new schema support
 * - Flexible offers (item/combo/order level)
 * - Combos management
 * - Deprecated item-offers removed
 */

/* -----------------------------
   Types
------------------------------*/
type MenuItem = {
  id: string;
  name: string;
  price?: number;
  available?: boolean;
  category?: string | null;
  sub_category?: string | null;
};

type OfferSet = {
  id?: number | string;
  name: string;
  discount_percent: number;
  active: boolean;
  menu_item_ids: Array<number | string>;
  apply_dine_in: boolean;
  apply_takeaway: boolean;
  apply_delivery: boolean;
  offer_type?: string;
  discount_type?: string;
  discount_value?: number;
  priority?: number;
  is_stackable?: boolean;
  start_time?: string | null;
  end_time?: string | null;
  created_at?: string;
  updated_at?: string;
};

type ComboItem = {
  menu_item_id: string;
  name?: string;
  price?: number;
  quantity: number;
};

type Combo = {
  id?: string;
  offer_id: number;
  name: string;
  fixed_price: number;
  active: boolean;
  items: ComboItem[];
  offer_name?: string;
  offer_active?: boolean;
  created_at?: string;
};

type Props = {
  onBack: () => void;
};

/* -----------------------------
   Smart API helpers (axios)
------------------------------*/
function baseHasApiPrefix(): boolean {
  try {
    const base = (api as any).defaults?.baseURL;
    return typeof base === "string" && base.includes("/api");
  } catch {
    return false;
  }
}

async function apiGetWithSmartFallback<T = any>(path: string) {
  try {
    const resp = await api.get<T>(path);
    return resp.data;
  } catch (err) {
    if (!path.startsWith("/api") && !baseHasApiPrefix()) {
      const resp2 = await api.get<T>(`/api${path}`);
      return resp2.data;
    }
    throw err;
  }
}
async function apiPostSmart(path: string, body: any) {
  try {
    return await api.post(path, body);
  } catch (err) {
    if (!path.startsWith("/api") && !baseHasApiPrefix()) {
      return await api.post(`/api${path}`, body);
    }
    throw err;
  }
}
async function apiPutSmart(path: string, body: any) {
  try {
    return await api.put(path, body);
  } catch (err) {
    if (!path.startsWith("/api") && !baseHasApiPrefix()) {
      return await api.put(`/api${path}`, body);
    }
    throw err;
  }
}
async function apiDeleteSmart(path: string) {
  try {
    return await api.delete(path);
  } catch (err) {
    if (!path.startsWith("/api") && !baseHasApiPrefix()) {
      return await api.delete(`/api${path}`);
    }
    throw err;
  }
}
async function apiPatchSmart(path: string) {
  try {
    return await api.patch(path);
  } catch (err) {
    if (!path.startsWith("/api") && !baseHasApiPrefix()) {
      return await api.patch(`/api${path}`);
    }
    throw err;
  }
}

/* -----------------------------
   Component
------------------------------*/
export default function OfferSettings({ onBack }: Props) {
  const [tab, setTab] = useState<"offers" | "combos">("offers");

  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [offerSets, setOfferSets] = useState<OfferSet[]>([]);
  const [combos, setCombos] = useState<Combo[]>([]);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Offer Sets form state
  const [newOfferName, setNewOfferName] = useState("");
  const [newOfferDiscount, setNewOfferDiscount] = useState<number>(10);
  const [newOfferSelectedIds, setNewOfferSelectedIds] = useState<Array<number | string>>([]);
  const [editingOfferId, setEditingOfferId] = useState<number | string | null>(null);
  const [applyDineIn, setApplyDineIn] = useState(true);
  const [applyTakeaway, setApplyTakeaway] = useState(true);
  const [applyDelivery, setApplyDelivery] = useState(true);
  const [offerType, setOfferType] = useState<string>("item");
  const [discountType, setDiscountType] = useState<string>("percent");
  const [discountValue, setDiscountValue] = useState<string>("");
  const [priority, setPriority] = useState<string>("100");
  const [isStackable, setIsStackable] = useState(false);
  const [startTime, setStartTime] = useState<string>("");
  const [endTime, setEndTime] = useState<string>("");

  // Combos form state
  const [comboName, setComboName] = useState("");
  const [comboOfferId, setComboOfferId] = useState<number | null>(null);
  const [comboFixedPrice, setComboFixedPrice] = useState<string>("");
  const [comboItems, setComboItems] = useState<ComboItem[]>([]);
  const [editingComboId, setEditingComboId] = useState<string | null>(null);

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchAll() {
    setLoading(true);
    setError(null);
    try {
      // Load menu
      const menuPaths = ["/api/menu", "/api/menu/menu_items", "/menu", "/menu/menu_items"];
      let menuJson: any = null;

      for (const path of menuPaths) {
        try {
          const resp = await api.get(path);
          if (resp && resp.data) {
            if (Array.isArray(resp.data)) {
              menuJson = resp.data;
              break;
            }
            if (Array.isArray(resp.data.rows)) {
              menuJson = resp.data.rows;
              break;
            }
          }
        } catch {
          // ignore and try next
        }
      }

      if (!menuJson) {
        try {
          const maybe = await apiGetWithSmartFallback<MenuItem[]>("/menu");
          if (Array.isArray(maybe)) menuJson = maybe;
        } catch {
          // ignore
        }
      }

      if (!menuJson) {
        throw new Error("Menu load failed");
      }

      setMenuItems(Array.isArray(menuJson) ? menuJson : []);

      // Load offers
      try {
        const offersJson = await apiGetWithSmartFallback<OfferSet[]>("/setting/offers");
        setOfferSets(Array.isArray(offersJson) ? offersJson : []);
      } catch {
        setOfferSets([]);
      }

      // Load combos
      try {
        const combosJson = await apiGetWithSmartFallback<Combo[]>("/setting/combos");
        setCombos(Array.isArray(combosJson) ? combosJson : []);
      } catch {
        setCombos([]);
      }
    } catch (err: any) {
      console.error("fetchAll error:", err);
      setError(err?.message || "Failed to fetch data");
    } finally {
      setLoading(false);
    }
  }

  const toggleSelect = (id: number | string) => {
    setNewOfferSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  // ---- Offer Sets CRUD ----
  async function saveOfferSet(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!newOfferName.trim()) return setError("Offer name required");
    if (newOfferDiscount < 0 || newOfferDiscount > 100)
      return setError("Discount must be 0-100");
    setSaving(true);
    setError(null);
    const payload: OfferSet = {
      name: newOfferName.trim(),
      discount_percent: Number(newOfferDiscount),
      active: true,
      menu_item_ids: newOfferSelectedIds,
      apply_dine_in: applyDineIn,
      apply_takeaway: applyTakeaway,
      apply_delivery: applyDelivery,
      offer_type: offerType,
      discount_type: discountType,
      discount_value: discountValue ? Number(discountValue) : undefined,
      priority: Number(priority),
      is_stackable: offerType === 'combo' ? false : isStackable,
      start_time: startTime || null,
      end_time: endTime || null,
    };
    try {
      if (editingOfferId) {
        await apiPutSmart(`/setting/offers/${editingOfferId}`, payload);
      } else {
        await apiPostSmart("/setting/offers", payload);
      }
      await fetchAll();
      resetOfferForm();
    } catch (err: any) {
      console.error("saveOfferSet error:", err);
      setError(err?.response?.data?.message || err.message || "Failed to save offer");
    } finally {
      setSaving(false);
    }
  }

  function resetOfferForm() {
    setNewOfferName("");
    setNewOfferDiscount(10);
    setNewOfferSelectedIds([]);
    setEditingOfferId(null);
    setApplyDineIn(true);
    setApplyTakeaway(true);
    setApplyDelivery(true);
    setOfferType("item");
    setDiscountType("percent");
    setDiscountValue("");
    setPriority("100");
    setIsStackable(false);
    setStartTime("");
    setEndTime("");
  }

  function startEditOffer(o: OfferSet) {
    setEditingOfferId(o.id ?? null);
    setNewOfferName(o.name);
    setNewOfferDiscount(o.discount_percent);
    setNewOfferSelectedIds(o.menu_item_ids);
    setApplyDineIn(o.apply_dine_in);
    setApplyTakeaway(o.apply_takeaway);
    setApplyDelivery(o.apply_delivery);
    setOfferType(o.offer_type || "item");
    setDiscountType(o.discount_type || "percent");
    setDiscountValue(o.discount_value ? String(o.discount_value) : "");
    setPriority(String(o.priority || 100));
    setIsStackable(o.is_stackable || false);
    setStartTime(o.start_time || "");
    setEndTime(o.end_time || "");
  }

  async function toggleOfferActive(offer: OfferSet) {
    try {
      await apiPatchSmart(`/setting/offers/${offer.id}/toggle`);
      await fetchAll();
    } catch (err: any) {
      console.error(err);
      setError(err?.response?.data?.message || "Failed to toggle offer");
    }
  }

  async function deleteOffer(id?: number | string) {
    if (!id) return;
    if (!confirm("Delete this offer?")) return;
    try {
      await apiDeleteSmart(`/setting/offers/${id}`);
      await fetchAll();
    } catch (err: any) {
      console.error(err);
      setError(err?.response?.data?.message || "Failed to delete offer");
    }
  }

  // ---- Combos CRUD ----
  function addComboItem() {
    setComboItems([...comboItems, { menu_item_id: "", quantity: 1 }]);
  }

  function updateComboItem(index: number, field: keyof ComboItem, value: any) {
    const updated = [...comboItems];
    updated[index] = { ...updated[index], [field]: value };
    setComboItems(updated);
  }

  function removeComboItem(index: number) {
    setComboItems(comboItems.filter((_, i) => i !== index));
  }

  async function saveCombo(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!comboName.trim()) return setError("Combo name required");
    if (!comboOfferId) return setError("Select an offer for this combo");
    if (!comboFixedPrice || Number(comboFixedPrice) <= 0) return setError("Fixed price must be greater than 0");
    if (comboItems.length === 0) return setError("Add at least one item to the combo");
    if (comboItems.some(item => !item.menu_item_id || item.quantity <= 0)) {
      return setError("All combo items must have a menu item and quantity > 0");
    }

    setSaving(true);
    setError(null);
    const payload = {
      offer_id: comboOfferId,
      name: comboName.trim(),
      fixed_price: Number(comboFixedPrice),
      items: comboItems.map(item => ({
        menu_item_id: item.menu_item_id,
        quantity: item.quantity
      })),
      active: true,
    };

    try {
      if (editingComboId) {
        await apiPutSmart(`/setting/combos/${editingComboId}`, payload);
      } else {
        await apiPostSmart("/setting/combos", payload);
      }
      await fetchAll();
      resetComboForm();
    } catch (err: any) {
      console.error("saveCombo error:", err);
      setError(err?.response?.data?.message || err.message || "Failed to save combo");
    } finally {
      setSaving(false);
    }
  }

  function resetComboForm() {
    setComboName("");
    setComboOfferId(null);
    setComboFixedPrice("");
    setComboItems([]);
    setEditingComboId(null);
  }

  function startEditCombo(c: Combo) {
    setEditingComboId(c.id ?? null);
    setComboName(c.name);
    setComboOfferId(c.offer_id);
    setComboFixedPrice(String(c.fixed_price));
    setComboItems(c.items);
  }

  async function toggleComboActive(combo: Combo) {
    try {
      await apiPatchSmart(`/setting/combos/${combo.id}/toggle`);
      await fetchAll();
    } catch (err: any) {
      console.error(err);
      setError(err?.response?.data?.message || "Failed to toggle combo");
    }
  }

  async function deleteCombo(id?: string) {
    if (!id) return;
    if (!confirm("Delete this combo?")) return;
    try {
      await apiDeleteSmart(`/setting/combos/${id}`);
      await fetchAll();
    } catch (err: any) {
      console.error(err);
      setError(err?.response?.data?.message || "Failed to delete combo");
    }
  }

  const menuMap = useMemo(() => {
    const m = new Map<number | string, MenuItem>();
    menuItems.forEach((mi) => m.set(mi.id, mi));
    return m;
  }, [menuItems]);

  const comboOffers = useMemo(() => {
    return offerSets.filter(o => o.offer_type === 'combo');
  }, [offerSets]);

  // UI
  return (
    <div>
      <div className="flex items-center mb-6">
        <button onClick={onBack} className="mr-4 p-2 rounded hover:bg-gray-100">
          <ChevronLeft size={20} />
        </button>
        <h2 className="text-2xl font-semibold">Offer Management</h2>
      </div>

      <div className="bg-white rounded-md shadow-sm p-4">
        <div className="flex gap-3 mb-4">
          <button
            onClick={() => setTab("offers")}
            className={`px-4 py-2 rounded ${tab === "offers" ? "bg-indigo-600 text-white" : "hover:bg-gray-50"}`}
          >
            Offers
          </button>
          <button
            onClick={() => setTab("combos")}
            className={`px-4 py-2 rounded ${tab === "combos" ? "bg-indigo-600 text-white" : "hover:bg-gray-50"}`}
          >
            Combos
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-600 rounded flex items-center justify-between">
            {error}
            <button onClick={() => setError(null)} className="ml-2">
              <X size={14}/>
            </button>
          </div>
        )}

        {loading ? (
          <div className="text-center py-8">Loading...</div>
        ) : tab === "offers" ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* left: form */}
            <form onSubmit={saveOfferSet} className="space-y-4 border-r pr-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium">{editingOfferId ? "Edit Offer" : "Create Offer"}</h3>
                <div className="text-sm text-gray-500">{offerSets.length} total</div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Offer Name</label>
                <input
                  value={newOfferName}
                  onChange={(e) => setNewOfferName(e.target.value)}
                  className="w-full border rounded p-2"
                  placeholder="e.g. Happy Hour"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1 flex items-center gap-1">
                    Offer Type
                    <div className="relative group">
                      <Info size={14} className="text-gray-400 cursor-help" />
                      <div className="absolute left-0 bottom-full mb-2 w-64 p-2 bg-gray-900 text-white text-xs rounded shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-opacity z-10">
                        <strong>Item:</strong> Discount on specific menu items<br/>
                        <strong>Combo:</strong> Bundle multiple items at fixed price<br/>
                        <strong>Order:</strong> Discount on entire order total
                      </div>
                    </div>
                  </label>
                  <select
                    value={offerType}
                    onChange={(e) => setOfferType(e.target.value)}
                    className="w-full border rounded p-2"
                  >
                    <option value="item">Item Level</option>
                    <option value="combo">Combo Deal</option>
                    <option value="order">Order Level</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 flex items-center gap-1">
                    Discount Type
                    <div className="relative group">
                      <Info size={14} className="text-gray-400 cursor-help" />
                      <div className="absolute left-0 bottom-full mb-2 w-64 p-2 bg-gray-900 text-white text-xs rounded shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-opacity z-10">
                        <strong>Percent:</strong> % off (e.g., 20% off)<br/>
                        <strong>Flat:</strong> Fixed amount off (e.g., OMR 5 off)<br/>
                        <strong>Fixed Price:</strong> Set new price<br/>
                        <strong>BOGO:</strong> Buy One Get One
                      </div>
                    </div>
                  </label>
                  <select
                    value={discountType}
                    onChange={(e) => setDiscountType(e.target.value)}
                    className="w-full border rounded p-2"
                  >
                    <option value="percent">Percentage Off</option>
                    <option value="flat">Flat Amount Off</option>
                    <option value="fixed_price">Fixed Price</option>
                    <option value="bogo">Buy One Get One</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {discountType === 'percent' && (
                  <div>
                    <label className="block text-sm font-medium mb-1">Discount Percentage</label>
                    <div className="relative">
                      <input
                        type="number"
                        min={0} max={100}
                        value={newOfferDiscount}
                        onChange={(e) => setNewOfferDiscount(Number(e.target.value))}
                        className="w-full border rounded p-2 pr-8"
                        placeholder="e.g. 20"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">%</span>
                    </div>
                  </div>
                )}
                {(discountType === 'flat' || discountType === 'fixed_price') && (
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      {discountType === 'flat' ? 'Amount Off' : 'New Fixed Price'}
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">OMR</span>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={discountValue}
                        onChange={(e) => setDiscountValue(e.target.value)}
                        className="w-full border rounded p-2 pl-14"
                        placeholder="e.g. 5.00"
                      />
                    </div>
                  </div>
                )}
                {discountType === 'bogo' && (
                  <div className="col-span-2">
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded text-sm text-blue-800">
                      <strong>Buy One Get One:</strong> Customer gets a free item when purchasing one. No additional value needed.
                    </div>
                  </div>
                )}
                {discountType === 'percent' && (
                  <div className="text-sm text-gray-500 flex items-center">
                    Used for percentage-based discounts on items or orders
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1 flex items-center gap-1">
                    Priority
                    <div className="relative group">
                      <Info size={14} className="text-gray-400 cursor-help" />
                      <div className="absolute left-0 bottom-full mb-2 w-64 p-2 bg-gray-900 text-white text-xs rounded shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-opacity z-10">
                        Lower number = higher priority. When multiple offers apply, the one with lowest priority number is used first. Use this to control which offer gets applied when conflicts occur.
                      </div>
                    </div>
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    className="w-full border rounded p-2"
                    placeholder="100 (lower = higher priority)"
                  />
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={offerType === 'combo' ? false : isStackable}
                      onChange={() => setIsStackable(!isStackable)}
                      disabled={offerType === 'combo'}
                      className="w-4 h-4"
                    />
                    <span className="text-sm flex items-center gap-1">
                      Stackable
                      <div className="relative group">
                        <Info size={14} className="text-gray-400 cursor-help" />
                        <div className="absolute left-0 bottom-full mb-2 w-64 p-2 bg-gray-900 text-white text-xs rounded shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-opacity z-10">
                          When enabled, this offer can be combined with other stackable offers. Priority determines order of application. Combos are never stackable.
                        </div>
                      </div>
                    </span>
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Start Time (Optional)</label>
                  <input
                    type="datetime-local"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full border rounded p-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">End Time (Optional)</label>
                  <input
                    type="datetime-local"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full border rounded p-2 text-sm"
                  />
                </div>
              </div>
              {(startTime || endTime) && (
                <div className="text-xs text-gray-600 -mt-2">
                  Offer will only be active during the specified time window
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-1">Applicable For</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={applyDineIn} onChange={() => setApplyDineIn(v => !v)} />
                    Dine-In
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={applyTakeaway} onChange={() => setApplyTakeaway(v => !v)} />
                    Takeaway
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={applyDelivery} onChange={() => setApplyDelivery(v => !v)} />
                    Delivery
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Attach Menu Items</label>
                <div className="max-h-48 overflow-auto border rounded p-2">
                  {menuItems.length === 0 && <div className="text-sm text-gray-500">No menu items</div>}
                  {menuItems.map(mi => {
                    const checked = newOfferSelectedIds.includes(mi.id);
                    return (
                      <label key={mi.id} className="flex items-center gap-2 py-1 hover:bg-gray-50">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleSelect(mi.id)}
                        />
                        <div className="flex-1 text-sm">
                          <div className="font-medium">{mi.name}</div>
                          <div className="text-xs text-gray-500">{mi.category} {mi.sub_category && `• ${mi.sub_category}`}</div>
                        </div>
                        {mi.price !== undefined && <div className="text-sm font-medium">OMR {mi.price}</div>}
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  className="px-4 py-2 rounded bg-indigo-600 text-white disabled:opacity-60 hover:bg-indigo-700 flex items-center gap-2"
                  disabled={saving}
                >
                  {editingOfferId ? (
                    <>
                      <Save size={16} />
                      Save Changes
                    </>
                  ) : (
                    <>
                      <Plus size={16} />
                      Create Offer
                    </>
                  )}
                </button>
                {editingOfferId && (
                  <button
                    type="button"
                    onClick={resetOfferForm}
                    className="px-4 py-2 rounded border hover:bg-gray-50 flex items-center gap-2"
                  >
                    <X size={16} />
                    Cancel
                  </button>
                )}
              </div>
            </form>

            {/* right: list of offer sets */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-medium">Existing Offers</h3>
              </div>

              {offerSets.length === 0 && <div className="text-sm text-gray-500">No offers created yet.</div>}

              <div className="space-y-3 max-h-[600px] overflow-y-auto">
                {offerSets.map(o => (
                  <div key={o.id} className="border rounded p-3 hover:shadow-sm transition">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="font-semibold">{o.name}</div>
                          <div className="text-xs px-2 py-0.5 rounded bg-gray-100">{o.offer_type || 'item'}</div>
                          {o.active ? 
                            <div className="text-xs px-2 py-0.5 rounded bg-green-100 text-green-700">Active</div> : 
                            <div className="text-xs px-2 py-0.5 rounded bg-red-100 text-red-600">Inactive</div>
                          }
                        </div>
                        <div className="text-sm text-gray-600">
                          {o.discount_percent}% • Priority: {o.priority || 100} • {o.menu_item_ids?.length ?? 0} items
                        </div>
                        {o.start_time && (
                          <div className="text-xs text-gray-500 mt-1">
                            {new Date(o.start_time).toLocaleString()} - {o.end_time ? new Date(o.end_time).toLocaleString() : 'No end'}
                          </div>
                        )}
                      </div>

                      <div className="flex gap-1">
                        <button 
                          onClick={() => startEditOffer(o)} 
                          className="p-2 rounded hover:bg-gray-100 text-blue-600" 
                          title="Edit Offer"
                        >
                          <Edit size={16}/>
                        </button>
                        <button 
                          onClick={() => toggleOfferActive(o)} 
                          className={`p-2 rounded hover:bg-gray-100 ${o.active ? 'text-green-600' : 'text-gray-400'}`}
                          title={o.active ? "Deactivate Offer" : "Activate Offer"}
                        >
                          {o.active ? '✓' : '○'}
                        </button>
                        <button 
                          onClick={() => deleteOffer(o.id)} 
                          className="p-2 rounded hover:bg-red-50 text-red-600" 
                          title="Delete Offer"
                        >
                          <Trash2 size={16}/>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          // COMBOS TAB
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <form onSubmit={saveCombo} className="space-y-4 border-r pr-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium">{editingComboId ? "Edit Combo" : "Create Combo"}</h3>
                <div className="text-sm text-gray-500">{combos.length} total</div>
              </div>

              {/* Instructions Box */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm">
                <div className="flex items-start gap-2">
                  <Info size={18} className="text-blue-600 flex-shrink-0 mt-0.5" />
                  <div className="text-blue-900">
                    <strong className="block mb-1">How to Create a Combo Deal:</strong>
                    <ol className="list-decimal list-inside space-y-1 text-xs">
                      <li>First, create an offer with type "Combo Deal" in the Offers tab</li>
                      <li>Come back here and select that offer from the "Linked Offer" dropdown</li>
                      <li>Add specific items with quantities (e.g., 2x Burger, 1x Fries, 1x Drink)</li>
                      <li>Set a fixed price for the entire bundle</li>
                    </ol>
                    <p className="text-xs mt-2 text-blue-700">
                      💡 The offer provides scheduling, priority, and order type rules. The combo defines the actual bundle and price.
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Combo Name</label>
                <input
                  value={comboName}
                  onChange={(e) => setComboName(e.target.value)}
                  className="w-full border rounded p-2"
                  placeholder="e.g. Family Meal Deal"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Linked Offer</label>
                <select
                  value={comboOfferId || ""}
                  onChange={(e) => setComboOfferId(Number(e.target.value) || null)}
                  className="w-full border rounded p-2"
                >
                  <option value="">-- Select Combo Offer --</option>
                  {comboOffers.map(o => (
                    <option key={o.id} value={o.id}>{o.name}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">Only offers with type "combo" are shown</p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Fixed Price</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">OMR</span>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={comboFixedPrice}
                    onChange={(e) => setComboFixedPrice(e.target.value)}
                    className="w-full border rounded p-2 pl-14"
                    placeholder="e.g. 15.00"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">Total price customer pays for this combo</p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium">Combo Items</label>
                  <button
                    type="button"
                    onClick={addComboItem}
                    className="px-2 py-1 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700 flex items-center gap-1"
                  >
                    <Plus size={14} /> Add Item
                  </button>
                </div>
                <div className="space-y-2 max-h-64 overflow-y-auto border rounded p-2">
                  {comboItems.length === 0 && (
                    <div className="text-sm text-gray-500 text-center py-4">No items added yet</div>
                  )}
                  {comboItems.map((item, idx) => (
                    <div key={idx} className="flex gap-2 items-center p-2 border rounded">
                      <select
                        value={item.menu_item_id}
                        onChange={(e) => updateComboItem(idx, 'menu_item_id', e.target.value)}
                        className="flex-1 border rounded p-1 text-sm"
                      >
                        <option value="">-- Select Item --</option>
                        {menuItems.map(mi => (
                          <option key={mi.id} value={mi.id}>{mi.name} - OMR {mi.price}</option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min={1}
                        value={item.quantity}
                        onChange={(e) => updateComboItem(idx, 'quantity', Number(e.target.value))}
                        className="w-16 border rounded p-1 text-sm"
                        placeholder="Qty"
                      />
                      <button
                        type="button"
                        onClick={() => removeComboItem(idx)}
                        className="p-1 text-red-600 hover:bg-red-50 rounded"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  className="px-4 py-2 rounded bg-indigo-600 text-white disabled:opacity-60 hover:bg-indigo-700 flex items-center gap-2"
                  disabled={saving}
                >
                  {editingComboId ? (
                    <>
                      <Save size={16} />
                      Save Changes
                    </>
                  ) : (
                    <>
                      <Plus size={16} />
                      Create Combo
                    </>
                  )}
                </button>
                {editingComboId && (
                  <button
                    type="button"
                    onClick={resetComboForm}
                    className="px-4 py-2 rounded border hover:bg-gray-50 flex items-center gap-2"
                  >
                    <X size={16} />
                    Cancel
                  </button>
                )}
              </div>
            </form>

            {/* list */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-medium">Existing Combos</h3>
              </div>

              {combos.length === 0 && <div className="text-sm text-gray-500">No combos created yet.</div>}

              <div className="space-y-3 max-h-[600px] overflow-y-auto">
                {combos.map(c => {
                  const totalRegularPrice = c.items.reduce((sum, item) => {
                    const mi = menuMap.get(item.menu_item_id);
                    return sum + ((mi?.price || 0) * item.quantity);
                  }, 0);
                  const savings = totalRegularPrice - c.fixed_price;

                  return (
                    <div key={c.id} className="border rounded p-3 hover:shadow-sm transition">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <div className="font-semibold">{c.name}</div>
                            {c.active ? 
                              <div className="text-xs px-2 py-0.5 rounded bg-green-100 text-green-700">Active</div> : 
                              <div className="text-xs px-2 py-0.5 rounded bg-red-100 text-red-600">Inactive</div>
                            }
                          </div>
                          <div className="text-sm text-gray-600 mb-2">
                            Fixed Price: OMR {c.fixed_price.toFixed(2)} • Save: OMR {savings.toFixed(2)}
                          </div>
                          <div className="text-xs text-gray-500">
                            {c.items.map((item, idx) => {
                              const mi = menuMap.get(item.menu_item_id);
                              return (
                                <div key={idx}>
                                  {item.quantity}x {mi?.name || `Item ${item.menu_item_id}`}
                                </div>
                              );
                            })}
                          </div>
                          {c.offer_name && (
                            <div className="text-xs text-gray-500 mt-1">Linked to: {c.offer_name}</div>
                          )}
                        </div>

                        <div className="flex gap-1">
                          <button 
                            onClick={() => startEditCombo(c)} 
                            className="p-2 rounded hover:bg-gray-100 text-blue-600" 
                            title="Edit Combo"
                          >
                            <Edit size={16}/>
                          </button>
                          <button 
                            onClick={() => toggleComboActive(c)} 
                            className={`p-2 rounded hover:bg-gray-100 ${c.active ? 'text-green-600' : 'text-gray-400'}`}
                            title={c.active ? "Deactivate Combo" : "Activate Combo"}
                          >
                            {c.active ? '✓' : '○'}
                          </button>
                          <button 
                            onClick={() => deleteCombo(c.id)} 
                            className="p-2 rounded hover:bg-red-50 text-red-600" 
                            title="Delete Combo"
                          >
                            <Trash2 size={16}/>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
