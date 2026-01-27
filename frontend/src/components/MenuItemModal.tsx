"use client"

import type React from "react"

import { useState, useEffect, type FormEvent } from "react"
import { X, Plus, Trash2, ImageIcon, Leaf, ChefHat } from "lucide-react"
import { toast } from "react-toastify"
import { useMenuItems } from "../hooks/useMenuItems"
import { useInventory } from "../hooks/useInventory"
import { uploadMenuItemImage } from "../lib/api"
import api from "../lib/api"
import type { Database } from "../lib/database.types"

type RecipeItem = { inventory_item_id: string; quantity_used: number; item_name?: string }

// NEW: Portion/variant type (Quarter / Half / Full etc.)
type Portion = { id?: string; name: string; price: number }

type MenuItemInsert = Database["public"]["Tables"]["menu_items"]["Insert"]
// EXTEND row type to include optional portion_sizes JSON and station_id
type MenuItemRow = Database["public"]["Tables"]["menu_items"]["Row"] & {
  recipe?: RecipeItem[]
  sub_category?: string | null
  portion_sizes?: Portion[] | null
  is_vegetarian?: boolean
  station_id?: string | null
  station_name?: string | null
  quick_notes?: string[] | null
}

// Kitchen station type for dropdown
type KitchenStation = {
  id: string
  name: string
  active: boolean
}

type MenuItemWithRecipe = Omit<MenuItemInsert, "id"> & { recipe: RecipeItem[] }

interface MenuItemModalProps {
  item: MenuItemRow | null
  onClose: () => void
  // categories rows from backend: { id, main_category, sub_category }
  categories?: { id: string; main_category: string; sub_category: string | null }[]
  // optional initial values when adding a new item
  initialValues?: { category?: string; sub_category?: string }
}

