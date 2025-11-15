import { useState } from 'react';
import { Plus, Edit, Trash2 } from 'lucide-react';
import { useMenuItems } from '../hooks/useMenuItems';
import { MenuItemModal } from '../components/MenuItemModal';
import { formatCurrency } from '../lib/utils';
import type { Database } from '../lib/database.types';

type MenuItem = Database['public']['Tables']['menu_items']['Row'];

export function Menu() { // <--- The 'export' keyword is here
  const { menuItems, loading, error, updateMenuItem, deleteMenuItem } = useMenuItems();
  const [isModalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);

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

  return (
    <div>
      {/* Header Section */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Menu Management</h1>
          <p className="mt-1 text-gray-600">Add, edit, and manage your restaurant's menu items.</p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="bg-blue-600 text-white font-semibold px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 transition-colors"
        >
          <Plus size={20} />
          Add New Item
        </button>
      </div>

      {/* Menu Items Table */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item Name</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Available</th>
                <th scope="col" className="relative px-6 py-3"><span className="sr-only">Actions</span></th>
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
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{item.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.category}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800 text-right font-medium">{formatCurrency(item.price)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={item.available}
                          onChange={() => handleToggleAvailability(item)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-focus:ring-4 peer-focus:ring-blue-300 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                      <button onClick={() => handleOpenModal(item)} className="text-blue-600 hover:text-blue-900 p-1"><Edit size={18} /></button>
                      <button onClick={() => handleDelete(item.id)} className="text-red-600 hover:text-red-900 p-1"><Trash2 size={18} /></button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal for adding/editing a menu item */}
      {isModalOpen && <MenuItemModal item={editingItem} onClose={() => setModalOpen(false)} />}
    </div>
  );
}