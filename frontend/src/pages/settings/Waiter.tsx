import React, { useState } from 'react';
import { useWaiters, Waiter } from '../../hooks/useWaiters';

type WaitersProps = {
  onBack?: () => void;
};

const Waiters: React.FC<WaitersProps> = ({ onBack }) => {
  const { waiters, loading, error, createWaiter, updateWaiter, deleteWaiter, fetchWaiters } = useWaiters();
  const [showModal, setShowModal] = useState(false);
  const [editingWaiter, setEditingWaiter] = useState<Waiter | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    employee_id: '',
    phone_number: '',
    status: 'active' as 'active' | 'inactive' | 'on_break'
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [showStats, setShowStats] = useState(false);

  const handleOpenModal = (waiter?: Waiter) => {
    if (waiter) {
      setEditingWaiter(waiter);
      setFormData({
        name: waiter.name,
        employee_id: waiter.employee_id,
        phone_number: waiter.phone_number || '',
        status: waiter.status
      });
    } else {
      setEditingWaiter(null);
      setFormData({
        name: '',
        employee_id: '',
        phone_number: '',
        status: 'active'
      });
    }
    setFormError(null);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingWaiter(null);
    setFormError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    try {
      if (editingWaiter) {
        await updateWaiter(editingWaiter.id, formData);
      } else {
        await createWaiter(formData);
      }
      handleCloseModal();
      if (showStats) {
        fetchWaiters(true);
      }
    } catch (err: any) {
      setFormError(err.message || 'Failed to save waiter');
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to deactivate this waiter?')) {
      try {
        await deleteWaiter(id);
      } catch (err: any) {
        alert(err.message || 'Failed to deactivate waiter');
      }
    }
  };

  const toggleStats = () => {
    setShowStats(!showStats);
    fetchWaiters(!showStats);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'on_break':
        return 'bg-yellow-100 text-yellow-800';
      case 'inactive':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'active':
        return 'Active';
      case 'on_break':
        return 'On Break';
      case 'inactive':
        return 'Inactive';
      default:
        return status;
    }
  };

  return (
    <div className="p-6">
      {/* Header with Back button */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            >
              ← Back
            </button>
          )}
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Waiter Management</h1>
            <p className="text-sm text-gray-600 mt-1">Manage your restaurant staff</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={toggleStats}
            className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
          >
            {showStats ? 'Hide Stats' : 'Show Stats'}
          </button>
          <button
            onClick={() => handleOpenModal()}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            + Add Waiter
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="text-gray-600">Loading waiters...</div>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md">
          {error}
        </div>
      ) : waiters.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <p className="text-gray-600">No waiters found. Add your first waiter to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {waiters.map((waiter) => (
            <div
              key={waiter.id}
              className="bg-white p-5 rounded-lg shadow-md border border-gray-200 hover:shadow-lg transition-shadow"
            >
              <div className="flex justify-between items-start mb-3">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-800">{waiter.name}</h3>
                  <p className="text-sm text-gray-600">ID: {waiter.employee_id}</p>
                </div>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(
                    waiter.status
                  )}`}
                >
                  {getStatusLabel(waiter.status)}
                </span>
              </div>

              {waiter.phone_number && (
                <p className="text-sm text-gray-600 mb-3">📞 {waiter.phone_number}</p>
              )}

              {showStats && (
                <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-gray-200">
                  <div>
                    <p className="text-xs text-gray-500">Active Orders</p>
                    <p className="text-xl font-bold text-blue-600">
                      {waiter.active_orders || 0}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Completed Today</p>
                    <p className="text-xl font-bold text-green-600">
                      {waiter.completed_today || 0}
                    </p>
                  </div>
                  {waiter.sales_today !== undefined && (
                    <div className="col-span-2">
                      <p className="text-xs text-gray-500">Sales Today</p>
                      <p className="text-xl font-bold text-purple-600">
                        OMR {Number(waiter.sales_today || 0).toFixed(3)}
                      </p>
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-2 mt-4 pt-4 border-t border-gray-200">
                <button
                  onClick={() => handleOpenModal(waiter)}
                  className="flex-1 px-3 py-2 bg-blue-50 text-blue-600 rounded-md hover:bg-blue-100 transition-colors text-sm font-medium"
                >
                  Edit
                </button>
                {waiter.status !== 'inactive' && (
                  <button
                    onClick={() => handleDelete(waiter.id)}
                    className="flex-1 px-3 py-2 bg-red-50 text-red-600 rounded-md hover:bg-red-100 transition-colors text-sm font-medium"
                  >
                    Deactivate
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Waiter Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">
              {editingWaiter ? 'Edit Waiter' : 'Add New Waiter'}
            </h2>

            {formError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 rounded-md text-sm">
                {formError}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Employee ID <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.employee_id}
                  onChange={(e) => setFormData({ ...formData, employee_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={formData.phone_number}
                  onChange={(e) =>
                    setFormData({ ...formData, phone_number: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Status
                </label>
                <select
                  value={formData.status}
                  onChange={(e) =>
                    setFormData({ ...formData, status: e.target.value as any })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="active">Active</option>
                  <option value="on_break">On Break</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  {editingWaiter ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Waiters;
