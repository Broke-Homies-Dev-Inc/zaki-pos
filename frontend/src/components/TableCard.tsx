import { Printer, Clock } from "lucide-react";
import { useState, useEffect } from "react";
import type { RestaurantTable } from "../hooks/useSettings";
import { useRestaurantSettings } from "../hooks/useRestaurantSettings";
import { formatCurrency } from "../lib/utils";

interface TableCardProps {
    table: RestaurantTable;
    onClick: () => void;
    onQuickPrint: (table: RestaurantTable) => void;
    isPrinting?: boolean;
    isCombiningMode?: boolean;
    isSourceTable?: boolean;
    isTargetTable?: boolean;
    isSelectedForCombining?: boolean;
}

// Helper function to format elapsed time
const formatElapsedTime = (createdAt: string): string => {
    const now = new Date();
    const created = new Date(createdAt);
    const diffMs = now.getTime() - created.getTime();

    if (diffMs < 0) return "0:00";

    const totalSeconds = Math.floor(diffMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

// Helper function to get timer color class based on elapsed minutes
const getTimerColorClass = (createdAt: string, greenThreshold: number, orangeThreshold: number): string => {
    const now = new Date();
    const created = new Date(createdAt);
    const diffMs = now.getTime() - created.getTime();
    const totalMinutes = Math.floor(diffMs / 60000);

    if (totalMinutes < greenThreshold) {
        return "bg-green-500 text-white"; // Less than green threshold - green
    } else if (totalMinutes < orangeThreshold) {
        return "bg-orange-500 text-white"; // Between green and orange threshold - orange
    } else {
        return "bg-red-500 text-white"; // Over orange threshold - red
    }
};

export const TableCard = ({
    table,
    onClick,
    onQuickPrint,
    isPrinting = false,
    isCombiningMode = false,
    isSourceTable = false,
    isTargetTable = false,
    isSelectedForCombining = false,
}: TableCardProps) => {
    const { settings } = useRestaurantSettings();
    const [elapsedTime, setElapsedTime] = useState<string>("");

    // Get threshold values from settings
    const greenThreshold = settings.timer_green_threshold || 10;
    const orangeThreshold = settings.timer_orange_threshold || 20;

    // Update timer every second when there's an active order
    useEffect(() => {
        if (!table.active_order?.created_at) {
            setElapsedTime("");
            return;
        }

        // Set initial time
        setElapsedTime(formatElapsedTime(table.active_order.created_at));

        // Update every second
        const interval = setInterval(() => {
            setElapsedTime(formatElapsedTime(table.active_order!.created_at));
        }, 1000);

        return () => clearInterval(interval);
    }, [table.active_order?.created_at]);

    const getTableColorClass = (tableStatus: string) => {
        // Special styling for combining mode
        if (isCombiningMode) {
            if (isSelectedForCombining) {
                return "bg-blue-500 border-4 border-blue-700 text-white";
            }
            // Disable tables with printed bills or paid status
            if (tableStatus === 'bill_printed' || tableStatus === 'paid') {
                return "bg-gray-100 opacity-40 cursor-not-allowed";
            }
            // Selectable tables
            return "bg-yellow-200 hover:bg-yellow-300 border-2 border-yellow-500 cursor-pointer";
        }
        
        // Normal mode colors
        switch (tableStatus) {
            case "occupied":
                return "bg-yellow-300 hover:bg-yellow-400";
            case "bill_printed":
                return "bg-blue-300 hover:bg-blue-400";
            case "paid":
                return "bg-green-300 hover:bg-green-400";
            case "available":
            default:
                return "bg-gray-200 hover:bg-gray-300 border border-gray-300";
        }
    };

    const colorClass = getTableColorClass(table.table_status);

    return (
        <div
            className={`relative p-4 rounded-lg shadow-sm flex flex-col items-center justify-center transition-colors duration-200 cursor-pointer h-32 w-full text-center ${colorClass}`}
            onClick={onClick}
        >
            {/* Combining mode label */}
            {isSelectedForCombining && (
                <div className="absolute top-0 left-0 right-0 bg-blue-700 text-white text-xs font-bold py-1 rounded-t-lg">
                    SELECTED ✓
                </div>
            )}
            
            {/* Combined tables indicator - shows when tables are grouped */}
            {!isCombiningMode && table.is_part_of_combination && table.combined_with_tables && (
                <div className="absolute top-1 left-1 bg-purple-600 text-white text-xs font-bold px-2 py-0.5 rounded shadow-md">
                    🔗 {table.combined_with_tables}
                </div>
            )}
            
            <h4 className={`font-semibold text-xl ${isSelectedForCombining ? 'text-white mt-2' : 'text-gray-800'}`}>
                {table.table_name}
            </h4>
            {/* Timer positioned at top right with color coding */}
            {table.active_order && elapsedTime && (
                <div className={`absolute top-1 right-1 flex items-center gap-1 text-xs px-1.5 py-0.5 rounded ${getTimerColorClass(table.active_order.created_at, greenThreshold, orangeThreshold)}`}>
                    <Clock size={10} />
                    {elapsedTime}
                </div>
            )}
            {table.active_order && (
                <>
                    <p className="text-lg font-bold text-gray-700">
                        {formatCurrency(table.active_order.grand_total)}
                    </p>
                    {table.active_order.waiter_name && (
                        <p className="text-xs text-gray-600 mt-1">
                            👤 {table.active_order.waiter_name}
                        </p>
                    )}
                </>
            )}
            {table.active_order && (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onQuickPrint(table);
                    }}
                    className={`absolute bottom-1 right-1 p-1 bg-white rounded-full shadow hover:bg-gray-100 text-gray-600 ${isPrinting ? "opacity-50 cursor-wait" : ""
                        }`}
                    title="Quick Print Bill"
                    disabled={isPrinting}
                >
                    <Printer
                        size={16}
                        className={isPrinting ? "animate-pulse" : ""}
                    />
                </button>
            )}
        </div>
    );
};
