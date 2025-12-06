import { useState, useEffect } from "react";
import { ArrowLeft, Printer, Save } from "lucide-react";
import api from "../../lib/api";

interface PrintSettingsProps {
    onBack: () => void;
}

export function PrintSettings({ onBack }: PrintSettingsProps) {
    const [printPreviewEnabled, setPrintPreviewEnabled] = useState(true);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            setLoading(true);
            const response = await api.get("/setting/settings");
            setPrintPreviewEnabled(
                response.data.print_preview_enabled !== undefined
                    ? response.data.print_preview_enabled
                    : true
            );
        } catch (error) {
            console.error("Error fetching print settings:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        try {
            setSaving(true);

            // Fetch current settings first
            const currentSettings = await api.get("/setting/settings");

            // Update with new print preview setting
            await api.post("/setting/settings", {
                ...currentSettings.data,
                print_preview_enabled: printPreviewEnabled,
            });

            alert("Print settings saved successfully!");
        } catch (error) {
            console.error("Error saving print settings:", error);
            alert("Failed to save print settings. Please try again.");
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-gray-500">Loading print settings...</div>
            </div>
        );
    }

    return (
        <div>
            <div className="mb-6">
                <button
                    onClick={onBack}
                    className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
                >
                    <ArrowLeft size={20} />
                    <span>Back to Settings</span>
                </button>
                <h1 className="text-3xl font-bold text-gray-900">
                    🖨️ Print Settings
                </h1>
                <p className="text-gray-500 mt-2">
                    Configure how bills are printed in your restaurant
                </p>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6 max-w-2xl">
                {/* Info Section */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                    <h3 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
                        <Printer className="w-5 h-5" />
                        How Print Preview Works
                    </h3>
                    <div className="text-sm text-blue-800 space-y-2">
                        <p>
                            <strong>Preview Enabled (Default):</strong> Opens a
                            print preview window where you can review the bill
                            before printing or saving.
                        </p>
                        <p>
                            <strong>Preview Disabled:</strong> Automatically
                            saves bills as PDFs directly to your Downloads
                            folder without showing a preview window - faster for
                            busy times!
                        </p>
                    </div>
                </div>

                {/* Toggle Setting */}
                <div className="border border-gray-200 rounded-lg p-6">
                    <div className="flex items-center justify-between">
                        <div className="flex-1">
                            <label
                                htmlFor="print-preview-toggle"
                                className="text-lg font-semibold text-gray-900 cursor-pointer"
                            >
                                Enable Print Preview
                            </label>
                            <p className="text-sm text-gray-500 mt-1">
                                {printPreviewEnabled
                                    ? "Bills will open in a preview window before printing"
                                    : "Bills will be saved directly as PDFs to Downloads folder"}
                            </p>
                        </div>
                        <button
                            id="print-preview-toggle"
                            onClick={() =>
                                setPrintPreviewEnabled(!printPreviewEnabled)
                            }
                            className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                                printPreviewEnabled
                                    ? "bg-blue-600"
                                    : "bg-gray-300"
                            }`}
                        >
                            <span
                                className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                                    printPreviewEnabled
                                        ? "translate-x-7"
                                        : "translate-x-1"
                                }`}
                            />
                        </button>
                    </div>
                </div>

                {/* Current Setting Display */}
                <div className="mt-6 bg-gray-50 rounded-lg p-4">
                    <h4 className="font-semibold text-gray-700 mb-2">
                        Current Behavior:
                    </h4>
                    <div className="flex items-start gap-3">
                        {printPreviewEnabled ? (
                            <>
                                <Printer className="w-5 h-5 text-blue-600 mt-0.5" />
                                <div className="text-sm text-gray-700">
                                    <p className="font-medium">
                                        Print Preview Mode
                                    </p>
                                    <p className="text-gray-600 mt-1">
                                        When you click "Print Bill", a preview
                                        window will open. You can review the
                                        bill, print it to a physical printer, or
                                        save it as a PDF manually.
                                    </p>
                                </div>
                            </>
                        ) : (
                            <>
                                <Save className="w-5 h-5 text-green-600 mt-0.5" />
                                <div className="text-sm text-gray-700">
                                    <p className="font-medium">
                                        Direct Save Mode
                                    </p>
                                    <p className="text-gray-600 mt-1">
                                        When you click "Print Bill", the PDF
                                        will be automatically saved to your
                                        Downloads folder with filename:{" "}
                                        <code className="bg-gray-200 px-1 rounded">
                                            Bill-[OrderNumber]-[Timestamp].pdf
                                        </code>
                                    </p>
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {/* Save Button */}
                <div className="mt-6 flex justify-end">
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="px-6 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {saving ? (
                            <>
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                Saving...
                            </>
                        ) : (
                            <>
                                <Save size={18} />
                                Save Print Settings
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Additional Tips */}
            <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4 max-w-2xl">
                <h4 className="font-semibold text-yellow-900 mb-2">💡 Tips</h4>
                <ul className="text-sm text-yellow-800 space-y-1 list-disc list-inside">
                    <li>
                        During busy hours, disable preview for faster service
                    </li>
                    <li>
                        Enable preview when you need to review bills before
                        printing
                    </li>
                    <li>
                        PDFs are saved with the order number for easy
                        identification
                    </li>
                    <li>This setting applies to all staff members</li>
                </ul>
            </div>
        </div>
    );
}
