import React, { useState } from 'react';
import { useWaiters, Waiter } from '../../hooks/useWaiters';
import { useDeliveryDrivers, DeliveryDriver } from '../../hooks/useDeliveryDrivers';
import { toast } from 'react-toastify';
import { confirmAlert } from 'react-confirm-alert';
import 'react-confirm-alert/src/react-confirm-alert.css';

type WaitersProps = {
  onBack?: () => void;
};

type StaffType = 'waiter' | 'delivery';

const Waiters: React.FC<WaitersProps> = ({ onBack }) => {
  const { waiters, loading: waitersLoading, error: waitersError, createWaiter, updateWaiter, deleteWaiter, fetchWaiters } = useWaiters();
  const { deliveryDrivers, loading: driversLoading, error: driversError, createDeliveryDriver, updateDeliveryDriver, deleteDeliveryDriver, fetchDeliveryDrivers } = useDeliveryDrivers();
  
  const [activeTab, setActiveTab] = useState<StaffType>('waiter');
  const [showModal, setShowModal] = useState(false);
  const [editingWaiter, setEditingWaiter] = useState<Waiter | null>(null);
  const [editingDriver, setEditingDriver] = useState<DeliveryDriver | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    employee_id: '',
    phone_number: '',
    vehicle_type: '',
    vehicle_number: '',
    status: 'active' as 'active' | 'inactive' | 'on_break' | 'on_delivery'
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [showStats, setShowStats] = useState(false);
  const [showInactive, setShowInactive] = useState(true);

  const loading = activeTab === 'waiter' ? waitersLoading : driversLoading;
  const error = activeTab === 'waiter' ? waitersError : driversError;
  const staffList = activeTab === 'waiter' ? waiters : deliveryDrivers;

  const handleOpenModal = (staff?: Waiter | DeliveryDriver) => {
    if (staff) {
      if (activeTab === 'waiter') {
        setEditingWaiter(staff as Waiter);
        setEditingDriver(null);
      } else {
        setEditingDriver(staff as DeliveryDriver);
        setEditingWaiter(null);
      }
      setFormData({
        name: staff.name,
        employee_id: staff.employee_id,
        phone_number: staff.phone_number || '',
        vehicle_type: (staff as DeliveryDriver).vehicle_type || '',
        vehicle_number: (staff as DeliveryDriver).vehicle_number || '',
        status: staff.status
      });
    } else {
      setEditingWaiter(null);
      setEditingDriver(null);
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
    setEditingWaiter(null);
    setEditingDriver(null);
    setFormError(null);
  };

  const toggleStats = async () => {
    const newShowStats = !showStats;
    setShowStats(newShowStats);
    if (activeTab === 'waiter') {
      await fetchWaiters(newShowStats, showInactive);
    } else {
      await fetchDeliveryDrivers(newShowStats, showInactive);
    }
  };

  const toggleInactive = async () => {
    const newShowInactive = !showInactive;
    setShowInactive(newShowInactive);
    if (activeTab === 'waiter') {
      await fetchWaiters(showStats, newShowInactive);
    } else {
      await fetchDeliveryDrivers(showStats, newShowInactive);
    }
  };

  const handleTabChange = async (tab: StaffType) => {
    setActiveTab(tab);
    if (tab === 'waiter') {
      await fetchWaiters(showStats, showInactive);
    } else {
      await fetchDeliveryDrivers(showStats, showInactive);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    try {
      if (activeTab === 'waiter') {
        const waiterData = {
          name: formData.name,
          employee_id: formData.employee_id,
          phone_number: formData.phone_number,
          status: formData.status as 'active' | 'inactive' | 'on_break'
        };
        if (editingWaiter) {
          await updateWaiter(editingWaiter.id, waiterData);
          toast.success('Waiter updated successfully');
        } else {
          await createWaiter(waiterData);
          toast.success('Waiter created successfully');
        }
        await fetchWaiters(showStats, showInactive);
      } else {
        const driverData = {
          name: formData.name,
          employee_id: formData.employee_id,
          phone_number: formData.phone_number,
          vehicle_type: formData.vehicle_type,
          vehicle_number: formData.vehicle_number,
          status: formData.status
        };
        if (editingDriver) {
          await updateDeliveryDriver(editingDriver.id, driverData);
          toast.success('Delivery driver updated successfully');
        } else {
          await createDeliveryDriver(driverData);
          toast.success('Delivery driver created successfully');
        }
        await fetchDeliveryDrivers(showStats, showInactive);
      }
      handleCloseModal();
    } catch (err: any) {
      const errorMessage = err.message || `Failed to save ${activeTab === 'waiter' ? 'waiter' : 'delivery driver'}`;
      setFormError(errorMessage);
      toast.error(errorMessage);
    }
  };

  const handleDelete = async (id: string) => {
    const staffType = activeTab === 'waiter' ? 'waiter' : 'delivery driver';
    confirmAlert({
      title: 'Deactivate Staff',
      message: `Are you sure you want to deactivate this ${staffType}?`,
      buttons: [
        {
          label: 'Yes, Deactivate',
          onClick: async () => {
            try {
              if (activeTab === 'waiter') {
                await deleteWaiter(id);
                await fetchWaiters(showStats, showInactive);
              } else {
                await deleteDeliveryDriver(id);
                await fetchDeliveryDrivers(showStats, showInactive);
              }
              toast.success(`${staffType.charAt(0).toUpperCase() + staffType.slice(1)} deactivated successfully`);
            } catch (err: any) {
              toast.error(`Failed to deactivate ${staffType}`);
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'on_break':
        return 'bg-yellow-100 text-yellow-800';
      case 'on_delivery':
        return 'bg-blue-100 text-blue-800';
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
      case 'on_delivery':
        return 'On Delivery';
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
            <h1 className="text-2xl font-bold text-gray-800">Staff Management</h1>
            <p className="text-sm text-gray-600 mt-1">Manage your restaurant staff</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={toggleInactive}
            className={`px-4 py-2 rounded-md transition-colors ${
              showInactive 
                ? 'bg-gray-600 text-white hover:bg-gray-700' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {showInactive ? 'Hide Inactive' : 'Show Inactive'}
          </button>
          <button
            onClick={toggleStats}
            className={`px-4 py-2 rounded-md transition-colors ${
              showStats 
                ? 'bg-purple-600 text-white hover:bg-purple-700' 
                : 'bg-purple-200 text-purple-700 hover:bg-purple-300'
            }`}
          >
            {showStats ? 'Hide Stats' : 'Show Stats'}
          </button>
          <button
            onClick={() => handleOpenModal()}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            + Add {activeTab === 'waiter' ? 'Waiter' : 'Delivery Driver'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-gray-200">
        <button
          onClick={() => handleTabChange('waiter')}
          className={`px-6 py-3 font-medium transition-colors relative ${
            activeTab === 'waiter'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          Waiters
        </button>
        <button
          onClick={() => handleTabChange('delivery')}
          className={`px-6 py-3 font-medium transition-colors relative ${
            activeTab === 'delivery'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          Delivery Drivers
        </button>
      </div>

      {/* Staff List */}
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="text-gray-600">Loading {activeTab === 'waiter' ? 'waiters' : 'delivery drivers'}...</div>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md">
          {error}
        </div>
      ) : staffList.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <p className="text-gray-600">No {activeTab === 'waiter' ? 'waiters' : 'delivery drivers'} found. Add your first {activeTab === 'waiter' ? 'waiter' : 'delivery driver'} to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {staffList.map((staff) => (
            <div
              key={staff.id}
              className={`bg-white p-5 rounded-lg shadow-md border border-gray-200 hover:shadow-lg transition-shadow ${
                staff.status === 'inactive' ? 'opacity-60' : ''
              }`}
            >
              <div className="flex justify-between items-start mb-3">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-800">{staff.name}</h3>
                  <p className="text-sm text-gray-600">ID: {staff.employee_id}</p>
                </div>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(
                    staff.status
                  )}`}
                >
                  {getStatusLabel(staff.status)}
                </span>
              </div>

              {staff.phone_number && (
                <p className="text-sm text-gray-600 mb-2">📞 {staff.phone_number}</p>
              )}

              {activeTab === 'delivery' && (staff as DeliveryDriver).vehicle_type && (
                <div className="space-y-1 mb-3 p-2 bg-blue-50 rounded">
                  <p className="text-sm text-gray-700">
                    <span className="font-medium">Vehicle:</span> {(staff as DeliveryDriver).vehicle_type}
                  </p>
                  {(staff as DeliveryDriver).vehicle_number && (
                    <p className="text-sm text-gray-700">
                      <span className="font-medium">Plate:</span> {(staff as DeliveryDriver).vehicle_number}
                    </p>
                  )}
                </div>
              )}

              {showStats && (
                <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-gray-200">
                  <div>
                    <p className="text-xs text-gray-500">Active Orders</p>
                    <p className="text-xl font-bold text-blue-600">
                      {staff.active_orders || 0}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Completed Today</p>
                    <p className="text-xl font-bold text-green-600">
                      {staff.completed_today || 0}
                    </p>
                  </div>
                  {staff.sales_today !== undefined && (
                    <div className="col-span-2">
                      <p className="text-xs text-gray-500">Sales Today</p>
                      <p className="text-xl font-bold text-purple-600">
                        OMR {Number(staff.sales_today || 0).toFixed(3)}
                      </p>
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-2 mt-4 pt-4 border-t border-gray-200">
                <button
                  onClick={() => handleOpenModal(staff)}
                  className="flex-1 px-3 py-2 bg-blue-50 text-blue-600 rounded-md hover:bg-blue-100 transition-colors text-sm font-medium"
                >
                  Edit
                </button>
                {staff.status !== 'inactive' && (
                  <button
                    onClick={() => handleDelete(staff.id)}
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

      {/* Add/Edit Staff Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">
              {activeTab === 'waiter' 
                ? (editingWaiter ? 'Edit Waiter' : 'Add New Waiter')
                : (editingDriver ? 'Edit Delivery Driver' : 'Add New Delivery Driver')
              }
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

              {activeTab === 'delivery' && (
                <>
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
                </>
              )}

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
                  {activeTab === 'delivery' && <option value="on_delivery">On Delivery</option>}
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
                  {(editingWaiter || editingDriver) ? 'Update' : 'Create'}
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
