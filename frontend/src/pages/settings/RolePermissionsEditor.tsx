// src/pages/settings/RolePermissionsEditor.tsx
import { useState, useEffect } from "react";
import { ArrowLeft, Save, Loader2, Shield, Check, X as XIcon } from "lucide-react";
import api from "../../lib/api";
import { toast } from "react-toastify";

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

interface RolePermissionsEditorProps {
    roleId: string;
    onBack: () => void;
}

const TAB_PERMISSIONS = [
    { key: "tab_dashboard", label: "Dashboard", description: "View sales overview and statistics" },
    { key: "tab_orders", label: "Orders", description: "View and manage customer orders" },
    { key: "tab_menu", label: "Menu", description: "Manage menu items and categories" },
    { key: "tab_inventory", label: "Inventory", description: "Manage stock and inventory items" },
    { key: "tab_ingredients", label: "Ingredients", description: "Manage recipe ingredients" },
    { key: "tab_billing", label: "Billing", description: "Access billing and payment processing" },
    { key: "tab_reports", label: "Reports", description: "View sales and analytics reports" },
    { key: "tab_customers", label: "Customers", description: "Manage customer database and loyalty" },
    { key: "tab_settings", label: "Settings", description: "Access system configuration" },
];

export function RolePermissionsEditor({ roleId, onBack }: RolePermissionsEditorProps) {
    const [role, setRole] = useState<Role | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);

    // Form state for permissions
    const [permissions, setPermissions] = useState<Record<string, boolean>>({});

    useEffect(() => {
        fetchRole();
    }, [roleId]);

    const fetchRole = async () => {
        setLoading(true);
        try {
            const response = await api.get<Role>(`/roles/${roleId}`);
            const roleData = response.data;
            setRole(roleData);

            // Initialize permissions from role data
            const perms: Record<string, boolean> = {};
            TAB_PERMISSIONS.forEach(p => {
                perms[p.key] = roleData[p.key as keyof Role] as boolean;
            });
            setPermissions(perms);
        } catch (error) {
            console.error("Error fetching role:", error);
            toast.error("Failed to load role");
            onBack();
        } finally {
            setLoading(false);
        }
    };

    const togglePermission = (key: string) => {
        setPermissions(prev => ({
            ...prev,
            [key]: !prev[key]
        }));
        setHasChanges(true);
    };

    const toggleAll = (enabled: boolean) => {
        const newPerms: Record<string, boolean> = {};
        TAB_PERMISSIONS.forEach(p => {
            newPerms[p.key] = enabled;
        });
        setPermissions(newPerms);
        setHasChanges(true);
    };

    const handleSave = async () => {
        if (!role) return;

        setSaving(true);
        try {
            await api.put(`/roles/${role.id}`, {
                name: role.name,
                ...permissions
            });
            setHasChanges(false);
            toast.success("Permissions saved successfully!");
        } catch (error: any) {
            toast.error(error?.response?.data?.message || "Failed to save permissions");
        } finally {
            setSaving(false);
        }
    };

    const countEnabled = () => {
        return Object.values(permissions).filter(v => v).length;
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
        );
    }

    if (!role) {
        return null;
    }

    return (
        <div className="max-w-4xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                    <button
                        onClick={onBack}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Edit Role Permissions</h1>
                        <p className="text-gray-500 mt-1">Configure tab access for <span className="font-medium text-gray-700">{role.name}</span></p>
                    </div>
                </div>
                <button
                    onClick={handleSave}
                    disabled={saving || !hasChanges}
                    className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {saving ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                        <Save className="w-5 h-5" />
                    )}
                    {saving ? "Saving..." : "Save Changes"}
                </button>
            </div>

            {/* Role Info Card */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-blue-100 rounded-xl">
                        <Shield className="w-8 h-8 text-blue-600" />
                    </div>
                    <div className="flex-1">
                        <h2 className="text-xl font-semibold text-gray-900">{role.name}</h2>
                        <p className="text-gray-500">
                            {countEnabled()} of {TAB_PERMISSIONS.length} tabs enabled
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => toggleAll(true)}
                            className="px-3 py-1.5 text-sm font-medium text-green-700 bg-green-50 hover:bg-green-100 rounded-lg transition-colors"
                        >
                            Enable All
                        </button>
                        <button
                            onClick={() => toggleAll(false)}
                            className="px-3 py-1.5 text-sm font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                        >
                            Disable All
                        </button>
                    </div>
                </div>
            </div>

            {/* Permissions Grid */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-4 border-b bg-gray-50">
                    <h3 className="font-semibold text-gray-700">Tab Permissions</h3>
                    <p className="text-sm text-gray-500 mt-1">Click on a permission to toggle access</p>
                </div>

                <div className="divide-y">
                    {TAB_PERMISSIONS.map(perm => {
                        const isEnabled = permissions[perm.key];

                        return (
                            <button
                                key={perm.key}
                                onClick={() => togglePermission(perm.key)}
                                className={`w-full flex items-center justify-between p-5 text-left transition-colors ${isEnabled
                                        ? "hover:bg-green-50"
                                        : "hover:bg-gray-50"
                                    }`}
                            >
                                <div className="flex items-center gap-4">
                                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isEnabled
                                            ? "bg-green-100"
                                            : "bg-gray-100"
                                        }`}>
                                        {isEnabled ? (
                                            <Check className="w-6 h-6 text-green-600" />
                                        ) : (
                                            <XIcon className="w-6 h-6 text-gray-400" />
                                        )}
                                    </div>
                                    <div>
                                        <p className={`font-medium ${isEnabled ? "text-gray-900" : "text-gray-500"
                                            }`}>
                                            {perm.label}
                                        </p>
                                        <p className="text-sm text-gray-500">{perm.description}</p>
                                    </div>
                                </div>

                                <div className={`px-4 py-2 rounded-full text-sm font-medium ${isEnabled
                                        ? "bg-green-100 text-green-800"
                                        : "bg-gray-100 text-gray-600"
                                    }`}>
                                    {isEnabled ? "Enabled" : "Disabled"}
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Unsaved changes warning */}
            {hasChanges && (
                <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-3">
                    <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
                    <p className="text-amber-800 text-sm">
                        You have unsaved changes. Click "Save Changes" to apply them.
                    </p>
                </div>
            )}
        </div>
    );
}

export default RolePermissionsEditor;