export function MenuItemModal({ item, onClose, categories = [], initialValues }: MenuItemModalProps) {
  const { addMenuItem, updateMenuItem } = useMenuItems()
  const { inventory } = useInventory()

  const [formData, setFormData] = useState({
    name: "",
    name_ar: "",
    category: "",
    sub_category: "",
    price: "",
    description: "",
    image_url: "",
    is_vegetarian: false,
    station_id: "", // added station_id state
    apply_vat: false,
  })
  const [recipe, setRecipe] = useState<RecipeItem[]>([])
  const [imagePreview, setImagePreview] = useState<string>("")
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // NEW: local state for portion sizes
  const [portions, setPortions] = useState<Portion[]>([])

  // NEW: local state for quick notes
  const [quickNotes, setQuickNotes] = useState<string[]>([])
  const [newQuickNote, setNewQuickNote] = useState("")

  // Kitchen stations for dropdown
  const [kitchenStations, setKitchenStations] = useState<KitchenStation[]>([])

  // derive unique mains and submap
  const mains = Array.from(new Set(categories.map((c) => c.main_category))).sort((a, b) => a.localeCompare(b))
  const subMap: Record<string, { id: string; sub: string | null }[]> = {}
  categories.forEach((c) => {
    subMap[c.main_category] = subMap[c.main_category] || []
    subMap[c.main_category].push({ id: c.id, sub: c.sub_category })
  })

  // Fetch kitchen stations on mount
  useEffect(() => {
    const fetchStations = async () => {
      try {
        const response = await api.get("/setting/kitchen-stations")
        setKitchenStations(response.data.filter((s: KitchenStation) => s.active))
      } catch (error) {
        console.error("Error fetching kitchen stations:", error)
      }
    }
    fetchStations()
  }, [])

  useEffect(() => {
    if (item) {
      setFormData({
        name: item.name,
        name_ar: (item as any).name_ar ?? "",
        category: item.category || "",
        sub_category: item.sub_category ?? "",
        price: String(item.price ?? ""),
        description: item.description ?? "",
        image_url: item.image_url ?? "",
        is_vegetarian: item.is_vegetarian ?? false,
        station_id: item.station_id ?? "", // load station_id from item
        apply_vat: (item as any).apply_vat ?? false,
      })
      setRecipe(item.recipe || [])
      setImagePreview(item.image_url ?? "")

      // NEW: load existing portion sizes if present
      const existingPortions = item.portion_sizes ?? []
      if (existingPortions && existingPortions.length > 0) {
        setPortions(
          existingPortions.map((p) => ({
            id: p.id,
            name: p.name,
            price: Number(p.price),
          })),
        )
      } else if (item.price != null) {
        // If no portions stored but there is a base price, you can treat it as "Full"
        setPortions([{ name: "Full", price: Number(item.price) }])
      } else {
        setPortions([])
      }

      // NEW: load existing quick notes if present
      const existingQuickNotes = (item as any).quick_notes ?? []
      setQuickNotes(existingQuickNotes)
    } else {
      // If initialValues provided use them, otherwise default to first main if available
      const defaultMain = initialValues?.category ?? (mains.length > 0 ? mains[0] : "")
      const defaultSub = initialValues?.sub_category ?? ""
      setFormData({
        name: "",
        name_ar: "",
        category: defaultMain,
        sub_category: defaultSub,
        price: "",
        description: "",
        image_url: "",
        is_vegetarian: false,
        station_id: "", // default empty for new items
        apply_vat: false,
      })
      setRecipe([])
      setImagePreview("")
      setPortions([]) // NEW
      setQuickNotes([]) // NEW
    }

    // Listen for menu-updated event to refresh the component only if necessary
    const handleMenuUpdated = (event: Event) => {
      const customEvent = event as CustomEvent
      if (customEvent.detail?.updatedItemId === item?.id) {
        setFormData((prev) => ({ ...prev, ...customEvent.detail.updatedData }))
        setImagePreview(customEvent.detail.updatedData.image_url || "")
      }
    }
    window.addEventListener("menu-updated", handleMenuUpdated)

    return () => {
      window.removeEventListener("menu-updated", handleMenuUpdated)
    }
  }, [item, categories, initialValues])

  const handleAddIngredient = () => {
    if (inventory.length > 0) {
      setRecipe([...recipe, { inventory_item_id: "", quantity_used: 0 }])
    }
  }

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setImageFile(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setImagePreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleRemoveImage = () => {
    setFormData({ ...formData, image_url: "" })
    setImagePreview("")
    setImageFile(null)
  }

  const handleRecipeChange = (index: number, field: keyof RecipeItem, value: string | number) => {
    const newRecipe = [...recipe]
      ; (newRecipe[index] as any)[field] = value
    setRecipe(newRecipe)
  }

  const handleRemoveIngredient = (index: number) => {
    setRecipe(recipe.filter((_, i) => i !== index))
  }

  // NEW: handlers for portion sizes
  const handleAddPortion = () => {
    setPortions((prev) => [...prev, { name: "", price: 0 }])
  }

  const handlePortionChange = (index: number, field: keyof Portion, value: string) => {
    setPortions((prev) => {
      const copy = [...prev]
      if (field === "price") {
        copy[index].price = Number(value)
      } else {
        ; (copy[index] as any)[field] = value
      }
      return copy
    })
  }

  const handleRemovePortion = (index: number) => {
    setPortions((prev) => prev.filter((_, i) => i !== index))
  }

  // NEW: handlers for quick notes
  const handleAddQuickNote = () => {
    if (newQuickNote.trim() && !quickNotes.includes(newQuickNote.trim())) {
      setQuickNotes((prev) => [...prev, newQuickNote.trim()])
      setNewQuickNote("")
    }
  }

  const handleRemoveQuickNote = (index: number) => {
    setQuickNotes((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      let imageUrl = formData.image_url

      // If there's a new image file, upload it first
      if (imageFile) {
        imageUrl = await uploadMenuItemImage(imageFile, formData.category, formData.sub_category || null, formData.name)
      }

      const basePrice = Number.parseFloat(formData.price)

      // ✅ SAFE portion cleaning: ignore blank / invalid rows
      let cleanedPortions = portions
        .filter((p) => p.name.trim() !== "" && !Number.isNaN(Number(p.price)) && Number(p.price) > 0)
        .map((p) => ({
          name: p.name.trim(),
          price: Number(p.price),
        }))

      // ✅ If there are portions and no "Full", auto-add Full = base price
      if (cleanedPortions.length > 0 && !Number.isNaN(basePrice) && basePrice > 0) {
        const hasFull = cleanedPortions.some((p) => p.name.trim().toLowerCase() === "full")
        if (!hasFull) {
          cleanedPortions = [...cleanedPortions, { name: "Full", price: basePrice }]
        }
      }

      const finalPortionSizes = cleanedPortions.length > 0 ? cleanedPortions : null

      const payload: any = {
        name: formData.name,
        name_ar: formData.name_ar || null,
        category: formData.category || undefined,
        sub_category: formData.sub_category || null,
        price: basePrice,
        available: item?.available ?? true,
        description: formData.description || null,
        image_url: imageUrl || null,
        is_vegetarian: formData.is_vegetarian,
        station_id: formData.station_id || null, // include station_id in payload
        apply_vat: formData.apply_vat,
        recipe: recipe
          .map((r) => ({
            inventory_item_id: r.inventory_item_id,
            quantity_used: Number(r.quantity_used),
          }))
          .filter((r) => r.inventory_item_id && r.quantity_used > 0),
        // NEW: send portion_sizes to backend (JSONB column)
        portion_sizes: finalPortionSizes,
        // NEW: send quick_notes to backend (JSONB column)
        quick_notes: quickNotes.length > 0 ? quickNotes : null,
      }

      if (item) {
        await updateMenuItem(item.id, payload)
      } else {
        await addMenuItem(payload as MenuItemWithRecipe)
      }
      window.dispatchEvent(new CustomEvent("menu-updated"))
      onClose()
    } catch (error) {
      console.error("Error saving menu item:", error)
      toast.error("Failed to save menu item. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-2xl font-semibold text-gray-800">{item ? "Edit Menu Item" : "Add New Menu Item"}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={24} />
          </button>
        </div>

        <form id="menu-item-form" onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Item Name (English)</label>
              <input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Chicken Biriyani"
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Item Name (Arabic)</label>
              <input
                value={formData.name_ar}
                onChange={(e) => setFormData({ ...formData, name_ar: e.target.value })}
                placeholder="e.g., برياني الدجاج"
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                dir="rtl"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Describe the dish (optional)"
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              rows={3}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Item Photo</label>
            <div className="space-y-2">
              {imagePreview ? (
                <div className="relative inline-block">
                  <img
                    src={imagePreview || "/placeholder.svg"}
                    alt="Preview"
                    className="w-full max-w-xs h-48 object-cover rounded-md border-2 border-gray-300"
                  />
                  <button
                    type="button"
                    onClick={handleRemoveImage}
                    className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                  >
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-center w-full">
                  <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <ImageIcon className="w-10 h-10 mb-2 text-gray-400" />
                      <p className="text-sm text-gray-500">
                        <span className="font-semibold">Click to upload</span> or drag and drop
                      </p>
                      <p className="text-xs text-gray-400">PNG, JPG, GIF (MAX. 5MB)</p>
                    </div>
                    <input type="file" className="hidden" accept="image/*" onChange={handleImageChange} />
                  </label>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Main Category</label>
              <select
                value={formData.category}
                onChange={(e) => {
                  const newMain = e.target.value
                  setFormData({ ...formData, category: newMain, sub_category: "" })
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                required
              >
                <option value="">-- select main category --</option>
                {mains.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sub Category</label>
              <select
                value={formData.sub_category ?? ""}
                onChange={(e) => setFormData({ ...formData, sub_category: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="">(no sub category)</option>
                {(subMap[formData.category] || []).map((s) => (
                  <option key={s.id} value={s.sub ?? ""}>
                    {s.sub ?? "(no sub)"}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Base Price</label>
              <input
                type="number"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                placeholder="e.g., 180"
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                required
                min="0"
                step="0.01"
              />
              <p className="mt-1 text-xs text-gray-400">
                Used when no specific portion is selected. You can still add detailed portions below.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <span className="flex items-center gap-1">
                  <ChefHat size={14} />
                  Kitchen Station
                </span>
              </label>
              <select
                value={formData.station_id}
                onChange={(e) => setFormData({ ...formData, station_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="">(No station assigned)</option>
                {kitchenStations.map((station) => (
                  <option key={station.id} value={station.id}>
                    {station.name}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-gray-400">
                Where this item is prepared.
              </p>
            </div>
          </div>

          <div className="pt-4 border-t">
            <label className="block text-sm font-medium text-gray-700 mb-3">Diet Type</label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, is_vegetarian: true })}
                className={`flex-1 px-4 py-2 rounded-lg font-semibold flex items-center justify-center gap-2 transition-colors ${formData.is_vegetarian
                  ? "bg-green-500 text-white"
                  : "bg-green-50 text-green-700 border border-green-300 hover:bg-green-100"
                  }`}
              >
                <Leaf size={18} />
                Vegetarian
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, is_vegetarian: false })}
                className={`flex-1 px-4 py-2 rounded-lg font-semibold transition-colors ${!formData.is_vegetarian
                  ? "bg-red-500 text-white"
                  : "bg-red-50 text-red-700 border border-red-300 hover:bg-red-100"
                  }`}
              >
                Non-Vegetarian
              </button>
            </div>
          </div>

          <div className="pt-4 border-t">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.apply_vat}
                onChange={(e) => setFormData({ ...formData, apply_vat: e.target.checked })}
                className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <div>
                <span className="text-sm font-medium text-gray-700">Apply VAT to this item</span>
                <p className="text-xs text-gray-500">Enable to include VAT in price calculations</p>
              </div>
            </label>
          </div>

          <div className="pt-4 border-t">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-lg font-semibold text-gray-800">Portion Sizes / Variants</h3>
              <button
                type="button"
                onClick={handleAddPortion}
                className="px-3 py-1 bg-green-50 text-green-700 rounded-md text-sm font-semibold hover:bg-green-100 flex items-center gap-1"
              >
                <Plus size={16} /> Add Portion
              </button>
            </div>

            <div className="space-y-2">
              {portions.map((portion, index) => (
                <div
                  key={index}
                  className="grid grid-cols-[1fr,120px,auto] gap-2 items-center p-2 bg-gray-50 rounded-md"
                >
                  <input
                    type="text"
                    value={portion.name}
                    onChange={(e) => handlePortionChange(index, "name", e.target.value)}
                    placeholder="e.g., Quarter, Half, Full"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  />
                  <input
                    type="number"
                    value={portion.price}
                    onChange={(e) => handlePortionChange(index, "price", e.target.value)}
                    placeholder="Price"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    min="0"
                    step="0.01"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemovePortion(index)}
                    className="p-2 text-red-500 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              ))}

              {portions.length === 0 && (
                <div className="text-center py-4 border-2 border-dashed rounded-lg text-sm text-gray-500">
                  No portions added. The item will just use the base price.
                </div>
              )}
            </div>
          </div>

          <div className="pt-4 border-t">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-lg font-semibold text-gray-800">Quick Notes</h3>
            </div>
            <p className="text-xs text-gray-400 mb-3">
              Add quick notes that will appear when ordering this item in the waiter app.
            </p>

            {/* Add new quick note */}
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                value={newQuickNote}
                onChange={(e) => setNewQuickNote(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), handleAddQuickNote())}
                placeholder="e.g., Less Spicy, No Onion, Extra Cheese..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
              <button
                type="button"
                onClick={handleAddQuickNote}
                disabled={!newQuickNote.trim()}
                className="px-3 py-2 bg-purple-50 text-purple-700 rounded-md text-sm font-semibold hover:bg-purple-100 flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus size={16} /> Add
              </button>
            </div>

            {/* Display added quick notes */}
            <div className="flex flex-wrap gap-2">
              {quickNotes.map((note, index) => (
                <div
                  key={index}
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-purple-50 text-purple-700 rounded-full text-sm"
                >
                  <span>{note}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveQuickNote(index)}
                    className="p-0.5 hover:bg-purple-200 rounded-full transition-colors"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>

            {quickNotes.length === 0 && (
              <div className="text-center py-4 border-2 border-dashed rounded-lg text-sm text-gray-500">
                No quick notes added. Default notes will be used in the waiter app.
              </div>
            )}
          </div>

          <div className="pt-4 border-t">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-lg font-semibold text-gray-800">Recipe Ingredients</h3>
              <button
                type="button"
                onClick={handleAddIngredient}
                className="px-3 py-1 bg-blue-50 text-blue-600 rounded-md text-sm font-semibold hover:bg-blue-100 flex items-center gap-1"
              >
                <Plus size={16} /> Add Ingredient
              </button>
            </div>

            <div className="space-y-2">
              {recipe.map((ingredient, index) => (
                <div
                  key={index}
                  className="grid grid-cols-[1fr,140px,auto] gap-2 items-center p-2 bg-gray-50 rounded-md"
                >
                  <select
                    value={ingredient.inventory_item_id}
                    onChange={(e) => handleRecipeChange(index, "inventory_item_id", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    required
                  >
                    <option value="" disabled>
                      Select ingredient...
                    </option>
                    {inventory.map((invItem) => (
                      <option key={invItem.id} value={invItem.id}>
                        {invItem.item_name}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    value={ingredient.quantity_used}
                    onChange={(e) => handleRecipeChange(index, "quantity_used", e.target.value)}
                    placeholder="Qty Used"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    step="0.001"
                    min="0"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveIngredient(index)}
                    className="p-2 text-red-500 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              ))}

              {recipe.length === 0 && (
                <div className="text-center py-6 border-2 border-dashed rounded-lg">
                  <p className="text-sm text-gray-500">No ingredients added.</p>
                  <p className="text-xs text-gray-400 mt-1">This item will not affect inventory stock.</p>
                </div>
              )}
            </div>
          </div>
        </form>

        <div className="p-4 mt-auto bg-gray-50 rounded-b-xl flex justify-end gap-3 border-t">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg font-semibold hover:bg-gray-300"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="menu-item-form"
            disabled={isSubmitting}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:bg-blue-300"
          >
            {isSubmitting ? "Saving..." : "Save Item"}
          </button>
        </div>
      </div>
    </div>
  )
}

export default MenuItemModal
