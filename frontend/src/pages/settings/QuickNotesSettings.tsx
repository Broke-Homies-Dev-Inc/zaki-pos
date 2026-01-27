import { useState, useEffect } from "react";
import { ArrowLeft, Save, Plus, X, MessageSquare } from "lucide-react";
import api from "../../lib/api";
import { useRestaurantSettingsContext } from "../../contexts/useRestaurantSettingsContext";
import { toast } from "react-toastify";

interface QuickNotesSettingsProps {
    onBack: () => void;
}

export function QuickNotesSettings({ onBack }: QuickNotesSettingsProps) {
    const { refetch } = useRestaurantSettingsContext();
    const [allSettings, setAllSettings] = useState<any>(null);
    const [quickNotes, setQuickNotes] = useState<string[]>([]);
    const [newNote, setNewNote] = useState("");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            const response = await api.get("/setting/settings");
            setAllSettings(response.data);
            setQuickNotes(response.data.global_quick_notes ?? []);
        } catch (error) {
            console.error("Error fetching settings:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleAddNote = () => {
        const trimmed = newNote.trim();
        if (trimmed && !quickNotes.includes(trimmed)) {
            setQuickNotes((prev) => [...prev, trimmed]);
            setNewNote("");
        }
    };

    const handleRemoveNote = (index: number) => {
        setQuickNotes((prev) => prev.filter((_, i) => i !== index));
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            // Merge quick notes with all existing settings
            const updatedSettings = { ...allSettings, global_quick_notes: quickNotes };
            await api.post("/setting/settings", updatedSettings);
            toast.success("Quick notes saved successfully!");
            await refetch();
        } catch (error) {
            console.error("Error saving settings:", error);
            toast.error("Failed to save settings");
        } finally {
            setSaving(false);
        }
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
                    Global Quick Notes
                </h1>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6 max-w-2xl">
                <div className="space-y-6">
                    {/* Description */}
                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                        <div className="flex items-start gap-3">
                            <MessageSquare size={24} className="text-purple-600 mt-0.5" />
                            <div>
                                <p className="font-semibold text-purple-900">Global Quick Notes</p>
                                <p className="text-sm text-purple-700 mt-1">
                                    These quick notes are available for all menu items in the waiter app.
                                    Staff can quickly add these common notes when taking orders.
                                    Items can also have their own specific notes that appear first.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Add New Note */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Add New Quick Note
                        </label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={newNote}
                                onChange={(e) => setNewNote(e.target.value)}
                                onKeyPress={(e) => e.key === "Enter" && handleAddNote()}
                                placeholder="e.g., Less Spicy, No Onion, Extra Cheese..."
                                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            />
                            <button
                                onClick={handleAddNote}
                                disabled={!newNote.trim()}
                                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                            >
                                <Plus size={18} />
                                Add
                            </button>
                        </div>
                    </div>

                    {/* Notes List */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-3">
                            Current Quick Notes ({quickNotes.length})
                        </label>
                        <div className="flex flex-wrap gap-2">
                            {quickNotes.map((note, index) => (
                                <div
                                    key={index}
                                    className="inline-flex items-center gap-2 px-3 py-2 bg-purple-50 text-purple-800 rounded-full border border-purple-200"
                                >
                                    <span className="text-sm font-medium">{note}</span>
                                    <button
                                        onClick={() => handleRemoveNote(index)}
                                        className="p-0.5 hover:bg-purple-200 rounded-full transition-colors"
                                        title="Remove note"
                                    >
                                        <X size={14} />
                                    </button>
                                </div>
                            ))}
                        </div>
                        {quickNotes.length === 0 && (
                            <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-lg">
                                <MessageSquare size={32} className="mx-auto text-gray-400 mb-2" />
                                <p className="text-gray-500">No quick notes added yet.</p>
                                <p className="text-sm text-gray-400">Add some common notes above.</p>
                            </div>
                        )}
                    </div>

                    {/* Example Notes */}
                    <div className="border-t pt-4">
                        <p className="text-sm text-gray-500 mb-2">Suggested quick notes:</p>
                        <div className="flex flex-wrap gap-2">
                            {["Less Spicy", "More Spicy", "No Onion", "No Garlic", "Extra Cheese", "Well Done", "Less Salt", "No Oil"].map((suggestion) => (
                                <button
                                    key={suggestion}
                                    onClick={() => {
                                        if (!quickNotes.includes(suggestion)) {
                                            setQuickNotes((prev) => [...prev, suggestion]);
                                        }
                                    }}
                                    disabled={quickNotes.includes(suggestion)}
                                    className="px-3 py-1 text-sm bg-gray-100 text-gray-600 rounded-full hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    + {suggestion}
                                </button>
                            ))}
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
                            {saving ? "Saving..." : "Save Quick Notes"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
