import { useState, useEffect } from "react";
import { ArrowLeft, Save, Gift } from "lucide-react";
import api from "../../lib/api";
import { useRestaurantSettingsContext } from "../../contexts/RestaurantSettingsContext";

interface LoyaltySettingsProps {
    onBack: () => void;
}

interface LoyaltySettings {
    loyalty_points_enabled: boolean;
    loyalty_points_per_100: number;
    points_value: number;
}

export function LoyaltySettings({ onBack }: LoyaltySettingsProps) {
    const { refetch } = useRestaurantSettingsContext();
    const [settings, setSettings] = useState<LoyaltySettings>({
        loyalty_points_enabled: true,
        loyalty_points_per_100: 10,
        points_value: 0.1,
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            const response = await api.get("/setting/settings");
            console.log("Loyalty Settings Response:", response.data);
            setSettings({
                loyalty_points_enabled:
                    response.data.loyalty_points_enabled ?? true,
                loyalty_points_per_100:
                    parseInt(response.data.loyalty_points_per_100) || 10,
                points_value: parseFloat(response.data.points_value) || 0.1,
            });
            console.log("Settings loaded successfully");
        } catch (error) {
            console.error("Error fetching loyalty settings:", error);
            alert("Failed to load loyalty settings");
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            // Fetch all current settings first
            const currentResponse = await api.get("/setting/settings");
            const currentSettings = currentResponse.data;

            // Merge with loyalty settings
            const updatedSettings = {
                ...currentSettings,
                loyalty_points_enabled: settings.loyalty_points_enabled,
                loyalty_points_per_100: settings.loyalty_points_per_100,
                points_value: settings.points_value,
            };

            await api.post("/setting/settings", updatedSettings);
            alert("Loyalty settings saved successfully!");
            await refetch();
        } catch (error) {
            console.error("Error saving loyalty settings:", error);
            alert("Failed to save loyalty settings");
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-gray-500">Loading loyalty settings...</div>
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
                <div className="flex items-center gap-3">
                    <Gift size={32} className="text-purple-600" />
                    <h1 className="text-3xl font-bold text-gray-900">
                        Loyalty Points Settings
                    </h1>
                </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6 max-w-2xl">
                <div className="mb-6 p-4 bg-purple-50 rounded-lg border border-purple-200">
                    <h3 className="font-semibold text-purple-900 mb-2">
                        How Loyalty Points Work
                    </h3>
                    <p className="text-sm text-purple-700">
                        Customers with phone numbers automatically earn loyalty
                        points when they complete orders. Points are calculated
                        based on the order total.
                    </p>
                </div>

                <div className="space-y-6">
                    {/* Enable/Disable Loyalty */}
                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                        <div>
                            <label className="block text-base font-medium text-gray-900">
                                Enable Loyalty Points
                            </label>
                            <p className="text-sm text-gray-500 mt-1">
                                Turn on/off the loyalty points system
                            </p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                checked={settings.loyalty_points_enabled}
                                onChange={(e) =>
                                    setSettings((prev) => ({
                                        ...prev,
                                        loyalty_points_enabled:
                                            e.target.checked,
                                    }))
                                }
                                className="sr-only peer"
                            />
                            <div className="w-14 h-7 bg-gray-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-purple-600"></div>
                        </label>
                    </div>

                    {/* Points Per 100 */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Points per ₹100 Spent *
                        </label>
                        <input
                            type="number"
                            min="1"
                            max="100"
                            value={settings.loyalty_points_per_100}
                            onChange={(e) =>
                                setSettings((prev) => ({
                                    ...prev,
                                    loyalty_points_per_100:
                                        parseInt(e.target.value) || 1,
                                }))
                            }
                            disabled={!settings.loyalty_points_enabled}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                            placeholder="Enter points per ₹100"
                        />
                        <p className="text-sm text-gray-500 mt-2">
                            Customers will earn{" "}
                            {settings.loyalty_points_per_100}{" "}
                            {settings.loyalty_points_per_100 === 1
                                ? "point"
                                : "points"}{" "}
                            for every ₹100 they spend
                        </p>
                    </div>

                    {/* Points Value (Redemption Rate) */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Value per Point (₹) *
                        </label>
                        <input
                            type="number"
                            min="0.01"
                            max="10"
                            step="0.01"
                            value={settings.points_value}
                            onChange={(e) =>
                                setSettings((prev) => ({
                                    ...prev,
                                    points_value:
                                        parseFloat(e.target.value) || 0.1,
                                }))
                            }
                            disabled={!settings.loyalty_points_enabled}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                            placeholder="Enter value per point"
                        />
                        <p className="text-sm text-gray-500 mt-2">
                            Each loyalty point is worth ₹
                            {settings.points_value.toFixed(2)} (
                            {settings.points_value === 0.1
                                ? "10 points = ₹1"
                                : settings.points_value === 1
                                ? "1 point = ₹1"
                                : `${(1 / settings.points_value).toFixed(
                                      0
                                  )} points = ₹1`}
                            )
                        </p>
                    </div>

                    {/* Example Calculation */}
                    <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                        <h4 className="font-semibold text-blue-900 mb-3">
                            Points Earning Examples
                        </h4>
                        <div className="space-y-2 text-sm text-blue-800">
                            <div className="flex justify-between">
                                <span>Order Total: ₹250</span>
                                <span className="font-semibold">
                                    →{" "}
                                    {Math.floor(
                                        (250 / 100) *
                                            settings.loyalty_points_per_100
                                    )}{" "}
                                    points earned
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span>Order Total: ₹500</span>
                                <span className="font-semibold">
                                    →{" "}
                                    {Math.floor(
                                        (500 / 100) *
                                            settings.loyalty_points_per_100
                                    )}{" "}
                                    points earned
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span>Order Total: ₹1,000</span>
                                <span className="font-semibold">
                                    →{" "}
                                    {Math.floor(
                                        (1000 / 100) *
                                            settings.loyalty_points_per_100
                                    )}{" "}
                                    points earned
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Redemption Examples */}
                    <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                        <h4 className="font-semibold text-green-900 mb-3">
                            Points Redemption Examples
                        </h4>
                        <div className="space-y-2 text-sm text-green-800">
                            <div className="flex justify-between">
                                <span>200 points redeemed</span>
                                <span className="font-semibold">
                                    → ₹
                                    {(200 * settings.points_value).toFixed(2)}{" "}
                                    discount
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span>500 points redeemed</span>
                                <span className="font-semibold">
                                    → ₹
                                    {(500 * settings.points_value).toFixed(2)}{" "}
                                    discount
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span>1,000 points redeemed</span>
                                <span className="font-semibold">
                                    → ₹
                                    {(1000 * settings.points_value).toFixed(2)}{" "}
                                    discount
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Save Button */}
                    <div className="pt-4 border-t">
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="flex items-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                        >
                            <Save size={20} />
                            {saving ? "Saving..." : "Save Loyalty Settings"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
