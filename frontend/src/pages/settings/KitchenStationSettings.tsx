import { useState, useEffect } from "react";
import { ArrowLeft, Save, Plus, Edit2, Trash2, ChefHat, Printer, Check } from "lucide-react";
import api from "../../lib/api";
import { toast } from "react-toastify";
import { confirmAlert } from 'react-confirm-alert';
import 'react-confirm-alert/src/react-confirm-alert.css';

interface KitchenStationSettingsProps {
    onBack: () => void;
}

interface KotDevice {
    id: string;
    name: string;
    ip_address: string | null;
    active: boolean;
}

interface KitchenStation {
    id: string;
    name: string;
    description: string | null;
    active: boolean;
    devices: {
        device_id: string;
        device_name: string;
        ip_address: string | null;
        device_active: boolean;
    }[];
}

export function KitchenStationSettings({ onBack }: KitchenStationSettingsProps) {
    const [stations, setStations] = useState<KitchenStation[]>([]);
    const [allDevices, setAllDevices] = useState<KotDevice[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingStation, setEditingStation] = useState<KitchenStation | null>(null);
    const [saving, setSaving] = useState(false);

    const [formData, setFormData] = useState({
        name: "",
        description: "",
        device_ids: [] as string[]
    });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [stationsRes, devicesRes] = await Promise.all([
                api.get("/setting/kitchen-stations"),
                api.get("/setting/kot-devices")
            ]);
            setStations(stationsRes.data);
            setAllDevices(devicesRes.data);
        } catch (error) {
            console.error("Error fetching data:", error);
        } finally {
            setLoading(false);
        }
    };

    const openAddModal = () => {
        setEditingStation(null);
        setFormData({
            name: "",
            description: "",
            device_ids: []
        });
        setShowModal(true);
    };

    const openEditModal = (station: KitchenStation) => {
        setEditingStation(station);
        setFormData({
            name: station.name,
            description: station.description || "",
            device_ids: station.devices.map(d => d.device_id)
        });
        setShowModal(true);
    };

    const toggleDeviceSelection = (deviceId: string) => {
        setFormData(prev => ({
            ...prev,
            device_ids: prev.device_ids.includes(deviceId)
                ? prev.device_ids.filter(id => id !== deviceId)
                : [...prev.device_ids, deviceId]
        }));
    };

    const handleSave = async () => {
        if (!formData.name.trim()) {
            toast.error("Station name is required");
            return;
        }

        setSaving(true);
        try {
            const payload = {
                name: formData.name.trim(),
                description: formData.description.trim() || null,
                device_ids: formData.device_ids
            };

            if (editingStation) {
                await api.put(`/setting/kitchen-stations/${editingStation.id}`, payload);
            } else {
                await api.post("/setting/kitchen-stations", payload);
            }

            setShowModal(false);
            await fetchData();
            toast.success(`Kitchen station ${editingStation ? 'updated' : 'created'} successfully`);
        } catch (error: any) {
            console.error("Error saving station:", error);
            const message = error.response?.data?.message || "Failed to save station";
            toast.error(message);
        } finally {
            setSaving(false);
        }
    };

    const handleToggle = async (station: KitchenStation) => {
        try {
            await api.patch(`/setting/kitchen-stations/${station.id}/toggle`);
            await fetchData();
        } catch (error) {
            console.error("Error toggling station:", error);
            toast.error("Failed to toggle station status");
        }
    };

    const handleDelete = async (station: KitchenStation) => {
        confirmAlert({
            title: 'Delete Kitchen Station',
            message: `Are you sure you want to delete "${station.name}"? Menu items assigned to this station will be unassigned.`,
            buttons: [
                {
                    label: 'Yes, Delete',
                    onClick: async () => {
                        try {
                            await api.delete(`/setting/kitchen-stations/${station.id}`);
                            await fetchData();
                            toast.success("Kitchen station deleted successfully");
                        } catch (error) {
                            console.error("Error deleting station:", error);
                            toast.error("Failed to delete station");
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

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-gray-500">Loading stations...</div>
            </div>
        );
    }

    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center">
                    <button
                        onClick={onBack}
                        className="mr-4 p-2 hover:bg-gray-100 rounded-lg"
                    >
                        <ArrowLeft size={24} />
                    </button>
                    <h1 className="text-3xl font-bold text-gray-900">
                        Kitchen Stations
                    </h1>
                </div>
                <button
                    onClick={openAddModal}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                    <Plus size={20} />
                    Add Station
                </button>
            </div>

            <div className="bg-white rounded-lg shadow-sm">
                {/* Info Banner */}
                <div className="bg-orange-50 border-b border-orange-200 p-4">
                    <div className="flex items-start gap-3">
                        <ChefHat size={24} className="text-orange-600 mt-0.5" />
                        <div>
                            <p className="font-semibold text-orange-900">Kitchen Station Management</p>
                            <p className="text-sm text-orange-700 mt-1">
                                Define kitchen work areas (e.g., Grill, Fry, Salad) and link them to KOT devices.
                                Menu items can then be assigned to stations for organized kitchen workflow.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Station List */}
                {stations.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                        <ChefHat size={48} className="mx-auto mb-4 text-gray-300" />
                        <p className="text-lg font-medium">No kitchen stations configured</p>
                        <p className="text-sm mt-1">Add your first station to organize your kitchen workflow</p>
                    </div>
                ) : (
                    <div className="divide-y">
                        {stations.map((station) => (
                            <div key={station.id} className="p-4 hover:bg-gray-50">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className={`p-2 rounded-lg ${station.active ? 'bg-orange-100' : 'bg-gray-100'}`}>
                                            <ChefHat size={24} className={station.active ? 'text-orange-600' : 'text-gray-400'} />
                                        </div>
                                        <div>
                                            <p className="font-semibold text-gray-800">{station.name}</p>
                                            {station.description && (
                                                <p className="text-sm text-gray-500 mt-0.5">{station.description}</p>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => handleToggle(station)}
                                            className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${station.active ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                                        >
                                            {station.active ? "Active" : "Inactive"}
                                        </button>
                                        <button
                                            onClick={() => openEditModal(station)}
                                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                        >
                                            <Edit2 size={20} />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(station)}
                                            className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                        >
                                            <Trash2 size={20} />
                                        </button>
                                    </div>
                                </div>
                                {/* Linked Devices */}
                                {station.devices.length > 0 && (
                                    <div className="mt-3 ml-14 flex flex-wrap gap-2">
                                        {station.devices.map((device) => (
                                            <span
                                                key={device.device_id}
                                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${device.device_active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}
                                            >
                                                <Printer size={12} />
                                                {device.device_name}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Add/Edit Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
                        <h2 className="text-xl font-bold text-gray-900 mb-4">
                            {editingStation ? "Edit Station" : "Add New Station"}
                        </h2>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Station Name *
                                </label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="e.g., Grill Station"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Description
                                </label>
                                <textarea
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    placeholder="e.g., Handles all grilled items"
                                    rows={2}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Linked KOT Devices
                                </label>
                                {allDevices.length === 0 ? (
                                    <p className="text-sm text-gray-500 italic">
                                        No KOT devices available. Add devices in KOT Device settings first.
                                    </p>
                                ) : (
                                    <div className="space-y-2 max-h-40 overflow-y-auto border border-gray-200 rounded-lg p-2">
                                        {allDevices.map((device) => (
                                            <button
                                                key={device.id}
                                                type="button"
                                                onClick={() => toggleDeviceSelection(device.id)}
                                                className={`w-full flex items-center justify-between p-2 rounded-lg transition-colors ${formData.device_ids.includes(device.id)
                                                        ? 'bg-blue-50 border border-blue-200'
                                                        : 'bg-gray-50 border border-gray-200 hover:bg-gray-100'
                                                    }`}
                                            >
                                                <div className="flex items-center gap-2">
                                                    <Printer size={16} className={device.active ? 'text-green-600' : 'text-gray-400'} />
                                                    <span className="text-sm font-medium">{device.name}</span>
                                                    {device.ip_address && (
                                                        <span className="text-xs text-gray-500">({device.ip_address})</span>
                                                    )}
                                                </div>
                                                {formData.device_ids.includes(device.id) && (
                                                    <Check size={16} className="text-blue-600" />
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 mt-6">
                            <button
                                onClick={() => setShowModal(false)}
                                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg font-medium hover:bg-gray-300"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400"
                            >
                                <Save size={18} />
                                {saving ? "Saving..." : "Save"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
