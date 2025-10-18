import { useState, useEffect } from "react";
import { useSettings, type RestaurantTable } from "../hooks/useSettings";
import { TableBillingModal } from "../components/TableBillingModal";
import { TableCard } from "../components/TableCard";
import { printBill } from "../lib/printBill";

export function Billing() {
    const { layout, loading, error, fetchLayout, updateTableStatus } =
        useSettings();
    const [selectedTable, setSelectedTable] = useState<RestaurantTable | null>(
        null
    );
    const [printingTable, setPrintingTable] = useState<string | null>(null);

    useEffect(() => {
        const interval = setInterval(() => {
            fetchLayout();
        }, 5000);
        return () => clearInterval(interval);
    }, [fetchLayout]);

    const handleQuickPrint = async (table: RestaurantTable) => {
        if (table.active_order && !printingTable) {
            try {
                setPrintingTable(table.table_id);

                // Print the bill (async, non-blocking)
                printBill({ table });

                // Update table status to 'bill_printed' in background
                updateTableStatus(table.table_id, "bill_printed").finally(
                    () => {
                        setPrintingTable(null);
                    }
                );
            } catch (error) {
                console.error("Error printing bill:", error);
                setPrintingTable(null);
            }
        }
    };

    if (loading)
        return (
            <div className="text-center py-10 text-gray-500">
                Loading floor plan...
            </div>
        );
    if (error)
        return (
            <div className="text-center py-10 text-red-500">Error: {error}</div>
        );

    return (
        <div className="p-6">
            <h1 className="text-3xl font-bold text-gray-900 mb-6">
                Table Management & Billing
            </h1>

            <div className="bg-white rounded-lg shadow-sm p-4 mb-8 flex flex-wrap gap-x-6 gap-y-2 items-center text-sm">
                <span className="font-semibold text-gray-700">Status:</span>
                <div className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded-sm bg-gray-200 border border-gray-300"></span>{" "}
                    Available
                </div>
                <div className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded-sm bg-yellow-300"></span>{" "}
                    Occupied
                </div>
                <div className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded-sm bg-blue-300"></span>{" "}
                    Bill Printed
                </div>
                <div className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded-sm bg-green-300"></span>{" "}
                    Paid
                </div>
            </div>

            <div className="space-y-10">
                {layout.map((floor) => (
                    <div
                        key={floor.floor_id}
                        className="bg-white rounded-lg shadow-sm p-6"
                    >
                        <h2 className="text-2xl font-bold text-gray-800 mb-6">
                            {floor.floor_name}
                        </h2>
                        <div className="space-y-8">
                            {(floor.sections || []).map((section) => (
                                <div key={section.section_id}>
                                    <h3 className="text-xl font-semibold text-gray-700 mb-4">
                                        {section.section_name}
                                    </h3>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                                        {(section.tables || []).map((table) => (
                                            <TableCard
                                                key={table.table_id}
                                                table={table}
                                                onClick={() => {
                                                    if (table.active_order) {
                                                        setSelectedTable(table);
                                                    }
                                                }}
                                                onQuickPrint={handleQuickPrint}
                                                isPrinting={
                                                    printingTable ===
                                                    table.table_id
                                                }
                                            />
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            {selectedTable && (
                <TableBillingModal
                    table={selectedTable}
                    onClose={() => {
                        setSelectedTable(null);
                        fetchLayout();
                    }}
                />
            )}
        </div>
    );
}
