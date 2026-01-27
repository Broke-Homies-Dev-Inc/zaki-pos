import { useState, useEffect } from "react";
import { ArrowLeft, Save, Clock, AlertTriangle } from "lucide-react";
import api from "../../lib/api";
import { useRestaurantSettingsContext } from "../../contexts/useRestaurantSettingsContext";
import { toast } from "react-toastify";
import { confirmAlert } from 'react-confirm-alert';
import 'react-confirm-alert/src/react-confirm-alert.css';

interface OrderExpirySettingsProps {
    onBack: () => void;
}

interface ExpiryValues {
    order_expiry_time: number;
}

export function OrderExpirySettings({ onBack }: OrderExpirySettingsProps) {
    const { refetch } = useRestaurantSettingsContext();
    const [allSettings, setAllSettings] = useState<any>(null);
    const [expiryValues, setExpiryValues] = useState<ExpiryValues>({
        order_expiry_time: 120,
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [clearing, setClearing] = useState(false);

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            const response = await api.get("/setting/settings");
            setAllSettings(response.data);
            setExpiryValues({
                order_expiry_time: response.data.order_expiry_time ?? 120,
            });
        } catch (error) {
            console.error("Error fetching settings:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        // Validation
        if (expiryValues.order_expiry_time < 1) {
            toast.error("Expiry time must be at least 1 minute");
            return;
        }

        setSaving(true);
        try {
            // Merge expiry values with all existing settings
            const updatedSettings = { ...allSettings, ...expiryValues };
            await api.post("/setting/settings", updatedSettings);
            toast.success("Order expiry settings saved successfully!");
            await refetch();
        } catch (error) {
            console.error("Error saving settings:", error);
            toast.error("Failed to save settings");
        } finally {
            setSaving(false);
        }
    };

    const handleChange = (value: number) => {
        setExpiryValues({ order_expiry_time: value });
    };

    const handleClearAllPendingOrders = async () => {
        confirmAlert({
            title: '⚠️ Clear All Pending Orders',
            message: 'This will immediately:\n\n• Expire ALL pending and confirmed orders\n• Free ALL tables and mark them as available\n• Remove ALL table combinations\n• Clear the entire dining area\n\nThis action CANNOT be undone!',
            buttons: [
                {
                    label: 'Yes, Clear All',
                    onClick: () => {
                        // Second confirmation
                        confirmAlert({
                            title: 'Final Warning',
                            message: 'This is your final warning. Clear all pending orders?',
                            buttons: [
                                {
                                    label: 'Confirm Clear',
                                    onClick: async () => {
                                        setClearing(true);
                                        try {
                                            const response = await api.post("/order-expiry/clear-all-pending");
                                            const data = response.data;

                                            if (data.success) {
                                                toast.success(
                                                    `Successfully cleared dining area! Expired ${data.ordersCleared} order(s), freed ${data.tablesFreed} table(s), removed ${data.combinationsRemoved} combination(s)`,
                                                    { autoClose: 5000 }
                                                );
                                                await refetch();
                                            } else {
                                                toast.error("Failed to clear pending orders: " + (data.message || "Unknown error"));
                                            }
                                        } catch (error: any) {
                                            console.error("Error clearing pending orders:", error);
                                            toast.error("Failed to clear pending orders: " + (error.response?.data?.message || error.message));
                                        } finally {
                                            setClearing(false);
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
                    },
                    className: 'bg-orange-600 text-white px-4 py-2 rounded hover:bg-orange-700'
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
                <div className="text-gray-500">Loading settings...</div>
            </div>
        );
    }

    return (
        <div>
            <div className="flex items-center mb-6">
                <button
                    onClick={onBack}
                    className="mr-4 p-2 hover:bg-gray-100 rounded-lg"
                >
                    <ArrowLeft size={24} />
                </button>
                <h1 className="text-3xl font-bold text-gray-900">
                    Order Expiry Settings
                </h1>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6 max-w-2xl">
                <div className="space-y-6">
                    {/* Warning Notice */}
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                        <div className="flex items-start gap-3">
                            <AlertTriangle size={24} className="text-yellow-600 mt-0.5" />
                            <div>
                                <p className="font-semibold text-yellow-900">Testing Feature</p>
                                <p className="text-sm text-yellow-700 mt-1">
                                    This feature is for testing purposes only. Orders that exceed the expiry time
                                    will be automatically terminated, tables will be freed, and any table combinations
                                    will be removed.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Description */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <div className="flex items-start gap-3">
                            <Clock size={24} className="text-blue-600 mt-0.5" />
                            <div>
                                <p className="font-semibold text-blue-900">Automatic Order Expiry</p>
                                <p className="text-sm text-blue-700 mt-1">
                                    Configure the time after which pending or confirmed orders automatically expire.
                                    This helps with testing order lifecycle management.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Expiry Time Setting */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Order Expiry Time (minutes)
                        </label>
                        <div className="flex items-center gap-4">
                            <input
                                type="number"
                                min="1"
                                value={expiryValues.order_expiry_time}
                                onChange={(e) =>
                                    handleChange(parseInt(e.target.value) || 1)
                                }
                                className="w-32 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                            <span className="text-sm text-gray-600">
                                Orders will expire after {expiryValues.order_expiry_time} minute{expiryValues.order_expiry_time !== 1 ? 's' : ''}
                            </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-2">
                            Recommended: 60-120 minutes for testing scenarios
                        </p>
                    </div>

                    {/* What Happens on Expiry */}
                    <div className="border-t pt-6">
                        <h3 className="font-semibold text-gray-800 mb-4">What happens when an order expires?</h3>
                        <ul className="space-y-2 text-sm text-gray-600">
                            <li className="flex items-start gap-2">
                                <span className="text-blue-600 mt-0.5">•</span>
                                <span>Order status is set to 'expired'</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-blue-600 mt-0.5">•</span>
                                <span>Associated tables are freed and marked as 'available'</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-blue-600 mt-0.5">•</span>
                                <span>Any table combinations are removed and tables are separated</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-blue-600 mt-0.5">•</span>
                                <span>Order remains in history for review</span>
                            </li>
                        </ul>
                    </div>

                    {/* Visual Preview */}
                    <div className="border-t pt-6">
                        <h3 className="font-semibold text-gray-800 mb-4">Example Timeline</h3>
                        <div className="flex gap-4">
                            <div className="flex flex-col items-center gap-2">
                                <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                                    <Clock size={24} className="text-green-600" />
                                </div>
                                <span className="text-xs text-gray-600 text-center">Order<br/>Created</span>
                            </div>
                            <div className="flex items-center">
                                <div className="w-12 h-0.5 bg-gray-300"></div>
                            </div>
                            <div className="flex flex-col items-center gap-2">
                                <div className="w-16 h-16 rounded-full bg-orange-100 flex items-center justify-center">
                                    <Clock size={24} className="text-orange-600" />
                                </div>
                                <span className="text-xs text-gray-600 text-center">{Math.floor(expiryValues.order_expiry_time * 0.75)} min<br/>Warning</span>
                            </div>
                            <div className="flex items-center">
                                <div className="w-12 h-0.5 bg-gray-300"></div>
                            </div>
                            <div className="flex flex-col items-center gap-2">
                                <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
                                    <AlertTriangle size={24} className="text-red-600" />
                                </div>
                                <span className="text-xs text-gray-600 text-center">{expiryValues.order_expiry_time} min<br/>Expired</span>
                            </div>
                        </div>
                    </div>

                    {/* Save Button */}
                    <div className="pt-4 border-t">
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                        >
                            <Save size={20} />
                            {saving ? "Saving..." : "Save Settings"}
                        </button>
                    </div>

                    {/* Danger Zone - Clear All Pending Orders */}
                    <div className="border-t pt-6 mt-6">
                        <div className="bg-red-50 border-2 border-red-200 rounded-lg p-6">
                            <h3 className="font-semibold text-red-900 mb-3 flex items-center gap-2">
                                <AlertTriangle size={20} className="text-red-600" />
                                Danger Zone
                            </h3>
                            <p className="text-sm text-red-700 mb-4">
                                Clear all pending and confirmed orders immediately. This will expire all active orders,
                                free all tables, and remove all table combinations across the entire restaurant.
                            </p>
                            <div className="bg-white border border-red-300 rounded p-3 mb-4">
                                <p className="text-xs text-red-800 font-medium mb-2">This action will:</p>
                                <ul className="text-xs text-red-700 space-y-1">
                                    <li>• Set all pending/confirmed orders to "expired"</li>
                                    <li>• Mark all tables as "available"</li>
                                    <li>• Break all table combinations</li>
                                    <li>• Clear the entire dining area instantly</li>
                                </ul>
                            </div>
                            <button
                                onClick={handleClearAllPendingOrders}
                                disabled={clearing}
                                className="flex items-center gap-2 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-semibold"
                            >
                                <AlertTriangle size={20} />
                                {clearing ? "Clearing..." : "Clear All Pending Orders"}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
