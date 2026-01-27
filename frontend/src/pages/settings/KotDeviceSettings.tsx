import { useState, useEffect } from "react";
import { ArrowLeft, Save, Plus, Edit2, Trash2, Printer, Wifi, WifiOff } from "lucide-react";
import api from "../../lib/api";
import { toast } from "react-toastify";
import { confirmAlert } from 'react-confirm-alert';
import 'react-confirm-alert/src/react-confirm-alert.css';

interface KotDeviceSettingsProps {
    onBack: () => void;
}

interface KotDevice {
    id: string;
    name: string;
    ip_address: string | null;
    port: number;
    device_type: string;
    active: boolean;
}

export function KotDeviceSettings({ onBack }: KotDeviceSettingsProps) {
    const [devices, setDevices] = useState<KotDevice[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingDevice, setEditingDevice] = useState<KotDevice | null>(null);
    const [saving, setSaving] = useState(false);

    const [formData, setFormData] = useState({
        name: "",
        ip_address: "",
        port: "9100",
        device_type: "thermal_printer"
    });

    useEffect(() => {
        fetchDevices();
    }, []);

    const fetchDevices = async () => {
        try {
            const response = await api.get("/setting/kot-devices");
            setDevices(response.data);
        } catch (error) {
            console.error("Error fetching KOT devices:", error);
        } finally {
            setLoading(false);
        }
    };

    const openAddModal = () => {
        setEditingDevice(null);
        setFormData({
            name: "",
            ip_address: "",
            port: "9100",
            device_type: "thermal_printer"
        });
        setShowModal(true);
    };

    const openEditModal = (device: KotDevice) => {
        setEditingDevice(device);
        setFormData({
            name: device.name,
            ip_address: device.ip_address || "",
            port: String(device.port),
            device_type: device.device_type
        });
        setShowModal(true);
    };

    const handleSave = async () => {
        if (!formData.name.trim()) {
            toast.error("Device name is required");
            return;
        }

        setSaving(true);
        try {
            const payload = {
                name: formData.name.trim(),
                ip_address: formData.ip_address.trim() || null,
                port: parseInt(formData.port) || 9100,
                device_type: formData.device_type
            };

            if (editingDevice) {
                await api.put(`/setting/kot-devices/${editingDevice.id}`, payload);
            } else {
                await api.post("/setting/kot-devices", payload);
            }

            setShowModal(false);
            await fetchDevices();
            toast.success(`Device ${editingDevice ? 'updated' : 'added'} successfully`);
        } catch (error) {
            console.error("Error saving device:", error);
            toast.error("Failed to save device");
        } finally {
            setSaving(false);
        }
    };

    const handleToggle = async (device: KotDevice) => {
        try {
            await api.patch(`/setting/kot-devices/${device.id}/toggle`);
            await fetchDevices();
        } catch (error) {
            console.error("Error toggling device:", error);
            toast.error("Failed to toggle device status");
        }
    };

    const handleDelete = async (device: KotDevice) => {
        confirmAlert({
            title: 'Delete Device',
            message: `Are you sure you want to delete "${device.name}"?`,
            buttons: [
                {
                    label: 'Yes, Delete',
                    onClick: async () => {
                        try {
                            await api.delete(`/setting/kot-devices/${device.id}`);
                            await fetchDevices();
                            toast.success("Device deleted successfully");
                        } catch (error) {
                            console.error("Error deleting device:", error);
                            toast.error("Failed to delete device");
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
                <div className="text-gray-500">Loading devices...</div>
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
                        KOT Devices
                    </h1>
                </div>
                <button
                    onClick={openAddModal}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                    <Plus size={20} />
                    Add Device
                </button>
            </div>

            <div className="bg-white rounded-lg shadow-sm">
                {/* Info Banner */}
                <div className="bg-blue-50 border-b border-blue-200 p-4">
                    <div className="flex items-start gap-3">
                        <Printer size={24} className="text-blue-600 mt-0.5" />
                        <div>
                            <p className="font-semibold text-blue-900">KOT Device Management</p>
                            <p className="text-sm text-blue-700 mt-1">
                                Configure kitchen ticket printers and display devices. These devices will receive kitchen order tickets (KOT) when orders are placed.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Device List */}
                {devices.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                        <Printer size={48} className="mx-auto mb-4 text-gray-300" />
                        <p className="text-lg font-medium">No KOT devices configured</p>
                        <p className="text-sm mt-1">Add your first device to start printing kitchen tickets</p>
                    </div>
                ) : (
                    <div className="divide-y">
                        {devices.map((device) => (
                            <div key={device.id} className="p-4 hover:bg-gray-50 flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className={`p-2 rounded-lg ${device.active ? 'bg-green-100' : 'bg-gray-100'}`}>
                                        <Printer size={24} className={device.active ? 'text-green-600' : 'text-gray-400'} />
                                    </div>
                                    <div>
                                        <p className="font-semibold text-gray-800">{device.name}</p>
                                        <div className="flex items-center gap-3 text-sm text-gray-500 mt-1">
                                            <span>{device.ip_address || "No IP configured"}</span>
                                            <span>•</span>
                                            <span>Port: {device.port}</span>
                                            <span>•</span>
                                            <span className="capitalize">{device.device_type.replace('_', ' ')}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => handleToggle(device)}
                                        className={`p-2 rounded-lg transition-colors ${device.active ? 'bg-green-100 text-green-600 hover:bg-green-200' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}
                                        title={device.active ? "Active - Click to disable" : "Inactive - Click to enable"}
                                    >
                                        {device.active ? <Wifi size={20} /> : <WifiOff size={20} />}
                                    </button>
                                    <button
                                        onClick={() => openEditModal(device)}
                                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                    >
                                        <Edit2 size={20} />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(device)}
                                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                    >
                                        <Trash2 size={20} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Add/Edit Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
                        <h2 className="text-xl font-bold text-gray-900 mb-4">
                            {editingDevice ? "Edit Device" : "Add New Device"}
                        </h2>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Device Name *
                                </label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="e.g., Kitchen Printer 1"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    IP Address
                                </label>
                                <input
                                    type="text"
                                    value={formData.ip_address}
                                    onChange={(e) => setFormData({ ...formData, ip_address: e.target.value })}
                                    placeholder="e.g., 192.168.1.100"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Port
                                </label>
                                <input
                                    type="number"
                                    value={formData.port}
                                    onChange={(e) => setFormData({ ...formData, port: e.target.value })}
                                    placeholder="9100"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Device Type
                                </label>
                                <select
                                    value={formData.device_type}
                                    onChange={(e) => setFormData({ ...formData, device_type: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                >
                                    <option value="thermal_printer">Thermal Printer</option>
                                    <option value="kitchen_display">Kitchen Display</option>
                                    <option value="label_printer">Label Printer</option>
                                </select>
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
