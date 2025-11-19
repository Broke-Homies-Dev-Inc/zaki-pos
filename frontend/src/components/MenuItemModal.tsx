// frontend/src/components/MenuItemModal.tsx
import { useState, useEffect, type FormEvent } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { useMenuItems } from '../hooks/useMenuItems';
import { useInventory } from '../hooks/useInventory';
import type { Database } from '../lib/database.types';

type RecipeItem = { inventory_item_id: string; quantity_used: number; item_name?: string; };
type MenuItemInsert = Database['public']['Tables']['menu_items']['Insert'];
type MenuItemWithRecipe = Omit<MenuItemInsert, 'id'> & { recipe: RecipeItem[] };
type MenuItemRow = Database['public']['Tables']['menu_items']['Row'] & { recipe?: RecipeItem[] };

interface MenuItemModalProps {
  item: MenuItemRow | null;
  onClose: () => void;
  // categories rows from backend: { id, main_category, sub_category }
  categories?: { id: string; main_category: string; sub_category: string | null }[];
  // optional initial values when adding a new item
  initialValues?: { category?: string; sub_category?: string };
}

export function MenuItemModal({ item, onClose, categories = [], initialValues }: MenuItemModalProps) {
  const { addMenuItem, updateMenuItem } = useMenuItems();
  const { inventory } = useInventory();

  const [formData, setFormData] = useState({ name: '', category: '', sub_category: '', price: '' });
  const [recipe, setRecipe] = useState<RecipeItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // derive unique mains and submap
  const mains = Array.from(new Set(categories.map(c => c.main_category))).sort((a,b)=>a.localeCompare(b));
  const subMap: Record<string, { id: string; sub: string | null }[]> = {};
  categories.forEach(c => {
    subMap[c.main_category] = subMap[c.main_category] || [];
    subMap[c.main_category].push({ id: c.id, sub: c.sub_category });
  });

  useEffect(() => {
    if (item) {
      setFormData({
        name: item.name,
        category: item.category || '',
        sub_category: item.sub_category ?? '',
        price: String(item.price ?? '')
      });
      setRecipe(item.recipe || []);
    } else {
      // If initialValues provided use them, otherwise default to first main if available
      const defaultMain = initialValues?.category ?? (mains.length > 0 ? mains[0] : '');
      const defaultSub = initialValues?.sub_category ?? '';
      setFormData({ name: '', category: defaultMain, sub_category: defaultSub, price: '' });
      setRecipe([]);
    }
  }, [item, categories, initialValues, mains.length]); // react when categories or initialValues change too

  const handleAddIngredient = () => {
    if (inventory.length > 0) {
      setRecipe([...recipe, { inventory_item_id: '', quantity_used: 0 }]);
    }
  };

  const handleRecipeChange = (index: number, field: keyof RecipeItem, value: string | number) => {
    const newRecipe = [...recipe];
    (newRecipe[index] as any)[field] = value;
    setRecipe(newRecipe);
  };

  const handleRemoveIngredient = (index: number) => {
    setRecipe(recipe.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const payload: Partial<MenuItemWithRecipe> = {
      name: formData.name,
      category: formData.category || null,
      sub_category: formData.sub_category || null,
      price: parseFloat(formData.price),
      available: item?.available ?? true,
      recipe: recipe
        .map(r => ({
          inventory_item_id: r.inventory_item_id,
          quantity_used: Number(r.quantity_used)
        }))
        .filter(r => r.inventory_item_id && r.quantity_used > 0),
    };

    try {
      if (item) {
        await updateMenuItem(item.id, payload);
      } else {
        await addMenuItem(payload as MenuItemWithRecipe);
      }
      window.dispatchEvent(new CustomEvent('menu-updated'));
    } finally {
      setIsSubmitting(false);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-2xl font-semibold text-gray-800">{item ? 'Edit Menu Item' : 'Add New Menu Item'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={24} /></button>
        </div>

        <form id="menu-item-form" onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Item Name</label>
            <input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="e.g., Chicken Biriyani" className="w-full px-3 py-2 border border-gray-300 rounded-md" required />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Main Category</label>
              <select
                value={formData.category}
                onChange={e => {
                  const newMain = e.target.value;
                  setFormData({ ...formData, category: newMain, sub_category: '' });
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                required
              >
                <option value="">-- select main category --</option>
                {mains.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sub Category</label>
              <select
                value={formData.sub_category ?? ''}
                onChange={e => setFormData({ ...formData, sub_category: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="">(no sub category)</option>
                {(subMap[formData.category] || []).map(s => (
                  <option key={s.id} value={s.sub ?? ''}>{s.sub ?? '(no sub)'}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Price</label>
            <input type="number" value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} placeholder="e.g., 180" className="w-full px-3 py-2 border border-gray-300 rounded-md" required min="0" step="0.01" />
          </div>

          <div className="pt-4 border-t">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-lg font-semibold text-gray-800">Recipe Ingredients</h3>
              <button type="button" onClick={handleAddIngredient} className="px-3 py-1 bg-blue-50 text-blue-600 rounded-md text-sm font-semibold hover:bg-blue-100 flex items-center gap-1">
                <Plus size={16} /> Add Ingredient
              </button>
            </div>

            <div className="space-y-2">
              {recipe.map((ingredient, index) => (
                <div key={index} className="grid grid-cols-[1fr,140px,auto] gap-2 items-center p-2 bg-gray-50 rounded-md">
                  <select
                    value={ingredient.inventory_item_id}
                    onChange={(e) => handleRecipeChange(index, 'inventory_item_id', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md" required >
                    <option value="" disabled>Select ingredient...</option>
                    {inventory.map(invItem => ( <option key={invItem.id} value={invItem.id}>{invItem.item_name}</option> ))}
                  </select>
                  <input type="number" value={ingredient.quantity_used} onChange={(e) => handleRecipeChange(index, 'quantity_used', e.target.value)} placeholder="Qty Used" className="w-full px-3 py-2 border border-gray-300 rounded-md" step="0.001" min="0" required />
                  <button type="button" onClick={() => handleRemoveIngredient(index)} className="p-2 text-red-500 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"> <Trash2 size={18} /> </button>
                </div>
              ))}
              {recipe.length === 0 && <div className="text-center py-6 border-2 border-dashed rounded-lg"> <p className="text-sm text-gray-500">No ingredients added.</p> <p className="text-xs text-gray-400 mt-1">This item will not affect inventory stock.</p> </div>}
            </div>
          </div>
        </form>

        <div className="p-4 mt-auto bg-gray-50 rounded-b-xl flex justify-end gap-3 border-t">
          <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg font-semibold hover:bg-gray-300">Cancel</button>
          <button type="submit" form="menu-item-form" disabled={isSubmitting} className="px-6 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:bg-blue-300"> {isSubmitting ? 'Saving...' : 'Save Item'} </button>
        </div>
      </div>
    </div>
  );
}

export default MenuItemModal;
