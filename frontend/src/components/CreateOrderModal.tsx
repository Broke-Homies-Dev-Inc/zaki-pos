"use client"

// CreateOrderModal.tsx
import { useState, useMemo, useEffect } from "react"
import { X, Trash2, Search, StickyNote } from "lucide-react"
import { toast } from "react-toastify"
import { useMenuItems } from "../hooks/useMenuItems"
import { useOrders, type OrderCreatePayload } from "../hooks/useOrders"
import { useSettings } from "../hooks/useSettings"
import { useWaiters } from "../hooks/useWaiters"
import { useRestaurantSettings } from "../hooks/useRestaurantSettings"
import api from "../lib/api"
import { formatCurrency, generateOrderNumber } from "../lib/utils"
import type { Database } from "../lib/database.types"
import { ItemNotesModal } from "./ItemNotesModal"

// Portion type (Quarter / Half / Full etc.)
type PortionSize = { name: string; price: number }

// Extend MenuItem row with typed portion_sizes
type MenuItem = Database["public"]["Tables"]["menu_items"]["Row"] & {
  portion_sizes?: PortionSize[] | null
  apply_vat?: boolean
}

type OrderItemInsert = Database["public"]["Tables"]["order_items"]["Insert"]
type CartItem = Omit<OrderItemInsert, "order_id" | "id" | "created_at"> & {
  menu_item_name: string
  portion_name?: string | null
  applied_discount_percent?: number
  original_unit_price?: number
  notes?: string | null
}

type OfferSet = {
  id: number | string
  name: string
  discount_percent: number
  active: boolean
  menu_item_ids: Array<number | string>
  offer_type?: string
  discount_type?: string
  discount_value?: number
  priority?: number
  is_stackable?: boolean
  start_time?: string | null
  end_time?: string | null
}

