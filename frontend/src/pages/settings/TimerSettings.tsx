import { useState, useEffect } from "react";
import { ArrowLeft, Save, Clock } from "lucide-react";
import api from "../../lib/api";
import { useRestaurantSettingsContext } from "../../contexts/useRestaurantSettingsContext";
import { toast } from "react-toastify";

interface TimerSettingsProps {
    onBack: () => void;
}

interface TimerValues {
    timer_green_threshold: number;
    timer_orange_threshold: number;
    table_cleaning_time: number;
}

export function TimerSettings({ onBack }: TimerSettingsProps) {
    const { refetch } = useRestaurantSettingsContext();
    const [allSettings, setAllSettings] = useState<any>(null);
    const [timerValues, setTimerValues] = useState<TimerValues>({
        timer_green_threshold: 10,
        timer_orange_threshold: 20,
        table_cleaning_time: 2,
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            const response = await api.get("/setting/settings");
            setAllSettings(response.data);
            setTimerValues({
                timer_green_threshold: response.data.timer_green_threshold ?? 10,
                timer_orange_threshold: response.data.timer_orange_threshold ?? 20,
                table_cleaning_time: response.data.table_cleaning_time ?? 2,
            });
        } catch (error) {
            console.error("Error fetching settings:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        // Validation
        if (timerValues.timer_green_threshold >= timerValues.timer_orange_threshold) {
            toast.error("Green threshold must be less than orange threshold");
            return;
        }
        if (timerValues.timer_green_threshold < 1 || timerValues.timer_orange_threshold < 2) {
            toast.error("Thresholds must be at least 1 minute");
            return;
        }
        if (timerValues.table_cleaning_time < 1) {
            toast.error("Cleaning time must be at least 1 minute");
            return;
        }

        setSaving(true);
        try {
            // Merge timer values with all existing settings
            const updatedSettings = { ...allSettings, ...timerValues };
            await api.post("/setting/settings", updatedSettings);
            toast.success("Timer settings saved successfully!");
            await refetch();
        } catch (error) {
            console.error("Error saving settings:", error);
            toast.error("Failed to save settings");
        } finally {
            setSaving(false);
        }
    };

    const handleChange = (field: keyof TimerValues, value: number) => {
        setTimerValues((prev) => ({ ...prev, [field]: value }));
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
                    Table Timer Settings
                </h1>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6 max-w-2xl">
                <div className="space-y-6">
                    {/* Description */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <div className="flex items-start gap-3">
                            <Clock size={24} className="text-blue-600 mt-0.5" />
                            <div>
                                <p className="font-semibold text-blue-900">Timer Color Thresholds</p>
                                <p className="text-sm text-blue-700 mt-1">
                                    Configure when the table timer changes color based on order duration.
                                    This helps staff quickly identify tables that have been waiting longer.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Green Threshold */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Green Threshold (minutes)
                        </label>
                        <div className="flex items-center gap-4">
                            <input
                                type="number"
                                min="1"
                                max={timerValues.timer_orange_threshold - 1}
                                value={timerValues.timer_green_threshold}
                                onChange={(e) =>
                                    handleChange("timer_green_threshold", parseInt(e.target.value) || 1)
                                }
                                className="w-32 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                            <div className="flex items-center gap-2">
                                <span className="w-4 h-4 rounded bg-green-500"></span>
                                <span className="text-sm text-gray-600">
                                    Timer is green from 0 to {timerValues.timer_green_threshold} minutes
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Orange Threshold */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Orange Threshold (minutes)
                        </label>
                        <div className="flex items-center gap-4">
                            <input
                                type="number"
                                min={timerValues.timer_green_threshold + 1}
                                value={timerValues.timer_orange_threshold}
                                onChange={(e) =>
                                    handleChange("timer_orange_threshold", parseInt(e.target.value) || 20)
                                }
                                className="w-32 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                            <div className="flex items-center gap-2">
                                <span className="w-4 h-4 rounded bg-orange-500"></span>
                                <span className="text-sm text-gray-600">
                                    Timer is orange from {timerValues.timer_green_threshold} to {timerValues.timer_orange_threshold} minutes
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Red indicator */}
                    <div className="flex items-center gap-2 pl-36">
                        <span className="w-4 h-4 rounded bg-red-500"></span>
                        <span className="text-sm text-gray-600">
                            Timer is red after {timerValues.timer_orange_threshold} minutes
                        </span>
                    </div>

                    {/* Table Cleaning Time */}
                    <div className="border-t pt-6">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Table Cleaning Time (minutes)
                        </label>
                        <div className="space-y-3">
                            <input
                                type="number"
                                min="1"
                                value={timerValues.table_cleaning_time}
                                onChange={(e) =>
                                    handleChange("table_cleaning_time", parseInt(e.target.value) || 1)
                                }
                                className="w-32 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                            <p className="text-sm text-gray-600">
                                Duration that tables stay in "cleaning" status before automatically becoming available again after bill payment.
                            </p>
                        </div>
                    </div>

                    {/* Visual Preview */}
                    <div className="border-t pt-6">
                        <h3 className="font-semibold text-gray-800 mb-4">Preview</h3>
                        <div className="flex gap-4">
                            <div className="flex flex-col items-center gap-2">
                                <div className="bg-green-500 text-white px-3 py-1 rounded text-sm font-medium flex items-center gap-1">
                                    <Clock size={12} />
                                    5:30
                                </div>
                                <span className="text-xs text-gray-500">Under {timerValues.timer_green_threshold} min</span>
                            </div>
                            <div className="flex flex-col items-center gap-2">
                                <div className="bg-orange-500 text-white px-3 py-1 rounded text-sm font-medium flex items-center gap-1">
                                    <Clock size={12} />
                                    {timerValues.timer_green_threshold + 5}:00
                                </div>
                                <span className="text-xs text-gray-500">{timerValues.timer_green_threshold}-{timerValues.timer_orange_threshold} min</span>
                            </div>
                            <div className="flex flex-col items-center gap-2">
                                <div className="bg-red-500 text-white px-3 py-1 rounded text-sm font-medium flex items-center gap-1">
                                    <Clock size={12} />
                                    {timerValues.timer_orange_threshold + 10}:00
                                </div>
                                <span className="text-xs text-gray-500">Over {timerValues.timer_orange_threshold} min</span>
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
                </div>
            </div>
        </div>
    );
}
