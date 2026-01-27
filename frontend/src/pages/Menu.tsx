// frontend/src/pages/Menu.tsx
import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, ChevronDown, ChevronRight, Search } from 'lucide-react';
import { useMenuItems } from '../hooks/useMenuItems';
import { MenuItemModal } from '../components/MenuItemModal';
import { formatCurrency } from '../lib/utils';
import { useRestaurantSettingsContext } from '../contexts/useRestaurantSettingsContext';
import api from '../lib/api';
import type { MenuItem as HookMenuItem } from '../hooks/useMenuItems';
import { confirmAlert } from 'react-confirm-alert';
import 'react-confirm-alert/src/react-confirm-alert.css';
import { toast } from 'react-toastify';

type MenuItem = HookMenuItem;

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

  // Edit category modal
  const [isEditCatModalOpen, setIsEditCatModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CatRow | null>(null);
  const [editMain, setEditMain] = useState('');
  const [editSub, setEditSub] = useState('');

  // UI: selection for display
  const [selectedMain, setSelectedMain] = useState<string | null>(null);
  const [selectedSubId, setSelectedSubId] = useState<string | null>(null);
  const [expandedMains, setExpandedMains] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');

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

  // Open edit category modal
  const openEditCategory = (catRow: CatRow) => {
    setEditingCategory(catRow);
    setEditMain(catRow.main_category);
    setEditSub(catRow.sub_category || '');
    setCatError(null);
    setIsEditCatModalOpen(true);
  };

  // Update category
  const updateCategory = async () => {
    if (!editingCategory) return;
    if (!editMain.trim()) {
      setCatError('Main category required');
      return;
    }
    setCatSaving(true);
    setCatError(null);
    try {
      await api.put(`/menu/categories/${editingCategory.id}`, {
        main_category: editMain.trim(),
        sub_category: editSub.trim() || null
      });
      await loadCategories();
      window.dispatchEvent(new CustomEvent('categories-updated'));
      setIsEditCatModalOpen(false);
      setEditingCategory(null);
    } catch (err: any) {
      setCatError(err?.response?.data?.message || err.message || 'Failed to update category');
    } finally {
      setCatSaving(false);
    }
  };

  // Delete category
  const deleteCategory = async (catRow: CatRow) => {
    const catName = catRow.sub_category 
      ? `${catRow.main_category} > ${catRow.sub_category}`
      : catRow.main_category;
    
    confirmAlert({
      title: 'Delete Category',
      message: `Are you sure you want to delete "${catName}"? This action cannot be undone.`,
      buttons: [
        {
          label: 'Yes, Delete',
          onClick: async () => {
            try {
              await api.delete(`/menu/categories/${catRow.id}`);
              await loadCategories();
              window.dispatchEvent(new CustomEvent('categories-updated'));
              // Clear selection if deleted category was selected
              if (selectedSubId === catRow.id) {
                setSelectedSubId(null);
              }
            } catch (err: any) {
              toast.error(err?.response?.data?.message || err.message || 'Failed to delete category');
            }
          },
          className: 'bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700'
        },
        {
          label: 'Cancel',
          onClick: () => {},
          className: 'bg-gray-300 text-gray-800 px-4 py-2 rounded hover:bg-gray-400'
        }
      ]
    });
  };

  const handleOpenModal = (item: MenuItem | null = null) => {
    setEditingItem(item);
    setModalInitial(null);
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
    confirmAlert({
      title: 'Delete Menu Item',
      message: 'Are you sure you want to delete this menu item?',
      buttons: [
        {
          label: 'Yes, Delete',
          onClick: async () => {
            await deleteMenuItem(id);
          },
          className: 'bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700'
        },
        {
          label: 'Cancel',
          onClick: () => {},
          className: 'bg-gray-300 text-gray-800 px-4 py-2 rounded hover:bg-gray-400'
        }
      ]
    });
  };

  // Derive shown items by selected main/sub (client-side, uses allMenuItems from hook)
  const shownItems = allMenuItems.filter(mi => {
    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const matchesName = mi.name.toLowerCase().includes(query);
      const matchesCategory = mi.category.toLowerCase().includes(query);
      const matchesSubCategory = mi.sub_category?.toLowerCase().includes(query);
      if (!matchesName && !matchesCategory && !matchesSubCategory) return false;
    }
    
    if (selectedMain && mi.category !== selectedMain) return false;
    if (selectedSubId) {
      const row = categoryRows.find(r => r.id === selectedSubId); 
      if (!row) return false;
      const subName = row.sub_category;
      if ((mi.sub_category ?? null) !== (subName ?? null)) return false;
    }
    return true;
  });

  const toggleMainExpanded = (main: string) => {
    const newSet = new Set(expandedMains);
    if (newSet.has(main)) {
      newSet.delete(main);
    } else {
      newSet.add(main);
    }
    setExpandedMains(newSet);
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Menu Management</h1>
          <p className="mt-1 text-gray-600">Manage your restaurant's menu items and categories</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={openAddCategory}
            className="bg-white border border-gray-300 text-gray-700 font-medium px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-gray-50 transition-colors"
          >
            <Plus size={18} />
            Add Category
          </button>

          <button
            onClick={() => handleOpenModal()}
            className="bg-blue-600 text-white font-semibold px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 transition-colors shadow-sm"
          >
            <Plus size={20} />
            Add Menu Item
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex gap-6 overflow-hidden">
        {/* Sidebar - Categories */}
        <div className="w-64 bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden flex flex-col">
          <div className="p-4 border-b border-gray-200">
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Categories</h3>
          </div>
          
          <div className="flex-1 overflow-y-auto p-2">
            <button
              onClick={() => { setSelectedMain(null); setSelectedSubId(null); }}
              className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                selectedMain === null 
                  ? 'bg-blue-50 text-blue-700 border border-blue-200' 
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              All Items ({allMenuItems.length})
            </button>

            <div className="mt-2 space-y-1">
              {mainList.map(main => {
                const isExpanded = expandedMains.has(main);
                const isSelected = selectedMain === main;
                const mainItemCount = allMenuItems.filter(item => item.category === main).length;
                const subsForMain = subMap[main] || [];

                return (
                  <div key={main}>
                    <div className="flex items-center gap-1 group/main">
                      <button
                        onClick={() => toggleMainExpanded(main)}
                        className="p-1 hover:bg-gray-100 rounded"
                      >
                        {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      </button>
                      
                      <button
                        onClick={() => {
                          setSelectedMain(main);
                          setSelectedSubId(null);
                          if (!expandedMains.has(main)) {
                            toggleMainExpanded(main);
                          }
                        }}
                        className={`flex-1 text-left px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                          isSelected && !selectedSubId
                            ? 'bg-blue-50 text-blue-700 border border-blue-200' 
                            : 'text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span>{main}</span>
                          <span className="text-xs text-gray-500">({mainItemCount})</span>
                        </div>
                      </button>

                      {/* Edit/Delete buttons for main category - shown on hover */}
                      <div className="opacity-0 group-hover/main:opacity-100 transition-opacity flex gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            // Find any category row with this main_category to edit
                            const catRow = categoryRows.find(r => r.main_category === main && !r.sub_category);
                            if (catRow) openEditCategory(catRow);
                          }}
                          className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                          title="Edit category"
                        >
                          <Edit size={14} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const catRow = categoryRows.find(r => r.main_category === main && !r.sub_category);
                            if (catRow) deleteCategory(catRow);
                          }}
                          className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                          title="Delete category"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    {/* Subcategories */}
                    {isExpanded && subsForMain.length > 0 && (
                      <div className="ml-6 mt-1 space-y-1">
                        {subsForMain.map(subRow => {
                          const subItemCount = allMenuItems.filter(
                            item => item.category === main && (item.sub_category ?? null) === (subRow.sub_category ?? null)
                          ).length;
                          const isSubSelected = selectedSubId === subRow.id;

                          return (
                            <div key={subRow.id} className="group/sub relative">
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => {
                                    setSelectedMain(main);
                                    setSelectedSubId(subRow.id);
                                  }}
                                  className={`flex-1 text-left px-3 py-2 rounded-md text-sm transition-colors ${
                                    isSubSelected
                                      ? 'bg-blue-50 text-blue-700 border border-blue-200' 
                                      : 'text-gray-600 hover:bg-gray-50'
                                  }`}
                                >
                                  <div className="flex items-center justify-between">
                                    <span>{subRow.sub_category ?? '(no sub)'}</span>
                                    <span className="text-xs text-gray-500">({subItemCount})</span>
                                  </div>
                                </button>

                                {/* Edit/Delete buttons for subcategory */}
                                <div className="opacity-0 group-hover/sub:opacity-100 transition-opacity flex gap-1">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openEditCategory(subRow);
                                    }}
                                    className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                                    title="Edit subcategory"
                                  >
                                    <Edit size={12} />
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      deleteCategory(subRow);
                                    }}
                                    className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                                    title="Delete subcategory"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                        
                        <button
                          onClick={() => openAddSubcategoryModal(main)}
                          className="w-full text-left px-3 py-1.5 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-md transition-colors"
                        >
                          + Add subcategory
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Main Content - Menu Items */}
        <div className="flex-1 bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden flex flex-col ">
          {/* Search and Filter Bar */}
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="text"
                  placeholder="Search menu items..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              
              {(selectedMain || searchQuery) && (
                <button
                  onClick={() => {
                    setSelectedMain(null);
                    setSelectedSubId(null);
                    setSearchQuery('');
                  }}
                  className="text-sm text-gray-600 hover:text-gray-900"
                >
                  Clear filters
                </button>
              )}
            </div>

            {/* Active Filter Display */}
            {(selectedMain || selectedSubId) && (
              <div className="mt-3 flex items-center gap-2 text-sm">
                <span className="text-gray-600">Showing:</span>
                {selectedMain && (
                  <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-md">
                    {selectedMain}
                  </span>
                )}
                {selectedSubId && (
                  <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-md">
                    {categoryRows.find(r => r.id === selectedSubId)?.sub_category}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Menu Items Content */}
          <div className="overflow-x-auto">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-gray-500">Loading menu items...</div>
              </div>
            ) : error ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-red-600">{error}</div>
              </div>
            ) : shownItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-500">
                <p className="text-lg font-medium">No menu items found</p>
                <p className="text-sm mt-2">Try adjusting your filters or add a new item</p>
              </div>
            ) : (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Item Name
                    </th>
                    {!selectedMain && (
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Category
                      </th>
                    )}
                    {!selectedSubId && (
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Sub Category
                      </th>
                    )}
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Price
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      VAT
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Available
                    </th>
                    <th className="relative px-6 py-3">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {shownItems.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">
                        {item.name}
                      </td>
                      {!selectedMain && (
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {item.category}
                        </td>
                      )}
                      {!selectedSubId && (
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {item.sub_category ?? '-'}
                        </td>
                      )}
                      <td className="px-6 py-4 text-sm text-gray-900 text-right font-medium">
                        {formatCurrency(item.price, settings?.currency || 'OMR')}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          (item as any).apply_vat 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {(item as any).apply_vat ? 'Yes' : 'No'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
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
                      <td className="px-6 py-4 text-right text-sm font-medium">
                        <div className="flex items-center justify-end gap-2">
                          <button 
                            onClick={() => { setModalInitial(null); setEditingItem(item); setIsModalOpen(true); }} 
                            className="text-blue-600 hover:text-blue-900 p-2 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <Edit size={18} />
                          </button>
                          <button 
                            onClick={() => handleDelete(item.id)} 
                            className="text-red-600 hover:text-red-900 p-2 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Footer with item count */}
          {!loading && shownItems.length > 0 && (
            <div className="px-6 py-3 border-t border-gray-200 bg-gray-50">
              <p className="text-sm text-gray-600">
                Showing {shownItems.length} item{shownItems.length !== 1 ? 's' : ''}
                {selectedMain && ` in ${selectedMain}`}
              </p>
            </div>
          )}
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

      {/* Edit Category Modal */}
      {isEditCatModalOpen && editingCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md bg-white rounded-lg shadow-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Edit Category</h3>
              <button 
                onClick={() => { 
                  setIsEditCatModalOpen(false); 
                  setEditingCategory(null); 
                }} 
                className="text-gray-500 hover:text-gray-700"
              >
                Close
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700">Main Category</label>
                <input
                  value={editMain}
                  onChange={(e) => setEditMain(e.target.value)}
                  className="w-full rounded border p-2"
                  placeholder="e.g. Starters"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Sub Category (optional)</label>
                <input
                  value={editSub}
                  onChange={(e) => setEditSub(e.target.value)}
                  className="w-full rounded border p-2"
                  placeholder="e.g. Soups"
                />
              </div>

              {catError && <div className="text-red-600 text-sm">{catError}</div>}

              <div className="flex justify-end gap-2 mt-4">
                <button 
                  onClick={() => { 
                    setIsEditCatModalOpen(false); 
                    setEditingCategory(null); 
                  }} 
                  className="px-4 py-2 bg-gray-100 rounded hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button 
                  onClick={updateCategory} 
                  disabled={catSaving} 
                  className={`px-4 py-2 rounded ${catSaving ? 'bg-gray-300' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
                >
                  {catSaving ? 'Saving...' : 'Update'}
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