export function CreateOrderModal({ onClose }: { onClose: () => void }) {
  const { menuItems } = useMenuItems()
  const { createOrder } = useOrders()
  const { layout: tableLayout } = useSettings()
  const { waiters } = useWaiters()
  const { settings: restaurantSettings } = useRestaurantSettings()

  const [offers, setOffers] = useState<OfferSet[]>([])

  const [cart, setCart] = useState<CartItem[]>([])
  const [customerName, setCustomerName] = useState("")
  const [mobileNumber, setMobileNumber] = useState("")
  const [orderType, setOrderType] = useState<"dine_in" | "take_away" | "delivery" | "online_delivery">("dine_in")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [selectedWaiter, setSelectedWaiter] = useState<string>("")
  const [orderNotes, setOrderNotes] = useState("")

  const [selectedTable, setSelectedTable] = useState<string | null>(null)
  const [takeAwayMethod, setTakeAwayMethod] = useState<"counter" | "car">("counter")
  const [carMake, setCarMake] = useState("")
  const [carLicensePlate, setCarLicensePlate] = useState("")
  const [deliveryAddress, setDeliveryAddress] = useState("")
  const [deliveryPartners, setDeliveryPartners] = useState<{ id: string; name: string; active: boolean }[]>([])
  const [selectedPartner, setSelectedPartner] = useState("")

  const [selectedMainCategory, setSelectedMainCategory] = useState<string | null>(null)
  const [selectedSubCategory, setSelectedSubCategory] = useState<string | null>(null)
  const [vegFilter, setVegFilter] = useState<"all" | "veg" | "non-veg">("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [inStockOnly, setInStockOnly] = useState(false)

  const [showNotesModal, setShowNotesModal] = useState(false)
  const [editingNotesItem, setEditingNotesItem] = useState<CartItem | null>(null)

  useEffect(() => {
    let mounted = true
    const load = async () => {
      try {
        const offersRes = await api.get("/setting/offers")
        if (!mounted) return
        setOffers(Array.isArray(offersRes.data) ? offersRes.data : [])
      } catch (err) {
        console.warn("Could not load offers:", err)
      }

      try {
        const partnersRes = await api.get("/setting/delivery-partners")
        if (!mounted) return
        setDeliveryPartners(Array.isArray(partnersRes.data) ? partnersRes.data : [])
      } catch (err) {
        console.warn("Could not load delivery partners:", err)
      }
    }
    load()
    return () => {
      mounted = false
    }
  }, [])

  const getCartQuantity = (menuItemId: string) => {
    return cart.filter((c) => c.menu_item_id === menuItemId).reduce((sum, c) => sum + c.quantity, 0)
  }

  const getBestDiscountPercent = (menuItemId: string | number) => {
    let best = 0
    for (const o of offers) {
      if (!o.active) continue
      if (Array.isArray(o.menu_item_ids) && o.menu_item_ids.some((m) => String(m) === String(menuItemId))) {
        best = Math.max(best, Number(o.discount_percent || 0))
      }
    }
    return best
  }

  const addToCart = (menuItem: MenuItem, portionName?: string | null, overridePrice?: number) => {
    const currentStock = menuItem.stock ?? 0
    const currentCartQty = getCartQuantity(menuItem.id)

    if (currentStock === 0) {
      toast.error(`${menuItem.name} is out of stock.`)
      return
    }

    if (currentCartQty >= currentStock) {
      toast.error(`Cannot add more ${menuItem.name}. Only ${currentStock} available in stock.`)
      return
    }

    let unitPrice = overridePrice ?? Number(menuItem.price)
    const discountPercent = getBestDiscountPercent(menuItem.id)
    if (discountPercent && discountPercent > 0) {
      unitPrice = Number((unitPrice * (1 - discountPercent / 100)).toFixed(2))
    }

    setCart((prevCart) => {
      const existingItem = prevCart.find(
        (item) => item.menu_item_id === menuItem.id && (item.portion_name || null) === (portionName || null),
      )

      if (existingItem) {
        return prevCart.map((item) =>
          item.menu_item_id === menuItem.id && (item.portion_name || null) === (portionName || null)
            ? {
              ...item,
              quantity: item.quantity + 1,
              total_price: (item.quantity + 1) * Number(item.unit_price),
            }
            : item,
        )
      }

      return [
        ...prevCart,
        {
          menu_item_id: menuItem.id,
          quantity: 1,
          unit_price: unitPrice,
          total_price: unitPrice,
          menu_item_name: menuItem.name,
          portion_name: portionName || null,
          applied_discount_percent: discountPercent || 0,
          original_unit_price: overridePrice ?? Number(menuItem.price),
        },
      ]
    })
  }

  const removeFromCart = (menuItemId: string, portionName?: string | null) => {
    setCart((prevCart) =>
      prevCart.filter(
        (item) => !(item.menu_item_id === menuItemId && (item.portion_name || null) === (portionName || null)),
      ),
    )
  }

  const handleOpenNotesModal = (item: CartItem) => {
    setEditingNotesItem(item)
    setShowNotesModal(true)
  }

  const handleSaveItemNotes = (notes: string) => {
    if (!editingNotesItem) return

    setCart((prevCart) =>
      prevCart.map((item) =>
        item.menu_item_id === editingNotesItem.menu_item_id &&
        (item.portion_name || null) === (editingNotesItem.portion_name || null)
          ? { ...item, notes: notes || null }
          : item
      )
    )
    setShowNotesModal(false)
    setEditingNotesItem(null)
  }

  const handleCloseNotesModal = () => {
    setShowNotesModal(false)
    setEditingNotesItem(null)
  }

  const { subtotal, taxAmount, grandTotal } = useMemo(() => {
    const sub = cart.reduce((sum, item) => sum + item.total_price, 0)

    // Check if selected table's section has VAT enabled
    let sectionApplyVat = true
    if (orderType === "dine_in" && selectedTable && tableLayout) {
      for (const floor of tableLayout) {
        for (const section of floor.sections || []) {
          const table = (section.tables || []).find((t: any) => t.table_id === selectedTable)
          if (table) {
            sectionApplyVat = section.apply_vat !== false // default to true if undefined
            break
          }
        }
        if (!sectionApplyVat) break
      }
    }

    // Calculate VAT per item based on both section and individual item settings
    let calculatedVAT = 0
    if (sectionApplyVat) {
      // Get tax rate from settings (stored as percentage, e.g., 5 = 5%)
      const taxRate = restaurantSettings.tax_rate ? Number(restaurantSettings.tax_rate) / 100 : 0.05
      
      for (const cartItem of cart) {
        // Find the menu item to check its apply_vat flag
        const menuItem = menuItems?.find(m => m.id === cartItem.menu_item_id)
        const itemApplyVat = menuItem?.apply_vat !== false // default to true if undefined
        
        // Only apply VAT if both section and item have VAT enabled
        if (itemApplyVat) {
          calculatedVAT += cartItem.total_price * taxRate
        }
      }
    }

    // Round VAT to 2 decimal places
    calculatedVAT = Math.round(calculatedVAT * 100) / 100
    const grand = sub + calculatedVAT
    
    return { subtotal: sub, taxAmount: calculatedVAT, grandTotal: grand }
  }, [cart, orderType, selectedTable, tableLayout, menuItems, restaurantSettings.tax_rate])

  const handleSubmit = async () => {
    if (cart.length === 0) return toast.error("Cannot create an empty order.")

    if (orderType === "dine_in" && !selectedTable) {
      return toast.error("Please select a table for dine-in orders.")
    }

    if (orderType === "delivery" && !deliveryAddress.trim()) {
      return toast.error("Please enter a delivery address.")
    }

    if (orderType === "online_delivery" && !selectedPartner) {
      return toast.error("Please select a delivery partner.")
    }

    if (orderType !== "online_delivery" && !selectedWaiter) {
      return toast.error("Please select a waiter for this order.")
    }

    setIsSubmitting(true)

    const orderPayload: OrderCreatePayload = {
      order_number: generateOrderNumber(),
      customer_name: customerName,
      mobile_number: mobileNumber,
      order_type: orderType,
      subtotal,
      tax_amount: taxAmount,
      grand_total: grandTotal,
      status: "pending",
      notes: orderNotes.trim() || null,
      restaurant_table_id: orderType === "dine_in" ? selectedTable : null,
      waiter_id: orderType === "online_delivery" ? null : selectedWaiter,
      take_away_method: orderType === "take_away" ? takeAwayMethod : null,
      car_make: orderType === "take_away" && takeAwayMethod === "car" ? carMake : null,
      car_license_plate: orderType === "take_away" && takeAwayMethod === "car" ? carLicensePlate : null,
      delivery_address: orderType === "delivery" ? deliveryAddress : orderType === "online_delivery" ? selectedPartner : null,
    }

    const itemsPayload = cart.map(({ menu_item_name, ...item }) => item)
    const result = await createOrder(orderPayload, itemsPayload)
    setIsSubmitting(false)

    if (result.success) {
      onClose()
    }
  }

  useEffect(() => {
    const fetchByPhone = async () => {
      const phone = mobileNumber.trim()
      if (phone.length === 0) return
      try {
        const res = await api.get(`/customers/phone/${encodeURIComponent(phone)}`)
        if (res && res.data) {
          if (res.data.name) setCustomerName(res.data.name)
        }
      } catch {
        // ignore
      }
    }

    const timer = setTimeout(fetchByPhone, 400)
    return () => clearTimeout(timer)
  }, [mobileNumber])

  useEffect(() => {
    if (selectedTable && orderType === "dine_in" && tableLayout) {
      for (const floor of tableLayout) {
        for (const section of floor.sections) {
          const table = section.tables.find((t: any) => t.table_id === selectedTable)
          if (table && table.active_order && table.active_order.waiter_id) {
            setSelectedWaiter(table.active_order.waiter_id)
            return
          }
        }
      }
    }
  }, [selectedTable, orderType, tableLayout])

  const DineInOptions = () => {
    const allTables: Array<{
      tableId: string
      tableName: string
      sectionName: string
      floorName: string
      status: string
      isAvailable: boolean
    }> = []

    tableLayout.forEach((floor) => {
      ; (floor.sections || []).forEach((section) => {
        ; (section.tables || []).forEach((table) => {
          const tableStatus = table.table_status || "available"
          const available = tableStatus === "available"

          allTables.push({
            tableId: table.table_id,
            tableName: table.table_name,
            sectionName: section.section_name,
            floorName: floor.floor_name,
            status: tableStatus,
            isAvailable: available,
          })
        })
      })
    })

    const availableCount = allTables.filter((t) => t.isAvailable).length

    return (
      <div className="mt-2">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Select Table <span className="text-red-500">*</span>
        </label>
        <select
          value={selectedTable || ""}
          onChange={(e) => {
            const selectedTableId = e.target.value
            if (selectedTableId) {
              setSelectedTable(selectedTableId)
            }
          }}
          className={`w-full px-3 py-2 border rounded-md bg-white ${!selectedTable ? "border-red-300 bg-red-50" : "border-gray-300"
            }`}
          required
        >
          <option value="" disabled>
            {availableCount > 0 ? "Select an available table" : "No tables available"}
          </option>
          {tableLayout.map((floor) => {
            const floorTables = allTables.filter((t) => t.floorName === floor.floor_name)
            if (floorTables.length === 0) return null

            const availableInFloor = floorTables.filter((t) => t.isAvailable).length

            return (
              <optgroup
                label={`${floor.floor_name} (${availableInFloor}/${floorTables.length} available)`}
                key={floor.floor_id}
              >
                {(floor.sections || []).map((section) =>
                  (section.tables || []).map((table) => {
                    const isAvailable = table.table_status === "available"
                    const statusLabel =
                      table.table_status === "cleaning"
                        ? "🧹 Cleaning"
                        : table.table_status === "occupied"
                          ? "👥 Occupied"
                          : table.table_status === "bill_printed"
                            ? "🧾 Bill Printed"
                            : ""

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
                    )
                  }),
                )}
              </optgroup>
            )
          })}
        </select>
        {availableCount === 0 && (
          <p className="text-sm text-red-600 mt-1">
            ⚠️ All tables are currently occupied. Please wait for a table to become available or choose a different order
            type.
          </p>
        )}
        {!selectedTable && availableCount > 0 && (
          <p className="text-sm text-gray-500 mt-1">Available tables shown in black, unavailable tables greyed out</p>
        )}
      </div>
    )
  }

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
        <>
          <input
            type="text"
            value={carMake}
            onChange={(e) => setCarMake(e.target.value)}
            placeholder="Enter Car Make (e.g. Toyota Camry)"
            className="w-full px-3 py-2 border rounded-md"
          />
          <input
            type="text"
            value={carLicensePlate}
            onChange={(e) => setCarLicensePlate(e.target.value)}
            placeholder="Enter License Plate (e.g. 1234 AB)"
            className="w-full px-3 py-2 border rounded-md mt-2"
          />
        </>
      )}
    </div>
  )

  const DeliveryOptions = () => (
    <textarea
      value={deliveryAddress}
      onChange={(e) => setDeliveryAddress(e.target.value)}
      placeholder="Enter Delivery Address"
      className="w-full px-3 py-2 border rounded-md mt-2 h-24"
    />
  )

  const OnlineDeliveryOptions = () => {
    const activePartners = deliveryPartners.filter(p => p.active);

    return (
      <div className="mt-2">
        <p className="text-sm font-medium text-gray-700 mb-2">Select Delivery Partner *</p>
        {activePartners.length === 0 ? (
          <p className="text-sm text-gray-500 italic">No delivery partners configured. Add partners in Settings.</p>
        ) : (
          <div className="space-y-2">
            {activePartners.map((partner) => (
              <label
                key={partner.id}
                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${selectedPartner === partner.name
                  ? 'border-orange-500 bg-orange-50'
                  : 'border-gray-200 hover:border-gray-300'
                  }`}
              >
                <input
                  type="radio"
                  name="deliveryPartner"
                  value={partner.name}
                  checked={selectedPartner === partner.name}
                  onChange={() => setSelectedPartner(partner.name)}
                  className="text-orange-500 focus:ring-orange-500"
                />
                <span className="font-medium text-gray-800">{partner.name}</span>
              </label>
            ))}
          </div>
        )}
      </div>
    );
  };

  const grouped = useMemo(() => {
    const g: Record<string, Record<string, MenuItem[]>> = {}
      ; (menuItems || []).forEach((m) => {
        const main = m.category ?? "Uncategorized"
        const sub = m.sub_category ?? "-"
        if (!g[main]) g[main] = {}
        if (!g[main][sub]) g[main][sub] = []
        g[main][sub].push(m as MenuItem)
      })
    return g
  }, [menuItems])

  const categories = Object.keys(grouped).sort()
  const availableSubCategories = selectedMainCategory ? Object.keys(grouped[selectedMainCategory] || {}).sort() : []
  const itemsInSubCategory =
    selectedMainCategory && selectedSubCategory ? grouped[selectedMainCategory][selectedSubCategory] || [] : []

  const filteredItemsInSubCategory = useMemo(() => {
    return itemsInSubCategory.filter((item) => {
      // Apply stock filter
      if (inStockOnly && (item.stock ?? 0) === 0) return false
      // Apply veg filter
      if (vegFilter === "veg") return (item as any).is_vegetarian === true
      if (vegFilter === "non-veg") return (item as any).is_vegetarian === false
      return true // "all" - return all items
    })
  }, [itemsInSubCategory, vegFilter, inStockOnly])

  // All in-stock items - shows ALL items that are in stock (bypasses category selection)
  const allInStockItems = useMemo(() => {
    if (!inStockOnly) return []
    return (menuItems || []).filter((item) => (item.stock ?? 0) > 0) as MenuItem[]
  }, [menuItems, inStockOnly])

  // Search results - filter all menu items by search query
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return []
    const query = searchQuery.toLowerCase()
    return (menuItems || []).filter((item) => {
      // Apply stock filter first
      if (inStockOnly && (item.stock ?? 0) === 0) return false
      // Then search filter
      return item.name.toLowerCase().includes(query) ||
        (item.category && item.category.toLowerCase().includes(query)) ||
        (item.sub_category && item.sub_category.toLowerCase().includes(query))
    }) as MenuItem[]
  }, [menuItems, searchQuery, inStockOnly])

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-2xl font-semibold text-gray-800">Create New Order</h2>

          {/* Search Bar */}
          <div className="flex-1 max-w-md mx-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  // Clear category selection when searching
                  if (e.target.value) {
                    setSelectedMainCategory(null)
                    setSelectedSubCategory(null)
                  }
                }}
                placeholder="Search menu items..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* In Stock Filter Toggle */}
          <label className="flex items-center gap-2 cursor-pointer mr-4">
            <span className="text-sm text-gray-600 whitespace-nowrap">In Stock</span>
            <div className="relative">
              <input
                type="checkbox"
                checked={inStockOnly}
                onChange={(e) => setInStockOnly(e.target.checked)}
                className="sr-only"
              />
              <div className={`w-10 h-5 rounded-full transition-colors ${inStockOnly ? 'bg-green-500' : 'bg-gray-300'}`}></div>
              <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${inStockOnly ? 'translate-x-5' : ''}`}></div>
            </div>
          </label>

          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={24} />
          </button>
        </div>

        {/* Body - 4-column layout */}
        <div className="flex-1 overflow-hidden grid grid-cols-4 gap-0">
          {/* Column 1: Main Categories */}
          <div className="border-r overflow-y-auto bg-gray-50">
            <div className="p-4">
              <h3 className="font-semibold text-lg mb-3 text-gray-800">Categories</h3>
              <div className="space-y-2">
                {categories.map((category) => (
                  <button
                    key={category}
                    onClick={() => {
                      setSelectedMainCategory(category)
                      setSelectedSubCategory(null)
                    }}
                    className={`w-full text-left px-4 py-3 rounded-lg transition font-medium ${selectedMainCategory === category
                      ? "bg-blue-500 text-white shadow-md"
                      : "bg-white text-gray-800 hover:bg-gray-100 border border-gray-200"
                      }`}
                  >
                    {category}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Column 2: Sub Categories */}
          <div className="border-r overflow-y-auto bg-white">
            <div className="p-4">
              <h3 className="font-semibold text-lg mb-3 text-gray-800">Sub Categories</h3>
              {selectedMainCategory ? (
                <div className="space-y-2">
                  {availableSubCategories.map((subCategory) => (
                    <button
                      key={subCategory}
                      onClick={() => setSelectedSubCategory(subCategory)}
                      className={`w-full text-left px-4 py-3 rounded-lg transition font-medium ${selectedSubCategory === subCategory
                        ? "bg-green-500 text-white shadow-md"
                        : "bg-white text-gray-800 hover:bg-gray-100 border border-gray-200"
                        }`}
                    >
                      {subCategory === "-" ? "Other" : subCategory}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-8">Select a category first</p>
              )}
            </div>
          </div>

          {/* Column 3: Menu Items */}
          <div className="border-r overflow-y-auto bg-gray-50">
            <div className="p-4">
              <h3 className="font-semibold text-lg mb-3 text-gray-800">Items</h3>

              {selectedSubCategory && (
                <div className="mb-4 flex gap-2">
                  <button
                    onClick={() => setVegFilter("all")}
                    className={`flex-1 py-2 px-3 rounded text-sm font-medium transition-colors ${vegFilter === "all"
                      ? "bg-gray-800 text-white"
                      : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
                      }`}
                  >
                    All
                  </button>
                  <button
                    onClick={() => setVegFilter("veg")}
                    className={`flex-1 py-2 px-3 rounded text-sm font-medium transition-colors ${vegFilter === "veg"
                      ? "bg-green-600 text-white"
                      : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
                      }`}
                  >
                    🥗 Veg
                  </button>
                  <button
                    onClick={() => setVegFilter("non-veg")}
                    className={`flex-1 py-2 px-3 rounded text-sm font-medium transition-colors ${vegFilter === "non-veg"
                      ? "bg-red-600 text-white"
                      : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
                      }`}
                  >
                    🍗 Non-Veg
                  </button>
                </div>
              )}

              {/* Show search results OR in-stock items OR category-based items */}
              {searchQuery ? (
                <div className="space-y-3">
                  {searchResults.length > 0 ? (
                    searchResults.map((item) => {
                      const qtyTotal = getCartQuantity(item.id)
                      const currentStock = item.stock ?? 0
                      const isOutOfStock = currentStock === 0
                      const portions = (item.portion_sizes || []) ?? []
                      const hasPortions = Array.isArray(portions) && portions.length > 0

                      return (
                        <div
                          key={item.id}
                          className={`p-3 rounded-lg border ${isOutOfStock
                            ? "bg-red-50 border-red-200 opacity-50"
                            : "bg-white border-gray-200 hover:border-blue-300"
                            }`}
                        >
                          <div className="flex justify-between items-start mb-2">
                            <div className="flex-1">
                              <p className="font-semibold text-gray-800 text-sm">{item.name}</p>
                              <p className="text-xs text-gray-400 mb-1">{item.category} › {item.sub_category || 'Other'}</p>
                              <p className="text-xs text-gray-500">
                                {formatCurrency(Number(item.price))} • Stock: {currentStock}
                              </p>
                              {getBestDiscountPercent(item.id) > 0 && (
                                <p className="text-xs text-green-700 font-semibold">
                                  {getBestDiscountPercent(item.id)}% off
                                </p>
                              )}
                            </div>
                            {!hasPortions && (
                              <button
                                onClick={() => addToCart(item)}
                                disabled={isOutOfStock || qtyTotal >= currentStock}
                                className={`ml-2 px-3 py-1 rounded text-sm font-medium ${isOutOfStock || qtyTotal >= currentStock
                                  ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                                  : "bg-blue-500 text-white hover:bg-blue-600"
                                  }`}
                              >
                                + Add
                              </button>
                            )}
                          </div>

                          {/* Portions */}
                          {hasPortions && !isOutOfStock && (
                            <div className="space-y-2">
                              {portions.map((portion) => (
                                <button
                                  key={portion.name}
                                  onClick={() => addToCart(item, portion.name, portion.price)}
                                  className="w-full text-left px-2 py-1.5 bg-blue-50 border border-blue-200 rounded text-xs hover:bg-blue-100"
                                >
                                  <span className="font-semibold">{portion.name}</span> - {formatCurrency(portion.price)}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })
                  ) : (
                    <div className="text-center py-8">
                      <Search className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                      <p className="text-gray-500">No items found for "{searchQuery}"</p>
                      <p className="text-sm text-gray-400 mt-1">Try a different search term</p>
                    </div>
                  )}
                </div>
              ) : inStockOnly ? (
                // Show ALL in-stock items when toggle is ON
                <div className="space-y-3">
                  {allInStockItems.length > 0 ? (
                    allInStockItems.map((item) => {
                      const qtyTotal = getCartQuantity(item.id)
                      const currentStock = item.stock ?? 0
                      const portions = (item.portion_sizes || []) ?? []
                      const hasPortions = Array.isArray(portions) && portions.length > 0

                      return (
                        <div
                          key={item.id}
                          className="p-3 rounded-lg border bg-white border-gray-200 hover:border-green-300"
                        >
                          <div className="flex justify-between items-start mb-2">
                            <div className="flex-1">
                              <p className="font-semibold text-gray-800 text-sm">{item.name}</p>
                              <p className="text-xs text-gray-400 mb-1">{item.category} › {item.sub_category || 'Other'}</p>
                              <p className="text-xs text-gray-500">
                                {formatCurrency(Number(item.price))} • Stock: {currentStock}
                              </p>
                              {getBestDiscountPercent(item.id) > 0 && (
                                <p className="text-xs text-green-700 font-semibold">
                                  {getBestDiscountPercent(item.id)}% off
                                </p>
                              )}
                            </div>
                          </div>

                          {/* For items with portions, show portion buttons */}
                          {hasPortions ? (
                            <div className="space-y-2">
                              {portions.map((portion) => (
                                <button
                                  key={portion.name}
                                  onClick={() => addToCart(item, portion.name, portion.price)}
                                  className="w-full text-left px-2 py-1.5 bg-green-50 border border-green-200 rounded text-xs hover:bg-green-100"
                                >
                                  <span className="font-semibold">{portion.name}</span> - {formatCurrency(portion.price)}
                                </button>
                              ))}
                            </div>
                          ) : (
                            /* For items without portions, show a single add button styled like portion buttons */
                            <button
                              onClick={() => addToCart(item)}
                              disabled={qtyTotal >= currentStock}
                              className={`w-full text-left px-2 py-1.5 rounded text-xs ${qtyTotal >= currentStock
                                ? "bg-gray-100 border border-gray-200 text-gray-400 cursor-not-allowed"
                                : "bg-green-50 border border-green-200 hover:bg-green-100"
                                }`}
                            >
                              <span className="font-semibold">Add to Order</span> - {formatCurrency(Number(item.price))}
                            </button>
                          )}
                        </div>
                      )
                    })
                  ) : (
                    <p className="text-gray-500 text-center py-8">No items currently in stock</p>
                  )}
                </div>
              ) : selectedSubCategory ? (
                <div className="space-y-3">
                  {filteredItemsInSubCategory.map((item) => {
                    const qtyTotal = getCartQuantity(item.id)
                    const currentStock = item.stock ?? 0
                    const isOutOfStock = currentStock === 0
                    const portions = (item.portion_sizes || []) ?? []
                    const hasPortions = Array.isArray(portions) && portions.length > 0

                    return (
                      <div
                        key={item.id}
                        className={`p-3 rounded-lg border ${isOutOfStock
                          ? "bg-red-50 border-red-200 opacity-50"
                          : "bg-white border-gray-200 hover:border-blue-300"
                          }`}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex-1">
                            <p className="font-semibold text-gray-800 text-sm">{item.name}</p>
                            <p className="text-xs text-gray-500">
                              {formatCurrency(Number(item.price))} • Stock: {currentStock}
                            </p>
                            {getBestDiscountPercent(item.id) > 0 && (
                              <p className="text-xs text-green-700 font-semibold">
                                {getBestDiscountPercent(item.id)}% off
                              </p>
                            )}
                          </div>
                          {!hasPortions && (
                            <button
                              onClick={() => addToCart(item)}
                              disabled={isOutOfStock || qtyTotal >= currentStock}
                              className={`ml-2 px-3 py-1 rounded text-sm font-medium ${isOutOfStock || qtyTotal >= currentStock
                                ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                                : "bg-blue-500 text-white hover:bg-blue-600"
                                }`}
                            >
                              + Add
                            </button>
                          )}
                        </div>

                        {/* Portions */}
                        {hasPortions && !isOutOfStock && (
                          <div className="space-y-2">
                            {portions.map((portion) => (
                              <button
                                key={portion.name}
                                onClick={() => addToCart(item, portion.name, portion.price)}
                                className="w-full text-left px-2 py-1.5 bg-blue-50 border border-blue-200 rounded text-xs hover:bg-blue-100"
                              >
                                <span className="font-semibold">{portion.name}</span> - {formatCurrency(portion.price)}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                  {filteredItemsInSubCategory.length === 0 && (
                    <p className="text-gray-500 text-center py-8">No items in this category</p>
                  )}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-8">Select a sub-category</p>
              )}
            </div>
          </div>

          {/* Column 4: Order Summary & Customer Details */}
          <div className="overflow-y-auto bg-white">
            <div className="p-4 space-y-4">
              <h3 className="font-semibold text-lg text-gray-800">Order Details</h3>

              <div className="space-y-2">
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Customer Name"
                  className="w-full px-3 py-2 border rounded-md text-sm"
                />
                <input
                  type="tel"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={mobileNumber}
                  onChange={(e) => {
                    // Only allow digits
                    const numericValue = e.target.value.replace(/\D/g, '')
                    setMobileNumber(numericValue)
                  }}
                  placeholder="Mobile Number"
                  className="w-full px-3 py-2 border rounded-md text-sm"
                />
                <select
                  value={orderType}
                  onChange={(e) => setOrderType(e.target.value as any)}
                  className="w-full px-3 py-2 border rounded-md bg-white text-sm"
                >
                  <option value="dine_in">Dine In</option>
                  <option value="take_away">Take Away</option>
                  <option value="delivery">Delivery</option>
                  <option value="online_delivery">Online Delivery</option>
                </select>
              </div>

              {orderType !== "online_delivery" && (
                <select
                  value={selectedWaiter}
                  onChange={(e) => setSelectedWaiter(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md bg-white text-sm"
                  required
                >
                  <option value="">Select Waiter *</option>
                  {waiters.map((waiter) => (
                    <option key={waiter.id} value={waiter.id}>
                      {waiter.name}
                    </option>
                  ))}
                </select>
              )}

              {orderType === "dine_in" && <DineInOptions />}
              {orderType === "take_away" && <TakeAwayOptions />}
              {orderType === "delivery" && <DeliveryOptions />}
              {orderType === "online_delivery" && <OnlineDeliveryOptions />}

              {/* Order Notes */}
              <div className="border-t pt-3 mt-3">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Order Notes (Optional)
                </label>
                <textarea
                  value={orderNotes}
                  onChange={(e) => setOrderNotes(e.target.value)}
                  placeholder="Add special instructions for this order..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  rows={2}
                />
              </div>

              {/* Cart Summary */}
              <div className="border-t pt-3 mt-3">
                <h4 className="font-semibold text-sm text-gray-800 mb-2">Order Summary</h4>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {cart.map((item) => (
                    <div key={`${item.menu_item_id}-${item.portion_name || "base"}`} className="text-xs">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <p className="font-medium text-gray-800">
                            {item.menu_item_name}
                            {item.portion_name ? ` (${item.portion_name})` : ""}
                          </p>
                          <p className="text-gray-500">Qty: {item.quantity}</p>
                          {item.notes && (
                            <p className="text-xs text-blue-600 mt-1">
                              <StickyNote className="inline w-3 h-3 mr-1" />
                              {item.notes}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleOpenNotesModal(item)}
                            className="px-1.5 py-0.5 text-blue-500 hover:text-blue-600"
                            title="Add/Edit Notes"
                          >
                            <StickyNote size={14} />
                          </button>
                          <button
                            onClick={() => {
                              setCart((prevCart) =>
                                prevCart
                                  .map((i) =>
                                    i.menu_item_id === item.menu_item_id &&
                                      (i.portion_name || null) === (item.portion_name || null)
                                      ? {
                                        ...i,
                                        quantity: i.quantity - 1,
                                        total_price: (i.quantity - 1) * Number(i.unit_price),
                                      }
                                      : i,
                                  )
                                  .filter((i) => i.quantity > 0),
                              )
                            }}
                            className="px-1.5 py-0.5 bg-gray-200 rounded hover:bg-gray-300"
                          >
                            −
                          </button>
                          <button
                            onClick={() => {
                              setCart((prevCart) =>
                                prevCart.map((i) =>
                                  i.menu_item_id === item.menu_item_id &&
                                    (i.portion_name || null) === (item.portion_name || null)
                                    ? {
                                      ...i,
                                      quantity: i.quantity + 1,
                                      total_price: (i.quantity + 1) * Number(i.unit_price),
                                    }
                                    : i,
                                ),
                              )
                            }}
                            className="px-1.5 py-0.5 bg-blue-200 rounded hover:bg-blue-300"
                          >
                            +
                          </button>
                          <button
                            onClick={() => removeFromCart(item.menu_item_id, item.portion_name || null)}
                            className="px-1.5 py-0.5 text-red-500 hover:text-red-600"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                      <p className="text-gray-700 font-semibold">{formatCurrency(item.total_price)}</p>
                    </div>
                  ))}
                </div>
              </div>

              {cart.length > 0 && (
                <div className="border-t pt-3 space-y-1 text-sm">
                  <div className="flex justify-between text-gray-600">
                    <span>Subtotal</span>
                    <span>{formatCurrency(subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>Tax</span>
                    <span>{formatCurrency(taxAmount)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-lg text-gray-800">
                    <span>Total</span>
                    <span>{formatCurrency(grandTotal)}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-gray-50 rounded-b-xl flex justify-end gap-3 border-t">
          <button
            onClick={onClose}
            className="px-6 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100 font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={
              isSubmitting ||
              cart.length === 0 ||
              (orderType !== "online_delivery" && !selectedWaiter) ||
              (orderType === "dine_in" && !selectedTable) ||
              (orderType === "delivery" && !deliveryAddress.trim()) ||
              (orderType === "online_delivery" && !selectedPartner)
            }
            className={`px-6 py-2 rounded-lg text-white font-medium ${isSubmitting ||
              cart.length === 0 ||
              (orderType !== "online_delivery" && !selectedWaiter) ||
              (orderType === "dine_in" && !selectedTable) ||
              (orderType === "delivery" && !deliveryAddress.trim()) ||
              (orderType === "online_delivery" && !selectedPartner)
              ? "bg-gray-400 cursor-not-allowed"
              : "bg-blue-500 hover:bg-blue-600"
              }`}
            title={
              orderType !== "online_delivery" && !selectedWaiter
                ? "Please select a waiter"
                : orderType === "dine_in" && !selectedTable
                  ? "Please select a table for dine-in orders"
                  : orderType === "delivery" && !deliveryAddress.trim()
                    ? "Please enter a delivery address"
                    : orderType === "online_delivery" && !selectedPartner
                      ? "Please select a delivery partner"
                      : cart.length === 0
                        ? "Add items to the order"
                        : "Create Order"
            }
          >
            {isSubmitting ? "Creating..." : "Create Order"}
          </button>
        </div>
      </div>

      {/* Item Notes Modal */}
      {showNotesModal && editingNotesItem && (
        <ItemNotesModal
          item={{
            name: editingNotesItem.menu_item_name,
            quick_notes: [],
          }}
          currentNotes={editingNotesItem.notes || ""}
          onSave={handleSaveItemNotes}
          onClose={handleCloseNotesModal}
        />
      )}
    </div>
  )
}
