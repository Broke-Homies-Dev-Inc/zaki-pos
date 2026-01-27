// src/pages/settings/UserManagement.tsx
import { useState, useEffect } from "react";
import { ArrowLeft, Plus, Edit2, Trash2, X, Save, Loader2 } from "lucide-react";
import api from "../../lib/api";
import { toast } from "react-toastify";
import { confirmAlert } from 'react-confirm-alert';
import 'react-confirm-alert/src/react-confirm-alert.css';
interface Role {
    id: string;
    name: string;
}

interface User {
    id: string;
    username: string;
    name: string;
    is_active: boolean;
    last_login: string | null;
    role: Role | null;
}

interface UserManagementProps {
    onBack: () => void;
}

export function UserManagement({ onBack }: UserManagementProps) {
    const [users, setUsers] = useState<User[]>([]);
    const [roles, setRoles] = useState<Role[]>([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [saving, setSaving] = useState(false);

    // Form state
    const [formData, setFormData] = useState({
        username: "",
        password: "",
        name: "",
        role_id: "",
        is_active: true,
    });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [usersRes, rolesRes] = await Promise.all([
                api.get<User[]>("/users"),
                api.get<Role[]>("/roles"),
            ]);
            setUsers(usersRes.data);
            setRoles(rolesRes.data);
        } catch (error) {
            console.error("Error fetching data:", error);
        } finally {
            setLoading(false);
        }
    };

    const openAddModal = () => {
        setEditingUser(null);
        setFormData({
            username: "",
            password: "",
            name: "",
            role_id: "",
            is_active: true,
        });
        setModalOpen(true);
    };

    const openEditModal = (user: User) => {
        setEditingUser(user);
        setFormData({
            username: user.username,
            password: "", // Don't prefill password
            name: user.name,
            role_id: user.role?.id || "",
            is_active: user.is_active,
        });
        setModalOpen(true);
    };

    const closeModal = () => {
        setModalOpen(false);
        setEditingUser(null);
    };

    const handleSave = async () => {
        if (!formData.username || !formData.name) {
            toast.error("Username and name are required");
            return;
        }

        if (!editingUser && !formData.password) {
            toast.error("Password is required for new users");
            return;
        }

        setSaving(true);
        try {
            if (editingUser) {
                // Update existing user
                const payload: any = {
                    username: formData.username,
                    name: formData.name,
                    role_id: formData.role_id || null,
                    is_active: formData.is_active,
                };
                if (formData.password) {
                    payload.password = formData.password;
                }
                await api.put(`/users/${editingUser.id}`, payload);
            } else {
                // Create new user
                await api.post("/users", {
                    username: formData.username,
                    password: formData.password,
                    name: formData.name,
                    role_id: formData.role_id || null,
                    is_active: formData.is_active,
                });
            }
            closeModal();
            fetchData();
            toast.success(`User ${editingUser ? 'updated' : 'created'} successfully`);
        } catch (error: any) {
            toast.error(error?.response?.data?.message || "Failed to save user");
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (user: User) => {
        confirmAlert({
            title: 'Delete User',
            message: `Are you sure you want to delete user "${user.name}"?`,
            buttons: [
                {
                    label: 'Yes, Delete',
                    onClick: async () => {
                        try {
                            await api.delete(`/users/${user.id}`);
                            fetchData();
                            toast.success("User deleted successfully");
                        } catch (error: any) {
                            toast.error(error?.response?.data?.message || "Failed to delete user");
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
                    <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
                </div>
                <button
                    onClick={openAddModal}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                    <Plus className="w-5 h-5" />
                    Add User
                </button>
            </div>

            {/* Users Table */}
            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                <table className="w-full">
                    <thead className="bg-gray-50 border-b">
                        <tr>
                            <th className="text-left px-6 py-3 text-sm font-semibold text-gray-700">Name</th>
                            <th className="text-left px-6 py-3 text-sm font-semibold text-gray-700">Username</th>
                            <th className="text-left px-6 py-3 text-sm font-semibold text-gray-700">Role</th>
                            <th className="text-left px-6 py-3 text-sm font-semibold text-gray-700">Status</th>
                            <th className="text-left px-6 py-3 text-sm font-semibold text-gray-700">Last Login</th>
                            <th className="text-right px-6 py-3 text-sm font-semibold text-gray-700">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {users.map((user) => (
                            <tr key={user.id} className="hover:bg-gray-50">
                                <td className="px-6 py-4 text-sm font-medium text-gray-900">{user.name}</td>
                                <td className="px-6 py-4 text-sm text-gray-600">{user.username}</td>
                                <td className="px-6 py-4">
                                    <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                                        {user.role?.name || "No role"}
                                    </span>
                                </td>
                                <td className="px-6 py-4">
                                    <span
                                        className={`px-2 py-1 text-xs font-medium rounded-full ${user.is_active
                                            ? "bg-green-100 text-green-800"
                                            : "bg-gray-100 text-gray-800"
                                            }`}
                                    >
                                        {user.is_active ? "Active" : "Inactive"}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-500">
                                    {user.last_login
                                        ? new Date(user.last_login).toLocaleString()
                                        : "Never"}
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <button
                                        onClick={() => openEditModal(user)}
                                        className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                    >
                                        <Edit2 className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(user)}
                                        className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors ml-1"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {users.length === 0 && (
                            <tr>
                                <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                                    No users found. Click "Add User" to create one.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Add/Edit Modal */}
            {modalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4">
                        <div className="flex items-center justify-between p-6 border-b">
                            <h2 className="text-xl font-semibold text-gray-900">
                                {editingUser ? "Edit User" : "Add New User"}
                            </h2>
                            <button
                                onClick={closeModal}
                                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Name *
                                </label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    placeholder="Full name"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Username *
                                </label>
                                <input
                                    type="text"
                                    value={formData.username}
                                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    placeholder="Username for login"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Password {editingUser ? "(leave blank to keep current)" : "*"}
                                </label>
                                <input
                                    type="password"
                                    value={formData.password}
                                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    placeholder={editingUser ? "Enter new password" : "Password"}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Role
                                </label>
                                <select
                                    value={formData.role_id}
                                    onChange={(e) => setFormData({ ...formData, role_id: e.target.value })}
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                >
                                    <option value="">No role</option>
                                    {roles.map((role) => (
                                        <option key={role.id} value={role.id}>
                                            {role.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="is_active"
                                    checked={formData.is_active}
                                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                                />
                                <label htmlFor="is_active" className="text-sm text-gray-700">
                                    Active account
                                </label>
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
                                onClick={handleSave}
                                disabled={saving}
                                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                            >
                                {saving ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <Save className="w-4 h-4" />
                                )}
                                {saving ? "Saving..." : "Save"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default UserManagement;
