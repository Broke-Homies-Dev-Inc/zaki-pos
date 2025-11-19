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

// Category row returned from backend
type CatRow = { id: string; main_category: string; sub_category: string | null };

export function Menu() {
  const { menuItems: allMenuItems, loading, error, updateMenuItem, deleteMenuItem } = useMenuItems();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);

  // categories state + add category modal
  const [categoryRows, setCategoryRows] = useState<CatRow[]>([]);
  const [mainList, setMainList] = useState<string[]>([]);
  const [subMap, setSubMap] = useState<Record<string, (CatRow & { label: string })[]>>({});
  const [isCatModalOpen, setIsCatModalOpen] = useState(false);
  const [newMain, setNewMain] = useState('');
  const [newSub, setNewSub] = useState('');
  const [catSaving, setCatSaving] = useState(false);
  const [catError, setCatError] = useState<string | null>(null);

  // NEW: modal for adding a subcategory specifically (so we can prefill main)
  const [isSubModalOpen, setIsSubModalOpen] = useState(false);
  const [subModalMainPrefill, setSubModalMainPrefill] = useState<string | null>(null);

  // UI: selection for display
  const [selectedMain, setSelectedMain] = useState<string | null>(null);
  const [selectedSubId, setSelectedSubId] = useState<string | null>(null);

  // initial values when opening Add Item modal (preselect main & sub)
  const [modalInitial, setModalInitial] = useState<{ category?: string; sub_category?: string } | null>(null);

  const { settings } = useRestaurantSettingsContext();

  useEffect(() => {
    loadCategories();
    // reload on external events (if other pages fire them)
    const handler = () => loadCategories();
    window.addEventListener('categories-updated', handler);
    window.addEventListener('menu-updated', handler);
    return () => {
      window.removeEventListener('categories-updated', handler);
      window.removeEventListener('menu-updated', handler);
    };
  }, []);

  async function loadCategories() {
    try {
      const resp = await api.get<CatRow[]>('/menu/categories');
      const rows = resp.data || [];
      setCategoryRows(rows);

      // derive main list and sub map
      const mset = new Set<string>();
      const map: Record<string, (CatRow & { label: string })[]> = {};
      rows.forEach(r => {
        const main = r.main_category || 'Others';
        mset.add(main);
        map[main] = map[main] || [];
        map[main].push({ ...r, label: r.sub_category ?? '-' });
      });
      const mains = Array.from(mset).sort((a,b)=>a.localeCompare(b));
      setMainList(mains);
      setSubMap(map);
      try { localStorage.setItem('menu_categories', JSON.stringify(rows)); } catch {}
    } catch (err) {
      // fallback to local storage
      try {
        const cached = localStorage.getItem('menu_categories');
        if (cached) {
          const rows = JSON.parse(cached) as CatRow[];
          setCategoryRows(rows);
          const mset = new Set<string>();
          const map: Record<string, (CatRow & { label: string })[]> = {};
          rows.forEach(r => {
            const main = r.main_category || 'Others';
            mset.add(main);
            map[main] = map[main] || [];
            map[main].push({ ...r, label: r.sub_category ?? '-' });
          });
          setMainList(Array.from(mset).sort((a,b)=>a.localeCompare(b)));
          setSubMap(map);
        }
      } catch {
        setCategoryRows([]);
        setMainList([]);
        setSubMap({});
      }
    }
  }

  // open generic Add Category modal (both main + optional sub)
  const openAddCategory = () => {
    setNewMain('');
    setNewSub('');
    setCatError(null);
    setIsCatModalOpen(true);
  };

  // NEW: open subcategory modal prefilled with a main category
  const openAddSubcategoryModal = (main: string) => {
    setSubModalMainPrefill(main);
    setNewSub('');
    setCatError(null);
    setIsSubModalOpen(true);
  };

  const createCategory = async () => {
    if (!newMain.trim()) {
      setCatError('Main category required');
      return;
    }
    setCatSaving(true);
    setCatError(null);
    try {
      await api.post('/menu/categories', { main_category: newMain.trim(), sub_category: newSub?.trim() || null });
      await loadCategories();
      window.dispatchEvent(new CustomEvent('categories-updated'));
      setIsCatModalOpen(false);
    } catch (err: any) {
      setCatError(err?.response?.data?.message || err.message || 'Failed to create category');
    } finally {
      setCatSaving(false);
    }
  };

  // create subcategory from sub-modal (prefills main)
  const createSubcategory = async () => {
    if (!subModalMainPrefill) {
      setCatError('Main category required');
      return;
    }
    if (!newSub.trim()) {
      setCatError('Subcategory name required');
      return;
    }
    setCatSaving(true);
    setCatError(null);
    try {
      await api.post('/menu/categories', { main_category: subModalMainPrefill, sub_category: newSub.trim() });
      await loadCategories();
      window.dispatchEvent(new CustomEvent('categories-updated'));
      setIsSubModalOpen(false);
      setSubModalMainPrefill(null);
      setNewSub('');
    } catch (err: any) {
      setCatError(err?.response?.data?.message || err.message || 'Failed to create subcategory');
    } finally {
      setCatSaving(false);
    }
  };

  const handleOpenModal = (item: MenuItem | null = null) => {
    setEditingItem(item);
    setModalInitial(null);
    setIsModalOpen(true);
  };

  // More robust: always open modal and preselect main/sub, also set selectedMain/selectedSubId for UI highlight
  const handleAddItemToSub = (main: string, subRow: CatRow) => {
    setSelectedMain(main);
    setSelectedSubId(subRow.id);
    setEditingItem(null); // adding new item
    setModalInitial({ category: main, sub_category: subRow.sub_category ?? '' });
    setIsModalOpen(true);
  };

  const handleToggleAvailability = async (item: MenuItem) => {
    const updatePayload = {
      name: item.name,
      category: item.category,
      sub_category: item.sub_category ?? null,
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

  // Derive shown items by selected main/sub (client-side, uses allMenuItems from hook)
  const shownItems = allMenuItems.filter(mi => {
    if (selectedMain && mi.category !== selectedMain) return false;
    if (selectedSubId) {
      const row = categoryRows.find(r => r.id === selectedSubId);
      if (!row) return false;
      const subName = row.sub_category;
      if ((mi.sub_category ?? null) !== (subName ?? null)) return false;
    }
    return true;
  });

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

      {/* Category navigation */}
      <div className="mb-6 grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="col-span-1">
          <h4 className="text-sm font-semibold mb-2">Main Categories</h4>
          <div className="space-y-2">
            <button
              onClick={() => { setSelectedMain(null); setSelectedSubId(null); }}
              className={`block w-full text-left px-3 py-2 rounded ${selectedMain === null ? 'bg-gray-200' : 'bg-white'}`}
            >
              All
            </button>
            {mainList.map(main => (
              <div key={main}>
                <button
                  onClick={() => {
                    if (selectedMain === main) {
                      setSelectedMain(null);
                      setSelectedSubId(null);
                    } else {
                      setSelectedMain(main);
                      setSelectedSubId(null);
                    }
                  }}
                  className={`w-full text-left px-3 py-2 rounded ${selectedMain === main ? 'bg-gray-200' : 'bg-white'}`}
                >
                  {main}
                </button>

                {/* If this main is selected, show subcategories below */}
                {selectedMain === main && (
                  <div className="pl-4 mt-2 space-y-1">
                    {(subMap[main] || []).map(subRow => (
                      <div key={subRow.id} className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 w-full">
                          <button
                            onClick={() => setSelectedSubId(subRow.id === selectedSubId ? null : subRow.id)}
                            className={`text-sm text-left px-2 py-1 rounded w-full ${selectedSubId === subRow.id ? 'bg-blue-50 text-blue-700' : 'bg-white'}`}
                          >
                            {subRow.sub_category ?? '(no sub)'}
                          </button>

                          {/* Make Add Item button always visible for this subRow so the user can click it directly */}
                          <button
                            onClick={() => handleAddItemToSub(main, subRow)}
                            className="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700"
                          >
                            + Add Item
                          </button>
                        </div>

                        <div className="flex gap-2">
                          <button className="text-xs text-gray-500 hover:text-gray-700" onClick={async () => {
                            const newName = prompt('Rename subcategory (leave empty to cancel):', subRow.sub_category ?? '');
                            if (!newName) return;
                            try {
                              await api.put(`/menu/categories/${subRow.id}`, { main_category: main, sub_category: newName.trim() || null });
                              await loadCategories();
                            } catch (err) { alert('Failed to rename subcategory'); }
                          }}>Rename</button>

                          <button className="text-xs text-red-500 hover:text-red-700" onClick={async () => {
                            if (!confirm('Delete this subcategory? This will not delete items automatically.')) return;
                            try {
                              await api.delete(`/menu/categories/${subRow.id}`);
                              await loadCategories();
                            } catch (err) { alert('Failed to delete'); }
                          }}>Delete</button>
                        </div>
                      </div>
                    ))}
                    {/* Replace prompt-based add with modal-based add */}
                    <button
                      onClick={() => openAddSubcategoryModal(main)}
                      className="text-xs text-blue-600 hover:underline mt-1"
                    >
                      + Add subcategory
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Table area spans rest of columns */}
        <div className="col-span-3 bg-white rounded-lg shadow-sm overflow-hidden p-4">
          {loading ? <div className="text-gray-500">Loading menu...</div> : null}
          {error ? <div className="text-red-600">{error}</div> : null}

          <div className="overflow-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sub Category</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Available</th>
                  <th className="relative px-6 py-3"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {(!loading && shownItems.length === 0) && (
                  <tr><td colSpan={6} className="text-center py-10 text-gray-500">No menu items found for selection.</td></tr>
                )}
                {shownItems.map((item) => (
                  <tr key={item.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{item.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.category}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.sub_category ?? '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800 text-right font-medium">{formatCurrency(item.price, settings?.currency || 'OMR')}</td>
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
                      <button onClick={() => { setModalInitial(null); setEditingItem(item); setIsModalOpen(true); }} className="text-blue-600 hover:text-blue-900 p-1"><Edit size={18} /></button>
                      <button onClick={() => handleDelete(item.id)} className="text-red-600 hover:text-red-900 p-1"><Trash2 size={18} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* MenuItemModal receives categories prop and optional modalInitial prop */}
      {isModalOpen && (
        <MenuItemModal
          item={editingItem}
          onClose={() => {
            setIsModalOpen(false);
            setEditingItem(null);
            setModalInitial(null);
            loadCategories();
            window.dispatchEvent(new CustomEvent('menu-updated'));
          }}
          categories={categoryRows}
          initialValues={modalInitial ?? undefined}
        />
      )}

      {/* Add Category Modal (main + optional sub) */}
      {isCatModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md bg-white rounded-lg shadow-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Add Category</h3>
              <button onClick={() => setIsCatModalOpen(false)} className="text-gray-500 hover:text-gray-700">Close</button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700">Main Category</label>
                <input
                  value={newMain}
                  onChange={(e) => setNewMain(e.target.value)}
                  className="w-full rounded border p-2"
                  placeholder="e.g. Starters"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Sub Category (optional)</label>
                <input
                  value={newSub}
                  onChange={(e) => setNewSub(e.target.value)}
                  className="w-full rounded border p-2"
                  placeholder="e.g. Soups"
                />
              </div>

              {catError && <div className="text-red-600 text-sm">{catError}</div>}

              <div className="flex justify-end gap-2 mt-4">
                <button onClick={() => setIsCatModalOpen(false)} className="px-4 py-2 bg-gray-100 rounded">Cancel</button>
                <button onClick={createCategory} disabled={catSaving} className={`px-4 py-2 rounded ${catSaving ? 'bg-gray-300' : 'bg-green-600 text-white'}`}>
                  {catSaving ? 'Saving...' : 'Create'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Subcategory Modal (prefills main) */}
      {isSubModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md bg-white rounded-lg shadow-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Add Subcategory</h3>
              <button onClick={() => { setIsSubModalOpen(false); setSubModalMainPrefill(null); }} className="text-gray-500 hover:text-gray-700">Close</button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700">Main Category</label>
                <input
                  className="w-full rounded border p-2 bg-gray-50"
                  value={subModalMainPrefill ?? ''}
                  readOnly
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Sub Category</label>
                <input
                  value={newSub}
                  onChange={(e) => setNewSub(e.target.value)}
                  className="w-full rounded border p-2"
                  placeholder="e.g. Soups"
                />
              </div>

              {catError && <div className="text-red-600 text-sm">{catError}</div>}

              <div className="flex justify-end gap-2 mt-4">
                <button onClick={() => { setIsSubModalOpen(false); setSubModalMainPrefill(null); }} className="px-4 py-2 bg-gray-100 rounded">Cancel</button>
                <button onClick={createSubcategory} disabled={catSaving} className={`px-4 py-2 rounded ${catSaving ? 'bg-gray-300' : 'bg-green-600 text-white'}`}>
                  {catSaving ? 'Saving...' : 'Create Subcategory'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Menu;
