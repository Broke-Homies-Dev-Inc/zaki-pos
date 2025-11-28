import { Printer } from "lucide-react";
import type { RestaurantTable } from "../hooks/useSettings";
import { formatCurrency } from "../lib/utils";

interface TableCardProps {
    table: RestaurantTable;
    onClick: () => void;
    onQuickPrint: (table: RestaurantTable) => void;
    isPrinting?: boolean;
}

export const TableCard = ({
    table,
    onClick,
    onQuickPrint,
    isPrinting = false,
}: TableCardProps) => {
    const getTableColorClass = (tableStatus: string) => {
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
            <h4 className="font-semibold text-xl text-gray-800">
                {table.table_name}
            </h4>
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
                    className={`absolute bottom-1 right-1 p-1 bg-white rounded-full shadow hover:bg-gray-100 text-gray-600 ${
                        isPrinting ? "opacity-50 cursor-wait" : ""
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
