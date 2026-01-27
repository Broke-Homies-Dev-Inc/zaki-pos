// src/pages/settings/DeliveryPartnerSettings.tsx
import { useState, useEffect } from 'react';
import { ArrowLeft, Plus, Trash2, Edit2, Check, X } from 'lucide-react';
import api from '../../lib/api';
import { toast } from 'react-toastify';
import { confirmAlert } from 'react-confirm-alert';
import 'react-confirm-alert/src/react-confirm-alert.css';

interface DeliveryPartner {
    id: string;
    name: string;
    active: boolean;
    created_at: string;
}

interface Props {
    onBack: () => void;
}

export function DeliveryPartnerSettings({ onBack }: Props) {
    const [partners, setPartners] = useState<DeliveryPartner[]>([]);
    const [loading, setLoading] = useState(true);
    const [newPartnerName, setNewPartnerName] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editingName, setEditingName] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchPartners();
    }, []);

    const fetchPartners = async () => {
        try {
            const res = await api.get('/setting/delivery-partners');
            setPartners(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
            console.error('Failed to fetch delivery partners:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleAddPartner = async () => {
        if (!newPartnerName.trim()) return;
        setSaving(true);
        try {
            await api.post('/setting/delivery-partners', { name: newPartnerName.trim() });
            setNewPartnerName('');
            await fetchPartners();
            toast.success('Delivery partner added successfully');
        } catch (err) {
            console.error('Failed to add partner:', err);
            toast.error('Failed to add delivery partner');
        } finally {
            setSaving(false);
        }
    };

    const handleToggle = async (id: string) => {
        try {
            await api.patch(`/setting/delivery-partners/${id}/toggle`);
            await fetchPartners();
        } catch (err) {
            console.error('Failed to toggle partner:', err);
        }
    };

    const handleDelete = async (id: string) => {
        confirmAlert({
            title: 'Delete Delivery Partner',
            message: 'Are you sure you want to delete this delivery partner?',
            buttons: [
                {
                    label: 'Yes, Delete',
                    onClick: async () => {
                        try {
                            await api.delete(`/setting/delivery-partners/${id}`);
                            await fetchPartners();
                            toast.success('Delivery partner deleted successfully');
                        } catch (err) {
                            console.error('Failed to delete partner:', err);
                            toast.error('Failed to delete delivery partner');
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

    const handleStartEdit = (partner: DeliveryPartner) => {
        setEditingId(partner.id);
        setEditingName(partner.name);
    };

    const handleSaveEdit = async () => {
        if (!editingId || !editingName.trim()) return;
        try {
            await api.put(`/setting/delivery-partners/${editingId}`, { name: editingName.trim() });
            setEditingId(null);
            setEditingName('');
            await fetchPartners();
            toast.success('Delivery partner updated successfully');
        } catch (err) {
            console.error('Failed to update partner:', err);
            toast.error('Failed to update delivery partner');
        }
    };

    const handleCancelEdit = () => {
        setEditingId(null);
        setEditingName('');
    };

    return (
        <div>
            {/* Header */}
            <div className="flex items-center gap-4 mb-6">
                <button
                    onClick={onBack}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                    <ArrowLeft size={24} />
                </button>
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Delivery Partners</h1>
                    <p className="text-gray-500 text-sm">
                        Manage online delivery partners for your restaurant
                    </p>
                </div>
            </div>

            {/* Add New Partner */}
            <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
                <h3 className="font-semibold text-gray-800 mb-4">Add New Partner</h3>
                <div className="flex gap-3">
                    <input
                        type="text"
                        value={newPartnerName}
                        onChange={(e) => setNewPartnerName(e.target.value)}
                        placeholder="Enter partner name (e.g., Talabat, Careem)"
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                        onKeyDown={(e) => e.key === 'Enter' && handleAddPartner()}
                    />
                    <button
                        onClick={handleAddPartner}
                        disabled={!newPartnerName.trim() || saving}
                        className={`px-6 py-2 rounded-lg font-medium flex items-center gap-2 ${!newPartnerName.trim() || saving
                                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                : 'bg-blue-500 text-white hover:bg-blue-600'
                            }`}
                    >
                        <Plus size={18} />
                        Add Partner
                    </button>
                </div>
            </div>

            {/* Partners List */}
            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b bg-gray-50">
                    <h3 className="font-semibold text-gray-800">Delivery Partners</h3>
                </div>

                {loading ? (
                    <div className="p-12 text-center text-gray-500">Loading...</div>
                ) : partners.length === 0 ? (
                    <div className="p-12 text-center text-gray-500">
                        <p className="mb-2">No delivery partners configured yet.</p>
                        <p className="text-sm">Add partners above to use them when creating online delivery orders.</p>
                    </div>
                ) : (
                    <div className="divide-y">
                        {partners.map((partner) => (
                            <div
                                key={partner.id}
                                className="flex items-center justify-between px-6 py-4 hover:bg-gray-50"
                            >
                                <div className="flex items-center gap-4 flex-1">
                                    {editingId === partner.id ? (
                                        <input
                                            type="text"
                                            value={editingName}
                                            onChange={(e) => setEditingName(e.target.value)}
                                            className="flex-1 max-w-xs px-3 py-1 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                            autoFocus
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') handleSaveEdit();
                                                if (e.key === 'Escape') handleCancelEdit();
                                            }}
                                        />
                                    ) : (
                                        <>
                                            <span className={`font-medium ${partner.active ? 'text-gray-800' : 'text-gray-400'}`}>
                                                {partner.name}
                                            </span>
                                            <span
                                                className={`text-xs px-2 py-1 rounded-full ${partner.active
                                                        ? 'bg-green-100 text-green-700'
                                                        : 'bg-gray-100 text-gray-500'
                                                    }`}
                                            >
                                                {partner.active ? 'Active' : 'Inactive'}
                                            </span>
                                        </>
                                    )}
                                </div>

                                <div className="flex items-center gap-2">
                                    {editingId === partner.id ? (
                                        <>
                                            <button
                                                onClick={handleSaveEdit}
                                                className="p-2 text-green-600 hover:bg-green-50 rounded-lg"
                                                title="Save"
                                            >
                                                <Check size={18} />
                                            </button>
                                            <button
                                                onClick={handleCancelEdit}
                                                className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg"
                                                title="Cancel"
                                            >
                                                <X size={18} />
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            {/* Toggle Active */}
                                            <button
                                                onClick={() => handleToggle(partner.id)}
                                                className={`px-3 py-1 text-sm rounded-lg ${partner.active
                                                        ? 'text-orange-600 hover:bg-orange-50'
                                                        : 'text-green-600 hover:bg-green-50'
                                                    }`}
                                            >
                                                {partner.active ? 'Disable' : 'Enable'}
                                            </button>

                                            {/* Edit */}
                                            <button
                                                onClick={() => handleStartEdit(partner)}
                                                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                                                title="Edit"
                                            >
                                                <Edit2 size={18} />
                                            </button>

                                            {/* Delete */}
                                            <button
                                                onClick={() => handleDelete(partner.id)}
                                                className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                                                title="Delete"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

export default DeliveryPartnerSettings;
