// src/pages/settings/Offer.tsx
import React, { useEffect, useMemo, useState } from "react";
import { ChevronLeft, Edit, Trash2, Check, X } from "lucide-react";
import api from "../../lib/api";

/**
 * Offer management page
 *
 * This component expects your backend API to be reachable by the `api` axios instance.
 * It will try multiple endpoints to find the menu list (so we don't need backend edits).
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
  created_at?: string;
  updated_at?: string;
};

type ItemOffer = {
  id?: number | string;
  menu_item_id: number | string;
  discount_percent: number;
  active: boolean;
  created_at?: string;
  updated_at?: string;
};

type Props = {
  onBack: () => void;
};

/* -----------------------------
   Smart API helpers (axios)
   - These try /api-prefixed endpoint if direct fails.
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
  const [tab, setTab] = useState<"sets" | "items">("sets");

  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [offerSets, setOfferSets] = useState<OfferSet[]>([]);
  const [itemOffers, setItemOffers] = useState<ItemOffer[]>([]);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Offer Sets form state
  const [newOfferName, setNewOfferName] = useState("");
  const [newOfferDiscount, setNewOfferDiscount] = useState<number>(10);
  const [newOfferSelectedIds, setNewOfferSelectedIds] = useState<
    Array<number | string>
  >([]);
  const [editingOfferId, setEditingOfferId] = useState<number | string | null>(
    null
  );
  
  const [applyDineIn, setApplyDineIn] = useState(true);
  const [applyTakeaway, setApplyTakeaway] = useState(true);
  const [applyDelivery, setApplyDelivery] = useState(true);


  // Item offers form state
  const [selectedItemForOffer, setSelectedItemForOffer] = useState<
    number | string | null
  >(null);
  const [itemOfferDiscount, setItemOfferDiscount] = useState<number>(10);
  const [
    editingItemOfferId,
    setEditingItemOfferId,
  ] = useState<number | string | null>(null);

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* -----------------------------
     fetchAll: tries multiple menu endpoints
     and then loads offers / item-offers via smart helper
  ------------------------------*/
  async function fetchAll() {
    setLoading(true);
    setError(null);
    try {
      // Likely menu endpoints (tries explicit /api first)
      const menuPaths = [
        "/api/menu",
        "/api/menu/menu_items",
        "/menu",
        "/menu/menu_items",
      ];

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

      // fallback to the smart helper for "/menu"
      if (!menuJson) {
        try {
          const maybe = await apiGetWithSmartFallback<MenuItem[]>("/menu");
          if (Array.isArray(maybe)) menuJson = maybe;
        } catch {
          // ignore
        }
      }

      if (!menuJson) {
        throw new Error(
          "Menu load failed (no working endpoint found). Tried /api/menu, /api/menu/menu_items, /menu, /menu/menu_items"
        );
      }

      setMenuItems(Array.isArray(menuJson) ? menuJson : []);

      // Load offers and item-offers using smart helper (mounted under /setting router)
      try {
        const offersJson = await apiGetWithSmartFallback<OfferSet[]>(
          "/setting/offers"
        );
        setOfferSets(Array.isArray(offersJson) ? offersJson : []);
      } catch {
        setOfferSets([]);
      }

      try {
        const itemOffersJson = await apiGetWithSmartFallback<ItemOffer[]>(
          "/setting/item-offers"
        );
        setItemOffers(Array.isArray(itemOffersJson) ? itemOffersJson : []);
      } catch {
        setItemOffers([]);
      }
    } catch (err: any) {
      console.error("fetchAll error:", err);
      setError(err?.message || "Failed to fetch data");
    } finally {
      setLoading(false);
    }
  }

  // Toggle selection in multi-select
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
      apply_delivery: applyDelivery
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
  }

  function startEditOffer(o: OfferSet) {
  setEditingOfferId(o.id ?? null);
  setNewOfferName(o.name);
  setNewOfferDiscount(o.discount_percent);
  setNewOfferSelectedIds(o.menu_item_ids);
  setApplyDineIn(o.apply_dine_in);
  setApplyTakeaway(o.apply_takeaway);
  setApplyDelivery(o.apply_delivery);
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
    if (!confirm("Delete this offer set?")) return;
    try {
      await apiDeleteSmart(`/setting/offers/${id}`);
      await fetchAll();
    } catch (err: any) {
      console.error(err);
      setError(err?.response?.data?.message || "Failed to delete offer");
    }
  }

  // ---- Item Offers CRUD ----
  async function saveItemOffer(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!selectedItemForOffer) return setError("Select a menu item");
    if (itemOfferDiscount < 0 || itemOfferDiscount > 100)
      return setError("Discount 0-100");
    setSaving(true); setError(null);
    const payload: ItemOffer = {
      menu_item_id: selectedItemForOffer,
      discount_percent: Number(itemOfferDiscount),
      active: true,
    };
    try {
      if (editingItemOfferId) {
        await apiPutSmart(`/setting/item-offers/${editingItemOfferId}`, payload);
      } else {
        await apiPostSmart("/setting/item-offers", payload);
      }
      await fetchAll();
      resetItemOfferForm();
    } catch (err: any) {
      console.error(err);
      setError(err?.response?.data?.message || "Failed to save item offer");
    } finally {
      setSaving(false);
    }
  }

  function resetItemOfferForm() {
    setSelectedItemForOffer(null);
    setItemOfferDiscount(10);
    setEditingItemOfferId(null);
  }

  async function toggleItemOfferActive(io: ItemOffer) {
    try {
      await apiPatchSmart(`/setting/item-offers/${io.id}/toggle`);
      await fetchAll();
    } catch (err: any) {
      console.error(err);
      setError(err?.response?.data?.message || "Failed to toggle item offer");
    }
  }

  async function deleteItemOffer(id?: number | string) {
    if (!id) return;
    if (!confirm("Delete this item offer?")) return;
    try {
      await apiDeleteSmart(`/setting/item-offers/${id}`);
      await fetchAll();
    } catch (err: any) {
      console.error(err);
      setError(err?.response?.data?.message || "Failed to delete item offer");
    }
  }

  const menuMap = useMemo(() => {
    const m = new Map<number | string, MenuItem>();
    menuItems.forEach((mi) => m.set(mi.id, mi));
    return m;
  }, [menuItems]);

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
            onClick={() => setTab("sets")}
            className={`px-4 py-2 rounded ${tab === "sets" ? "bg-gray-100" : "hover:bg-gray-50"}`}
          >
            Offer Sets
          </button>
          <button
            onClick={() => setTab("items")}
            className={`px-4 py-2 rounded ${tab === "items" ? "bg-gray-100" : "hover:bg-gray-50"}`}
          >
            Item Offers
          </button>
        </div>

        {error && (
          <div className="mb-4 text-red-600">{error} <button onClick={() => setError(null)} className="ml-2"><X size={14}/></button></div>
        )}

        {loading ? (
          <div>Loading...</div>
        ) : tab === "sets" ? (
          <div className="grid grid-cols-2 gap-6">
            {/* left: form */}
            <form onSubmit={saveOfferSet} className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium">{editingOfferId ? "Edit Offer Set" : "Create Offer Set"}</h3>
                <div className="text-sm text-gray-500">{offerSets.length} sets</div>
              </div>

              <div>
                <label className="block text-sm font-medium">Offer Name</label>
                <input
                  value={newOfferName}
                  onChange={(e) => setNewOfferName(e.target.value)}
                  className="w-full border rounded p-2"
                  placeholder="e.g. Happy Hour"
                />
              </div>

              <div>
                <label className="block text-sm font-medium">Discount (%)</label>
                <input
                  type="number"
                  min={0} max={100}
                  value={newOfferDiscount}
                  onChange={(e) => setNewOfferDiscount(Number(e.target.value))}
                  className="w-32 border rounded p-2"
                />
              </div>
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
                <div className="max-h-40 overflow-auto border rounded p-2">
                  {menuItems.length === 0 && <div className="text-sm text-gray-500">No menu items</div>}
                  {menuItems.map(mi => {
                    const checked = newOfferSelectedIds.includes(mi.id);
                    return (
                      <label key={mi.id} className="flex items-center gap-2 py-1">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleSelect(mi.id)}
                        />
                        <div className="flex-1 text-sm">
                          <div className="font-medium">{mi.name}</div>
                          <div className="text-xs text-gray-500">{mi.category ?? ""} {mi.sub_category ? `• ${mi.sub_category}` : ""}</div>
                        </div>
                        {mi.price !== undefined && <div className="text-sm font-medium">OMR {mi.price}</div>}
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  className="px-4 py-2 rounded bg-indigo-600 text-white disabled:opacity-60"
                  disabled={saving}
                >
                  {editingOfferId ? "Save Offer" : "Create Offer"}
                </button>
                <button
                  type="button"
                  onClick={resetOfferForm}
                  className="px-4 py-2 rounded border"
                >
                  Reset
                </button>
              </div>
            </form>

            {/* right: list of offer sets */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-medium">Existing Offer Sets</h3>
                <div className="text-sm text-gray-500">Quick actions</div>
              </div>

              {offerSets.length === 0 && <div className="text-sm text-gray-500">No offers created yet.</div>}

              <div className="space-y-3">
                {offerSets.map(o => (
                  <div key={o.id} className="border rounded p-3 flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <div className="font-semibold">{o.name}</div>
                        <div className="text-sm text-gray-600">· {o.discount_percent}%</div>
                        <div className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-700">{o.menu_item_ids?.length ?? 0} items</div>
                        {o.active ? <div className="text-xs text-green-600">Active</div> : <div className="text-xs text-red-500">Inactive</div>}
                      </div>
                      <div className="text-sm text-gray-600 mt-1">
                        { (o.menu_item_ids || []).slice(0,4).map((id:any)=> menuMap.get(id)?.name).filter(Boolean).join(", ") || "— no items attached —" }
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-2">
                      <div className="flex gap-2">
                        <button onClick={() => startEditOffer(o)} className="p-2 rounded hover:bg-gray-50">
                          <Edit size={16}/>
                        </button>
                        <button onClick={() => toggleOfferActive(o)} className="p-2 rounded hover:bg-gray-50">
                          <Check size={16}/>
                        </button>
                        <button onClick={() => deleteOffer(o.id)} className="p-2 rounded hover:bg-gray-50 text-red-600">
                          <Trash2 size={16}/>
                        </button>
                      </div>
                      <div className="text-xs text-gray-500">{o.created_at ? new Date(o.created_at).toLocaleString() : ""}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          // ITEM OFFERS TAB
          <div className="grid grid-cols-2 gap-6">
            <form onSubmit={saveItemOffer} className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium">{editingItemOfferId ? "Edit Item Offer" : "Create Item Offer"}</h3>
                <div className="text-sm text-gray-500">{itemOffers.length} item offers</div>
              </div>

              <div>
                <label className="block text-sm font-medium">Select Menu Item</label>
                <select
                  value={selectedItemForOffer ?? ""}
                  onChange={(e) => setSelectedItemForOffer(e.target.value === "" ? null : e.target.value)}
                  className="w-full border rounded p-2"
                >
                  <option value="">-- pick an item --</option>
                  {menuItems.map(mi => (
                    <option key={mi.id} value={mi.id}>{mi.name} {mi.price !== undefined ? `- OMR ${mi.price}` : ""}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium">Discount (%)</label>
                <input
                  type="number"
                  min={0} max={100}
                  value={itemOfferDiscount}
                  onChange={(e) => setItemOfferDiscount(Number(e.target.value))}
                  className="w-32 border rounded p-2"
                />
              </div>

              <div className="flex gap-2">
                <button className="px-4 py-2 rounded bg-indigo-600 text-white" disabled={saving}>
                  {editingItemOfferId ? "Save Item Offer" : "Create Item Offer"}
                </button>
                <button type="button" onClick={resetItemOfferForm} className="px-4 py-2 rounded border">Reset</button>
              </div>
            </form>

            {/* list */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-medium">Active Item Offers</h3>
                <div className="text-sm text-gray-500">Manage item level discounts</div>
              </div>

              {itemOffers.length === 0 && <div className="text-sm text-gray-500">No item offers yet.</div>}

              <div className="space-y-3">
                {itemOffers.map(io => {
                  const mi = menuMap.get(io.menu_item_id);
                  return (
                    <div key={io.id} className="border rounded p-3 flex items-start justify-between">
                      <div className="flex-1">
                        <div className="font-medium">{mi?.name ?? `Item ${io.menu_item_id}`}</div>
                        <div className="text-sm text-gray-600 mt-1">{io.discount_percent}% • {io.active ? "Active" : "Inactive"}</div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <div className="flex gap-2">
                          <button onClick={() => {
                            setEditingItemOfferId(io.id ?? null);
                            setSelectedItemForOffer(io.menu_item_id);
                            setItemOfferDiscount(Number(io.discount_percent || 0));
                            setTab("items");
                          }} className="p-2 rounded hover:bg-gray-50">
                            <Edit size={16}/>
                          </button>
                          <button onClick={() => toggleItemOfferActive(io)} className="p-2 rounded hover:bg-gray-50">
                            <Check size={16}/>
                          </button>
                          <button onClick={() => deleteItemOffer(io.id)} className="p-2 rounded hover:bg-gray-50 text-red-600">
                            <Trash2 size={16}/>
                          </button>
                        </div>
                        <div className="text-xs text-gray-500">{io.created_at ? new Date(io.created_at).toLocaleString() : ""}</div>
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
