// frontend/src/pages/Menu.tsx
import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2 } from 'lucide-react';
import { useMenuItems } from '../hooks/useMenuItems';
import { MenuItemModal } from '../components/MenuItemModal';
import { formatCurrency } from '../lib/utils';
import { useRestaurantSettingsContext } from '../contexts/useRestaurantSettingsContext';
import type { Database } from '../lib/database.types';
import api from '../lib/api';

type MenuItem = Database['public']['Tables']['menu_items']['Row'];

export function Menu() {
  const { menuItems, loading, error, updateMenuItem, deleteMenuItem } = useMenuItems();
  const [isModalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);

  const [categories, setCategories] = useState<string[]>([]);
  const [isCatModalOpen, setIsCatModalOpen] = useState(false);
  const [newCategory, setNewCategory] = useState('');
  const [catSaving, setCatSaving] = useState(false);
  const [catError, setCatError] = useState<string | null>(null);

  const handleOpenModal = (item: MenuItem | null = null) => {
    setEditingItem(item);
    setModalOpen(true);
  };

  const handleToggleAvailability = async (item: MenuItem) => {
    const updatePayload = {
      name: item.name,
      category: item.category,
      price: item.price,
      available: !item.available,
      inventory_item_id: item.inventory_item_id,
      quantity_per_order: item.quantity_per_order
    };
    await updateMenuItem(item.id, updatePayload);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this menu item?')) {
      await deleteMenuItem(id);
    }
  };

  const { settings } = useRestaurantSettingsContext();

  useEffect(() => {
    loadCategories();
  }, []);

  async function loadCategories() {
    try {
      const resp = await api.get<string[]>('/menu/categories');
      setCategories(resp.data || []);
    } catch (err) {
      setCategories([]);
    }
  }

  const openAddCategory = () => {
    setNewCategory('');
    setCatError(null);
    setIsCatModalOpen(true);
  };

  const createCategory = async () => {
    if (!newCategory.trim()) {
      setCatError('Category name required');
      return;
    }

    setCatSaving(true);
    try {
      await api.post('/menu/categories', { name: newCategory.trim() });
      await loadCategories();
      setIsCatModalOpen(false);
    } catch (err: any) {
      setCatError(err?.response?.data?.message || 'Failed to create category');
    } finally {
      setCatSaving(false);
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Menu Management</h1>
          <p className="mt-1 text-gray-600">Add, edit, and manage your restaurant's menu items.</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={openAddCategory}
            className="bg-green-600 text-white font-semibold px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-green-700 transition-colors"
          >
            <Plus size={16} />
            Add Category
          </button>

          <button
            onClick={() => handleOpenModal()}
            className="bg-blue-600 text-white font-semibold px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 transition-colors"
          >
            <Plus size={20} />
            Add New Item
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Available</th>
                <th className="relative px-6 py-3"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>

            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr><td colSpan={5} className="text-center py-10 text-gray-500">Loading menu...</td></tr>
              ) : error ? (
                <tr><td colSpan={5} className="text-center py-10 text-red-500">Error loading menu.</td></tr>
              ) : menuItems.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-10 text-gray-500">No menu items found.</td></tr>
              ) : (
                menuItems.map((item) => (
                  <tr key={item.id}>
                    <td className="px-6 py-4 whitespace-nowrap">{item.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{item.category}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      {formatCurrency(item.price, settings?.currency || 'OMR')}
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={item.available}
                          onChange={() => handleToggleAvailability(item)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:bg-blue-600 after:absolute after:top-0.5 after:left-[2px] after:h-5 after:w-5 after:bg-white after:rounded-full after:border after:transition-all peer-checked:after:translate-x-full"></div>
                      </label>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap text-right space-x-2">
                      <button onClick={() => handleOpenModal(item)} className="text-blue-600 hover:text-blue-900 p-1">
                        <Edit size={18} />
                      </button>
                      <button onClick={() => handleDelete(item.id)} className="text-red-600 hover:text-red-900 p-1">
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal for adding/editing */}
      {isModalOpen && (
        <MenuItemModal
          item={editingItem}
          onClose={() => setModalOpen(false)}
          categories={categories}
        />
      )}

      {/* Add Category Modal */}
      {isCatModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-lg">
            <h3 className="text-lg font-semibold mb-4">Add Category</h3>

            <input
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              className="w-full border rounded p-2 mb-2"
              placeholder="e.g. Drinks, Starters"
            />

            {catError && <p className="text-red-600 text-sm mb-2">{catError}</p>}

            <div className="flex justify-end gap-3">
              <button className="px-4 py-2 bg-gray-200 rounded" onClick={() => setIsCatModalOpen(false)}>Cancel</button>
              <button className="px-4 py-2 bg-green-600 text-white rounded" onClick={createCategory}>
                {catSaving ? 'Saving...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Menu;
