import { useState, useMemo } from 'react';
import { Search } from 'lucide-react';
import { useMenuItems } from '../hooks/useMenuItems';
import { InventoryItemModal } from '../components/InventoryItemModal';
import { useRestaurantSettingsContext } from '../contexts/useRestaurantSettingsContext';
import type { Database } from '../lib/database.types';

import { toast } from 'react-toastify';

type InventoryItem = Database['public']['Tables']['inventory']['Row'];

export function Inventory() {
  const { menuItems, adjustStock, updateMenuItem } = useMenuItems();
  const [isModalOpen, setModalOpen] = useState(false);
  const [editingItem] = useState<InventoryItem | null>(null);

  // Stock adjustment modal for menu items
  const [isStockModalOpen, setIsStockModalOpen] = useState(false);
  const [stockAdjustItem, setStockAdjustItem] = useState<any>(null);
  const [stockAdjustment, setStockAdjustment] = useState('');
  const [isAdjusting, setIsAdjusting] = useState(false);

  // Low stock threshold editing
  const [editingThresholdId, setEditingThresholdId] = useState<string | null>(null);
  const [thresholdValue, setThresholdValue] = useState('');

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedSubCategory, setSelectedSubCategory] = useState<string>('all');

  // Remove unused settings import warning
  const { settings: _settings } = useRestaurantSettingsContext();

  // Get unique categories and subcategories
  const categories = useMemo(() => {
    const cats = new Set(menuItems.map(item => item.category));
    return Array.from(cats).sort();
  }, [menuItems]);

  const subCategories = useMemo(() => {
    if (selectedCategory === 'all') return [];
    const subCats = new Set(
      menuItems
        .filter(item => item.category === selectedCategory && item.sub_category)
        .map(item => item.sub_category!)
    );
    return Array.from(subCats).sort();
  }, [menuItems, selectedCategory]);

  const handleAdjustStock = async () => {
    if (!stockAdjustItem || !stockAdjustment) return;
    const adjustment = parseInt(stockAdjustment);
    if (isNaN(adjustment)) {
      toast.error('Please enter a valid whole number');
      return;
    }

    // Validate: adjustment must be a whole number
    if (!Number.isInteger(adjustment)) {
      toast.error('Stock adjustment must be a whole number (no decimals)');
      return;
    }

    // Validate: stock cannot go negative
    const currentStock = stockAdjustItem.stock ?? 0;
    const newStock = currentStock + adjustment;
    if (newStock < 0) {
      toast.error(`Cannot reduce stock below 0. Current stock is ${currentStock}, attempted adjustment: ${adjustment}`);
      return;
    }

    setIsAdjusting(true);
    try {
      await adjustStock(stockAdjustItem.id, adjustment);
      setIsStockModalOpen(false);
      setStockAdjustItem(null);
      setStockAdjustment('');
    } catch (err) {
      toast.error('Failed to adjust stock');
    } finally {
      setIsAdjusting(false);
    }
  };

  const handleUpdateThreshold = async (itemId: string, newThreshold: number) => {
    try {
      await updateMenuItem(itemId, { low_stock_threshold: newThreshold } as any);
      setEditingThresholdId(null);
      setThresholdValue('');
    } catch (err) {
      alert('Failed to update threshold');
    }
  };

  const getMenuItemStockBadge = (stock?: number, threshold?: number) => {
    if (stock === undefined || stock === null) return 'bg-gray-100 text-gray-700';
    if (stock === 0) return 'bg-red-100 text-red-700';
    if (threshold && stock <= threshold) return 'bg-yellow-100 text-yellow-700';
    return 'bg-green-100 text-green-700';
  };

  // Filter menu items based on search and category filters
  const filteredMenuItems = menuItems.filter(item => {
    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const matchesSearch =
        item.name.toLowerCase().includes(query) ||
        item.category.toLowerCase().includes(query) ||
        item.sub_category?.toLowerCase().includes(query);
      if (!matchesSearch) return false;
    }

    // Category filter
    if (selectedCategory !== 'all' && item.category !== selectedCategory) {
      return false;
    }

    // Subcategory filter
    if (selectedSubCategory !== 'all' && item.sub_category !== selectedSubCategory) {
      return false;
    }

    return true;
  });

  return (
    <div className="h-full flex flex-col">
      {/* Page Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Stock Management</h1>
          <p className="mt-1 text-gray-600">Monitor and adjust stock levels for menu items</p>
        </div>
      </div>

      {/* Search Bar */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Search menu items..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      {/* Filter Dropdowns */}
      <div className="mb-6 flex gap-4">
        <div className="w-64">
          <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
          <select
            value={selectedCategory}
            onChange={(e) => {
              setSelectedCategory(e.target.value);
              setSelectedSubCategory('all');
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">All Categories</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        {selectedCategory !== 'all' && subCategories.length > 0 && (
          <div className="w-64">
            <label className="block text-sm font-medium text-gray-700 mb-2">Sub-Category</label>
            <select
              value={selectedSubCategory}
              onChange={(e) => setSelectedSubCategory(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Sub-Categories</option>
              {subCategories.map((subCat) => (
                <option key={subCat} value={subCat}>{subCat}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Menu Items Stock Table */}
      <div className="flex-1 bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden flex flex-col">
        <div className="flex-1 overflow-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Menu Item</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Current Stock</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Low Stock Alert At</th>
                <th className="relative px-6 py-3"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredMenuItems.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-16">
                    <div className="text-gray-500">
                      <p className="text-lg font-medium">No menu items found</p>
                      {searchQuery && (
                        <p className="text-sm mt-2">Try adjusting your search</p>
                      )}
                    </div>
                  </td>
                </tr>
              )}
              {filteredMenuItems.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 font-medium text-gray-900">{item.name}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    <div className="flex flex-col">
                      <span>{item.category}</span>
                      {item.sub_category && (
                        <span className="text-xs text-gray-400 mt-0.5">{item.sub_category}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getMenuItemStockBadge(item.stock, item.low_stock_threshold)}`}>
                      {item.stock ?? 0}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    {item.stock === 0 ? (
                      <div className="flex items-center justify-center gap-2">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-800 bg-red-100 rounded-lg border-2 border-red-300">
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                          </svg>
                          Out of Stock
                        </span>
                      </div>
                    ) : (item.low_stock_threshold && item.stock && item.stock <= item.low_stock_threshold && item.stock >= 0) ? (
                      <div className="flex items-center justify-center gap-2">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-amber-800 bg-amber-100 rounded-lg border-2 border-amber-300 animate-pulse">
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                          Low Stock Warning
                        </span>
                      </div>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-green-800 bg-green-100 rounded-lg border border-green-200">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        In Stock
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-center">
                    {editingThresholdId === item.id ? (
                      <div className="flex items-center justify-center gap-2">
                        <input
                          type="number"
                          value={thresholdValue}
                          onChange={(e) => setThresholdValue(e.target.value)}
                          className="w-20 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              const val = parseFloat(thresholdValue);
                              if (!isNaN(val)) handleUpdateThreshold(item.id, val);
                            } else if (e.key === 'Escape') {
                              setEditingThresholdId(null);
                              setThresholdValue('');
                            }
                          }}
                        />
                        <button
                          onClick={() => {
                            const val = parseFloat(thresholdValue);
                            if (!isNaN(val)) handleUpdateThreshold(item.id, val);
                          }}
                          className="text-green-600 hover:text-green-800 text-xs font-medium"
                        >
                          ✓
                        </button>
                        <button
                          onClick={() => {
                            setEditingThresholdId(null);
                            setThresholdValue('');
                          }}
                          className="text-red-600 hover:text-red-800 text-xs font-medium"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center gap-2">
                        <span className="text-gray-900 font-medium">{item.low_stock_threshold ?? 5}</span>
                        <button
                          onClick={() => {
                            setEditingThresholdId(item.id);
                            setThresholdValue(String(item.low_stock_threshold ?? 5));
                          }}
                          className="text-blue-600 hover:text-blue-800 text-sm font-medium px-2 py-1 hover:bg-blue-50 rounded transition-colors"
                          title="Edit threshold"
                        >
                          Edit
                        </button>
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => {
                        setStockAdjustItem(item);
                        setIsStockModalOpen(true);
                      }}
                      className="text-blue-600 hover:text-blue-900 font-medium text-sm px-3 py-1.5 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      Adjust Stock
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer with count */}
        {filteredMenuItems.length > 0 && (
          <div className="px-6 py-3 border-t border-gray-200 bg-gray-50">
            <p className="text-sm text-gray-600">
              Showing {filteredMenuItems.length} of {menuItems.length} menu item{menuItems.length !== 1 ? 's' : ''}
            </p>
          </div>
        )}
      </div>

      {/* Modal for adding/editing raw ingredients */}
      {isModalOpen && <InventoryItemModal item={editingItem} onClose={() => setModalOpen(false)} />}

      {/* Stock Adjustment Modal for Menu Items */}
      {isStockModalOpen && stockAdjustItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Adjust Stock</h3>
              <button
                onClick={() => {
                  setIsStockModalOpen(false);
                  setStockAdjustItem(null);
                  setStockAdjustment('');
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>

            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-1">Menu Item:</p>
              <p className="font-medium text-gray-900">{stockAdjustItem.name}</p>
              <p className="text-sm text-gray-500 mt-2">
                Current Stock: <span className="font-semibold">{stockAdjustItem.stock ?? 0}</span>
              </p>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Stock Adjustment
              </label>
              <input
                type="number"
                value={stockAdjustment}
                onChange={(e) => setStockAdjustment(e.target.value)}
                placeholder="e.g., +10 or -5"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                step="1"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && stockAdjustment) {
                    handleAdjustStock();
                  } else if (e.key === 'Escape') {
                    setIsStockModalOpen(false);
                    setStockAdjustItem(null);
                    setStockAdjustment('');
                  }
                }}
              />
              <p className="text-xs text-gray-500 mt-1">
                Use positive numbers to add stock, negative to subtract (whole numbers only)
              </p>
              {stockAdjustment && !isNaN(parseFloat(stockAdjustment)) && (() => {
                const currentStock = stockAdjustItem.stock ?? 0;
                const adjustment = parseInt(stockAdjustment);
                const newStock = currentStock + adjustment;
                const isValid = Number.isInteger(adjustment) && newStock >= 0;
                return (
                  <p className={`text-sm mt-2 ${!isValid ? 'text-red-600' : ''}`}>
                    New stock will be: <span className={`font-semibold ${isValid ? 'text-blue-600' : 'text-red-600'}`}>
                      {newStock}
                    </span>
                    {!Number.isInteger(adjustment) && <span className="block text-xs text-red-600 mt-1">⚠ Must be a whole number</span>}
                    {newStock < 0 && <span className="block text-xs text-red-600 mt-1">⚠ Stock cannot be negative</span>}
                  </p>
                );
              })()}
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setIsStockModalOpen(false);
                  setStockAdjustItem(null);
                  setStockAdjustment('');
                }}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleAdjustStock}
                disabled={isAdjusting || !stockAdjustment}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:bg-blue-300 disabled:cursor-not-allowed"
              >
                {isAdjusting ? 'Adjusting...' : 'Apply Adjustment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}