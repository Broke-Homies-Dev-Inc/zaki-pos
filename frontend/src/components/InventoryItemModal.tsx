import { useState, useEffect, type FormEvent } from 'react';
import { X } from 'lucide-react';
import { useInventory } from '../hooks/useInventory';
import type { Database } from '../lib/database.types';

type InventoryItem = Database['public']['Tables']['inventory']['Row'];
type InventoryItemInsert = Database['public']['Tables']['inventory']['Insert'];
type InventoryItemUpdate = Database['public']['Tables']['inventory']['Update'];

interface InventoryItemModalProps {
  item: InventoryItem | null;
  onClose: () => void;
}

export function InventoryItemModal({ item, onClose }: InventoryItemModalProps) {
  const { addInventoryItem, updateInventoryItem } = useInventory();

  // FIX 1: State now uses strings for form inputs.
  const [formData, setFormData] = useState({
    item_name: '',
    quantity: '0',
    cost: '0.00',
    low_stock_threshold: '10',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (item) {
      // FIX 2: Convert incoming numbers to strings when editing an item.
      setFormData({
        item_name: item.item_name,
        quantity: String(item.quantity),
        cost: String(item.cost),
        low_stock_threshold: String(item.low_stock_threshold),
      });
    }
  }, [item]);

  // FIX 3: The change handler now simply updates the string values.
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    // FIX 4: Convert strings to numbers ONLY on submission.
    const payload = {
      item_name: formData.item_name,
      quantity: parseInt(formData.quantity, 10),
      cost: parseFloat(formData.cost),
      low_stock_threshold: parseInt(formData.low_stock_threshold, 10),
    };

    // Validation
    if (!payload.item_name) {
      setError('Item name is required.');
      setIsSubmitting(false);
      return;
    }
    if (isNaN(payload.quantity) || payload.quantity < 0) {
      setError('Please enter a valid quantity.');
      setIsSubmitting(false);
      return;
    }

    if (item && item.id) {
      await updateInventoryItem(item.id, payload as InventoryItemUpdate);
    } else {
      await addInventoryItem(payload as InventoryItemInsert);
    }
    
    setIsSubmitting(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-gray-800">{item ? 'Edit Inventory Item' : 'Add New Inventory Item'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={24} /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="item_name" className="block text-sm font-medium text-gray-700">Item Name</label>
            <input type="text" name="item_name" id="item_name" value={formData.item_name} onChange={handleChange} required className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="quantity" className="block text-sm font-medium text-gray-700">Quantity</label>
              <input type="number" name="quantity" id="quantity" value={formData.quantity} onChange={handleChange} required min="0" className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md" />
            </div>
            <div>
              <label htmlFor="cost" className="block text-sm font-medium text-gray-700">Cost per Unit</label>
              <input type="number" name="cost" id="cost" value={formData.cost} onChange={handleChange} required min="0" step="0.01" className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md" />
            </div>
          </div>
          <div>
            <label htmlFor="low_stock_threshold" className="block text-sm font-medium text-gray-700">Low Stock Threshold</label>
            <input type="number" name="low_stock_threshold" id="low_stock_threshold" value={formData.low_stock_threshold} onChange={handleChange} required min="0" className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md" />
          </div>
          {error && <p className="text-sm text-red-600 pt-2">{error}</p>}
          <div className="pt-4 flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 rounded-md font-semibold">Cancel</button>
            <button type="submit" disabled={isSubmitting} className="px-4 py-2 bg-blue-600 text-white rounded-md font-semibold disabled:bg-blue-300">{isSubmitting ? 'Saving...' : 'Save Item'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}