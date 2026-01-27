import { useState, useEffect } from "react";
import { useSettings, type RestaurantTable } from "../hooks/useSettings";
import { TableBillingModal } from "../components/TableBillingModal";
import { TableCard } from "../components/TableCard";
import { printBill } from "../lib/printBill";
import api from "../lib/api";
import { confirmAlert } from 'react-confirm-alert';
import 'react-confirm-alert/src/react-confirm-alert.css';
import { toast } from 'react-toastify';

export function Billing() {
    const { layout, loading, error, fetchLayout, updateTableStatus } =
        useSettings();
    const [selectedTable, setSelectedTable] = useState<RestaurantTable | null>(
        null
    );
    const [printingTable, setPrintingTable] = useState<string | null>(null);
    
    // Table combining state
    const [combiningMode, setCombiningMode] = useState<{
        active: boolean;
        selectedTables: RestaurantTable[];
    }>({
        active: false,
        selectedTables: [],
    });

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

    const handleStartCombining = (sourceTable: RestaurantTable) => {
        // Check if bill is already printed
        if (sourceTable.table_status === 'bill_printed' || sourceTable.table_status === 'paid') {
            toast.error('Cannot combine tables with printed bills or paid orders.');
            return;
        }
        
        setCombiningMode({
            active: true,
            selectedTables: [sourceTable],
        });
        setSelectedTable(null); // Close the billing modal
    };

    const handleToggleTableSelection = (table: RestaurantTable) => {
        // Check if bill is already printed
        if (table.table_status === 'bill_printed' || table.table_status === 'paid') {
            toast.error('Cannot combine tables with printed bills or paid orders.');
            return;
        }
        
        setCombiningMode(prev => {
            const isAlreadySelected = prev.selectedTables.some(t => t.table_id === table.table_id);
            
            if (isAlreadySelected) {
                // Remove from selection
                return {
                    ...prev,
                    selectedTables: prev.selectedTables.filter(t => t.table_id !== table.table_id),
                };
            } else {
                // Add to selection
                return {
                    ...prev,
                    selectedTables: [...prev.selectedTables, table],
                };
            }
        });
    };

    const handleConfirmCombine = async () => {
        if (combiningMode.selectedTables.length < 2) {
            toast.error('Please select at least 2 tables to combine.');
            return;
        }

        // Find the table with an active order (if any)
        const tableWithOrder = combiningMode.selectedTables.find(t => t.active_order);
        const tableNames = combiningMode.selectedTables.map(t => t.table_name).join(', ');

        confirmAlert({
            title: 'Combine Tables',
            message: `Combine these tables: ${tableNames}?\n\n` +
                (tableWithOrder 
                    ? `All tables will be linked to the order from ${tableWithOrder.table_name}.`
                    : `All selected tables will be grouped together.`),
            buttons: [
                {
                    label: 'Yes, Combine',
                    onClick: async () => {
                        try {
                            const tableIds = combiningMode.selectedTables.map(t => t.table_id);
                            const orderIds = combiningMode.selectedTables
                                .filter(t => t.active_order)
                                .map(t => t.active_order?.order_id);

                            const response = await api.post('/orders/combine-tables', {
                                table_ids: tableIds,
                                order_ids: orderIds,
                            });

                            toast.success(`Successfully combined tables: ${tableNames}`);
                            
                            // Reset combining mode
                            setCombiningMode({
                                active: false,
                                selectedTables: [],
                            });

                            // Refresh layout
                            fetchLayout();
                        } catch (error) {
                            console.error('Error combining tables:', error);
                            toast.error(error instanceof Error ? error.message : 'Failed to combine tables. Please try again.');
                        }
                    },
                    className: 'bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700'
                },
                {
                    label: 'Cancel',
                    onClick: () => {},
                    className: 'bg-gray-300 text-gray-800 px-4 py-2 rounded hover:bg-gray-400'
                }
            ]
        });
    };

    const handleCancelCombine = () => {
        setCombiningMode({
            active: false,
            selectedTables: [],
        });
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

            {/* Combining Mode Banner */}
            {combiningMode.active && (
                <div className="bg-blue-50 border-2 border-blue-500 rounded-lg p-4 mb-6">
                    <div className="flex items-center justify-between">
                        <div className="flex-1">
                            <h3 className="text-lg font-semibold text-blue-900">
                                Combining Tables Mode
                            </h3>
                            <p className="text-blue-700 mb-2">
                                Select tables to combine (click to add/remove)
                            </p>
                            {combiningMode.selectedTables.length > 0 && (
                                <div className="flex flex-wrap gap-2 mt-2">
                                    <span className="text-sm font-medium text-blue-800">Selected:</span>
                                    {combiningMode.selectedTables.map(table => (
                                        <span 
                                            key={table.table_id}
                                            className="px-2 py-1 bg-blue-200 text-blue-900 rounded text-sm font-medium"
                                        >
                                            {table.table_name}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="flex gap-2 ml-4">
                            <button
                                onClick={handleCancelCombine}
                                className="px-4 py-2 bg-gray-500 text-white rounded-lg font-semibold hover:bg-gray-600"
                            >
                                Cancel
                            </button>
                            {combiningMode.selectedTables.length >= 2 && (
                                <button
                                    onClick={handleConfirmCombine}
                                    className="px-4 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700"
                                >
                                    Combine ({combiningMode.selectedTables.length} tables)
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

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
                <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-sm bg-purple-100 border-2 border-purple-400 flex items-center justify-center text-xs">🔗</span>{" "}
                    Combined Tables
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
                                        {(section.tables || []).map((table) => {
                                            // Add visual wrapper for combined tables
                                            const isCombined = table.is_part_of_combination;
                                            const combinedClass = isCombined 
                                                ? "ring-2 ring-purple-400 ring-offset-2 rounded-lg" 
                                                : "";
                                            
                                            return (
                                                <div key={table.table_id} className={combinedClass}>
                                                    <TableCard
                                                        table={table}
                                                        onClick={() => {
                                                            if (combiningMode.active) {
                                                                // In combining mode, toggle table selection
                                                                handleToggleTableSelection(table);
                                                            } else {
                                                                // Normal mode - open billing modal
                                                                if (table.active_order) {
                                                                    setSelectedTable(table);
                                                                }
                                                            }
                                                        }}
                                                        onQuickPrint={handleQuickPrint}
                                                        isPrinting={
                                                            printingTable ===
                                                            table.table_id
                                                        }
                                                        isCombiningMode={combiningMode.active}
                                                        isSourceTable={false}
                                                        isTargetTable={false}
                                                        isSelectedForCombining={combiningMode.selectedTables.some(t => t.table_id === table.table_id)}
                                                    />
                                                </div>
                                            );
                                        })}
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
                    onStartCombining={handleStartCombining}
                />
            )}
        </div>
    );
}
