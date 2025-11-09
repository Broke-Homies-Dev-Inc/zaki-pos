import { useState, useEffect } from "react";
import { ArrowLeft, Save } from "lucide-react";
import api from "../../lib/api";
import { useRestaurantSettingsContext } from "../../contexts/RestaurantSettingsContext";

interface RestaurantSettingsProps {
    onBack: () => void;
}

interface Settings {
    id?: number;
    restaurant_name: string;
    address: string;
    contact_number: string;
    registration_number: string;
    tax_rate: number;
}

export function RestaurantSettings({ onBack }: RestaurantSettingsProps) {
    const { refetch } = useRestaurantSettingsContext();
    const [settings, setSettings] = useState<Settings>({
        restaurant_name: "",
        address: "",
        contact_number: "",
        registration_number: "",
        tax_rate: 0,
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            const response = await api.get("/setting/settings");
            setSettings(response.data);
        } catch (error) {
            console.error("Error fetching settings:", error);
            alert("Failed to load settings");
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await api.post("/setting/settings", settings);
            alert("Settings saved successfully!");
            // Refetch settings in context to update navbar
            await refetch();
        } catch (error) {
            console.error("Error saving settings:", error);
            alert("Failed to save settings");
        } finally {
            setSaving(false);
        }
    };

    const handleChange = (field: keyof Settings, value: string | number) => {
        setSettings((prev) => ({ ...prev, [field]: value }));
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
                    Restaurant Settings
                </h1>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6 max-w-2xl">
                <div className="space-y-6">
                    {/* Restaurant Name */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Restaurant Name *
                        </label>
                        <input
                            type="text"
                            value={settings.restaurant_name}
                            onChange={(e) =>
                                handleChange("restaurant_name", e.target.value)
                            }
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="Enter restaurant name"
                        />
                    </div>

                    {/* Address */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Address *
                        </label>
                        <textarea
                            value={settings.address}
                            onChange={(e) =>
                                handleChange("address", e.target.value)
                            }
                            rows={3}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="Enter restaurant address"
                        />
                    </div>

                    {/* Contact Number */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Phone Number *
                        </label>
                        <input
                            type="text"
                            value={settings.contact_number}
                            onChange={(e) =>
                                handleChange("contact_number", e.target.value)
                            }
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="Enter phone number"
                        />
                    </div>

                    {/* Registration Number */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Registration Number
                        </label>
                        <input
                            type="text"
                            value={settings.registration_number}
                            onChange={(e) =>
                                handleChange(
                                    "registration_number",
                                    e.target.value
                                )
                            }
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="Enter business registration number"
                        />
                    </div>

                    {/* Tax Rate */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Tax Rate (%)
                        </label>
                        <input
                            type="number"
                            step="0.01"
                            min="0"
                            max="100"
                            value={settings.tax_rate}
                            onChange={(e) =>
                                handleChange(
                                    "tax_rate",
                                    parseFloat(e.target.value) || 0
                                )
                            }
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="Enter tax rate (e.g., 10 for 10%)"
                        />
                        <p className="text-sm text-gray-500 mt-1">
                            This tax rate will be applied to orders
                        </p>
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
                </div>
            </div>
        </div>
    );
}
