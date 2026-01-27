// src/pages/settings/RoleManagement.tsx
import { useState, useEffect } from "react";
import { ArrowLeft, Plus, Edit2, Trash2, X, Save, Loader2, Shield, Settings2 } from "lucide-react";
import api from "../../lib/api";
import { RolePermissionsEditor } from "./RolePermissionsEditor";
import { toast } from "react-toastify";
import { confirmAlert } from 'react-confirm-alert';
import 'react-confirm-alert/src/react-confirm-alert.css';

interface Role {
    id: string;
    name: string;
    tab_dashboard: boolean;
    tab_orders: boolean;
    tab_menu: boolean;
    tab_inventory: boolean;
    tab_ingredients: boolean;
    tab_billing: boolean;
    tab_reports: boolean;
    tab_customers: boolean;
    tab_settings: boolean;
}

interface RoleManagementProps {
    onBack: () => void;
}

const TAB_PERMISSIONS = [
    { key: "tab_dashboard", label: "Dashboard" },
    { key: "tab_orders", label: "Orders" },
    { key: "tab_menu", label: "Menu" },
    { key: "tab_inventory", label: "Inventory" },
    { key: "tab_ingredients", label: "Ingredients" },
    { key: "tab_billing", label: "Billing" },
    { key: "tab_reports", label: "Reports" },
    { key: "tab_customers", label: "Customers" },
    { key: "tab_settings", label: "Settings" },
];

export function RoleManagement({ onBack }: RoleManagementProps) {
    const [roles, setRoles] = useState<Role[]>([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [saving, setSaving] = useState(false);

    // For editing permissions in separate page
    const [editingPermissionsRoleId, setEditingPermissionsRoleId] = useState<string | null>(null);

    // Form state for creating new role
    const [newRoleName, setNewRoleName] = useState("");

    useEffect(() => {
        fetchRoles();
    }, []);

    const fetchRoles = async () => {
        setLoading(true);
        try {
            const rolesRes = await api.get<Role[]>("/roles");
            setRoles(rolesRes.data);
        } catch (error) {
            console.error("Error fetching roles:", error);
        } finally {
            setLoading(false);
        }
    };

    const openAddModal = () => {
        setNewRoleName("");
        setModalOpen(true);
    };

    const closeModal = () => {
        setModalOpen(false);
    };

    const handleCreateRole = async () => {
        if (!newRoleName.trim()) {
            toast.error("Role name is required");
            return;
        }

        setSaving(true);
        try {
            const response = await api.post<Role>("/roles", {
                name: newRoleName.trim(),
                tab_dashboard: true,
                tab_orders: true,
                tab_menu: false,
                tab_inventory: false,
                tab_ingredients: false,
                tab_billing: false,
                tab_reports: false,
                tab_customers: false,
                tab_settings: false,
            });
            closeModal();
            // Open permissions editor for the new role
            setEditingPermissionsRoleId(response.data.id);
            fetchRoles();
            toast.success("Role created successfully");
        } catch (error: any) {
            toast.error(error?.response?.data?.message || "Failed to create role");
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (role: Role) => {
        confirmAlert({
            title: 'Delete Role',
            message: `Are you sure you want to delete role "${role.name}"?`,
            buttons: [
                {
                    label: 'Yes, Delete',
                    onClick: async () => {
                        try {
                            await api.delete(`/roles/${role.id}`);
                            fetchRoles();
                            toast.success("Role deleted successfully");
                        } catch (error: any) {
                            toast.error(error?.response?.data?.message || "Failed to delete role");
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

    const countPermissions = (role: Role) => {
        return TAB_PERMISSIONS.filter(p => role[p.key as keyof Role] === true).length;
    };

    // If editing permissions, show the permissions editor page
    if (editingPermissionsRoleId) {
        return (
            <RolePermissionsEditor
                roleId={editingPermissionsRoleId}
                onBack={() => {
                    setEditingPermissionsRoleId(null);
                    fetchRoles(); // Refresh roles after editing
                }}
            />
        );
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
        );
    }

    return (
        <div>
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                    <button
                        onClick={onBack}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <h1 className="text-2xl font-bold text-gray-900">Role Management</h1>
                </div>
                <button
                    onClick={openAddModal}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                    <Plus className="w-5 h-5" />
                    Add Role
                </button>
            </div>

            {/* Roles Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {roles.map((role) => (
                    <div key={role.id} className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
                        <div className="flex items-start justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-blue-100 rounded-lg">
                                    <Shield className="w-5 h-5 text-blue-600" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-gray-900">{role.name}</h3>
                                    <p className="text-sm text-gray-500">
                                        {countPermissions(role)} of {TAB_PERMISSIONS.length} tabs
                                    </p>
                                </div>
                            </div>
                            <div className="flex gap-1">
                                <button
                                    onClick={() => setEditingPermissionsRoleId(role.id)}
                                    className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                    title="Edit Permissions"
                                >
                                    <Settings2 className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => handleDelete(role)}
                                    className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                    title="Delete Role"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        {/* Permission pills */}
                        <div className="flex flex-wrap gap-2">
                            {TAB_PERMISSIONS.map(perm => (
                                <span
                                    key={perm.key}
                                    className={`px-2 py-1 text-xs rounded-full ${role[perm.key as keyof Role]
                                        ? "bg-green-100 text-green-800"
                                        : "bg-gray-100 text-gray-500"
                                        }`}
                                >
                                    {perm.label}
                                </span>
                            ))}
                        </div>

                        {/* Edit Permissions Button */}
                        <button
                            onClick={() => setEditingPermissionsRoleId(role.id)}
                            className="mt-4 w-full py-2 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                            Edit Permissions
                        </button>
                    </div>
                ))}

                {roles.length === 0 && (
                    <div className="col-span-full bg-white rounded-lg shadow-sm p-8 text-center text-gray-500">
                        No roles found. Click "Add Role" to create one.
                    </div>
                )}
            </div>

            {/* Add Role Modal (simplified - just name) */}
            {modalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4">
                        <div className="flex items-center justify-between p-6 border-b">
                            <h2 className="text-xl font-semibold text-gray-900">
                                Create New Role
                            </h2>
                            <button
                                onClick={closeModal}
                                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Role Name *
                                </label>
                                <input
                                    type="text"
                                    value={newRoleName}
                                    onChange={(e) => setNewRoleName(e.target.value)}
                                    className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    placeholder="e.g., Manager, Cashier, Waiter"
                                    autoFocus
                                />
                                <p className="text-sm text-gray-500 mt-2">
                                    After creating the role, you'll be able to configure its tab permissions.
                                </p>
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 p-6 border-t bg-gray-50">
                            <button
                                onClick={closeModal}
                                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleCreateRole}
                                disabled={saving}
                                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                            >
                                {saving ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <Plus className="w-4 h-4" />
                                )}
                                {saving ? "Creating..." : "Create & Configure"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default RoleManagement;
