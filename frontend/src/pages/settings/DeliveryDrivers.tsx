import React, { useState } from 'react';
import { useDeliveryDrivers, DeliveryDriver } from '../../hooks/useDeliveryDrivers';
import { toast } from 'react-toastify';
import { confirmAlert } from 'react-confirm-alert';
import 'react-confirm-alert/src/react-confirm-alert.css';

type DeliveryDriversProps = {
  onBack?: () => void;
};

const DeliveryDrivers: React.FC<DeliveryDriversProps> = ({ onBack }) => {
  const { deliveryDrivers, loading, error, createDeliveryDriver, updateDeliveryDriver, deleteDeliveryDriver, fetchDeliveryDrivers } = useDeliveryDrivers();
  const [showModal, setShowModal] = useState(false);
  const [editingDeliveryDriver, setEditingDeliveryDriver] = useState<DeliveryDriver | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    employee_id: '',
    phone_number: '',
    vehicle_type: '',
    vehicle_number: '',
    status: 'active' as 'active' | 'inactive' | 'on_delivery' | 'on_break'
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [showStats, setShowStats] = useState(false);

  const handleOpenModal = (deliveryDriver?: DeliveryDriver) => {
    if (deliveryDriver) {
      setEditingDeliveryDriver(deliveryDriver);
      setFormData({
        name: deliveryDriver.name,
        employee_id: deliveryDriver.employee_id,
        phone_number: deliveryDriver.phone_number || '',
        vehicle_type: deliveryDriver.vehicle_type || '',
        vehicle_number: deliveryDriver.vehicle_number || '',
        status: deliveryDriver.status
      });
    } else {
      setEditingDeliveryDriver(null);
      setFormData({
        name: '',
        employee_id: '',
        phone_number: '',
        vehicle_type: '',
        vehicle_number: '',
        status: 'active'
      });
    }
    setFormError(null);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingDeliveryDriver(null);
    setFormError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    try {
      if (editingDeliveryDriver) {
        await updateDeliveryDriver(editingDeliveryDriver.id, formData);
      } else {
        await createDeliveryDriver(formData);
      }
      handleCloseModal();
      if (showStats) {
        fetchDeliveryDrivers(true);
      }
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to save delivery driver';
      setFormError(errorMessage);
      toast.error(errorMessage);
    }
  };

  const handleDelete = async (id: string) => {
    confirmAlert({
      title: 'Deactivate Delivery Driver',
      message: 'Are you sure you want to deactivate this delivery driver?',
      buttons: [
        {
          label: 'Yes, Deactivate',
          onClick: async () => {
            try {
              await deleteDeliveryDriver(id);
              toast.success('Delivery driver deactivated successfully');
            } catch (err: any) {
              toast.error('Failed to deactivate delivery driver');
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

  const toggleStats = () => {
    setShowStats(!showStats);
    fetchDeliveryDrivers(!showStats);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'on_delivery':
        return 'bg-blue-100 text-blue-800';
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
      case 'on_delivery':
        return 'On Delivery';
      case 'on_break':
        return 'On Break';
      case 'inactive':
        return 'Inactive';
      default:
        return status;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return '✓';
      case 'on_delivery':
        return '🚗';
      case 'on_break':
        return '☕';
      case 'inactive':
        return '⊘';
      default:
        return '';
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
            <h1 className="text-2xl font-bold text-gray-800">Delivery Driver Management</h1>
            <p className="text-sm text-gray-600 mt-1">Manage your delivery staff and track deliveries</p>
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
            + Add Delivery Driver
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="text-gray-600">Loading delivery drivers...</div>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md">
          {error}
        </div>
      ) : deliveryDrivers.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <p className="text-gray-600">No delivery drivers found. Add your first delivery driver to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {deliveryDrivers.map((deliveryDriver) => (
            <div
              key={deliveryDriver.id}
              className="bg-white p-5 rounded-lg shadow-md border border-gray-200 hover:shadow-lg transition-shadow"
            >
              <div className="flex justify-between items-start mb-3">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-800">{deliveryDriver.name}</h3>
                  <p className="text-sm text-gray-600">ID: {deliveryDriver.employee_id}</p>
                </div>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(
                    deliveryDriver.status
                  )}`}
                >
                  {getStatusIcon(deliveryDriver.status)} {getStatusLabel(deliveryDriver.status)}
                </span>
              </div>

              <div className="space-y-2 mb-3">
                {deliveryDriver.phone_number && (
                  <p className="text-sm text-gray-600">📞 {deliveryDriver.phone_number}</p>
                )}
                {deliveryDriver.vehicle_type && (
                  <p className="text-sm text-gray-600">
                    🚗 {deliveryDriver.vehicle_type}
                    {deliveryDriver.vehicle_number && ` - ${deliveryDriver.vehicle_number}`}
                  </p>
                )}
              </div>

              {showStats && (
                <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-gray-200">
                  <div>
                    <p className="text-xs text-gray-500">Active Orders</p>
                    <p className="text-xl font-bold text-blue-600">
                      {deliveryDriver.active_orders || 0}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Completed Today</p>
                    <p className="text-xl font-bold text-green-600">
                      {deliveryDriver.completed_today || 0}
                    </p>
                  </div>
                  {deliveryDriver.sales_today !== undefined && (
                    <div className="col-span-2">
                      <p className="text-xs text-gray-500">Sales Today</p>
                      <p className="text-xl font-bold text-purple-600">
                        OMR {Number(deliveryDriver.sales_today || 0).toFixed(3)}
                      </p>
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-2 mt-4 pt-4 border-t border-gray-200">
                <button
                  onClick={() => handleOpenModal(deliveryDriver)}
                  className="flex-1 px-3 py-2 bg-blue-50 text-blue-600 rounded-md hover:bg-blue-100 transition-colors text-sm font-medium"
                >
                  Edit
                </button>
                {deliveryDriver.status !== 'inactive' && (
                  <button
                    onClick={() => handleDelete(deliveryDriver.id)}
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

      {/* Add/Edit Delivery Driver Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">
              {editingDeliveryDriver ? 'Edit Delivery Driver' : 'Add New Delivery Driver'}
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
                  placeholder="+968-XXXX-XXXX"
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Vehicle Type
                </label>
                <select
                  value={formData.vehicle_type}
                  onChange={(e) =>
                    setFormData({ ...formData, vehicle_type: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Vehicle Type</option>
                  <option value="Motorcycle">Motorcycle</option>
                  <option value="Car">Car</option>
                  <option value="Van">Van</option>
                  <option value="Bicycle">Bicycle</option>
                  <option value="Scooter">Scooter</option>
                </select>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Vehicle Number
                </label>
                <input
                  type="text"
                  value={formData.vehicle_number}
                  onChange={(e) =>
                    setFormData({ ...formData, vehicle_number: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., DB-1234"
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
                  <option value="on_delivery">On Delivery</option>
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
                  {editingDeliveryDriver ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DeliveryDrivers;
