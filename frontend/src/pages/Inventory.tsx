import { useState } from 'react';
import { Plus, Edit, Trash2 } from 'lucide-react';
import { useInventory } from '../hooks/useInventory';
import { InventoryItemModal } from '../components/InventoryItemModal';
import { formatCurrency } from '../lib/utils';
import { useRestaurantSettingsContext } from '../contexts/useRestaurantSettingsContext';
import type { Database } from '../lib/database.types';

type InventoryItem = Database['public']['Tables']['inventory']['Row'];

// Helper to determine the color of the stock status badge
const getStockStatusBadge = (quantity: number, threshold: number) => {
  if (quantity === 0) return 'bg-red-100 text-red-700';
  if (quantity <= threshold) return 'bg-yellow-100 text-yellow-700';
  return 'bg-green-100 text-green-700';
};

export function Inventory() {
  const { inventory, loading, error, deleteInventoryItem } = useInventory();
  const [isModalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);

  const handleOpenModal = (item: InventoryItem | null = null) => {
    setEditingItem(item);
    setModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this? This action cannot be undone.')) {
      await deleteInventoryItem(id);
    }
  };

  const { settings } = useRestaurantSettingsContext();

  return (
    <div>
      {/* Page Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Inventory Management</h1>
          <p className="mt-1 text-gray-600">Track stock levels of your raw ingredients.</p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="bg-blue-600 text-white font-semibold px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 transition-colors"
        >
          <Plus size={20} />
          Add Ingredient
        </button>
      </div>

      {/* Current Stock Report Table */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ingredient Name</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Quantity in Stock</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Cost per Unit</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Stock Status</th>
                <th className="relative px-6 py-3"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading && <tr><td colSpan={5} className="text-center py-10 text-gray-500">Loading inventory...</td></tr>}
              {error && <tr><td colSpan={5} className="text-center py-10 text-red-500">Error: {error}</td></tr>}
              {!loading && inventory.length === 0 && <tr><td colSpan={5} className="text-center py-10 text-gray-500">No inventory items found.</td></tr>}
              {!loading && inventory.map((item) => (
                <tr key={item.id}>
                  <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">{item.item_name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-gray-700">{item.quantity}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-gray-700">{formatCurrency(Number(item.cost), settings?.currency || 'OMR')}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStockStatusBadge(item.quantity, item.low_stock_threshold)}`}>
                      {item.quantity <= item.low_stock_threshold ? 'Low Stock' : 'In Stock'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                    <button onClick={() => handleOpenModal(item)} className="text-blue-600 hover:text-blue-900 p-1"><Edit size={18} /></button>
                    <button onClick={() => handleDelete(item.id)} className="text-red-600 hover:text-red-900 p-1"><Trash2 size={18} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal for adding/editing items */}
      {isModalOpen && <InventoryItemModal item={editingItem} onClose={() => setModalOpen(false)} />}
    </div>
  );
}