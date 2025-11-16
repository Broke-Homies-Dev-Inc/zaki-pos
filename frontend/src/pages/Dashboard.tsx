import { IndianRupee, ShoppingCart, Users, Package, Plus } from "lucide-react";
import React, { useState } from "react";
import { CreateOrderModal } from "../components/CreateOrderModal";
import { RevenueChart } from "../components/RevenueChart";
import { useDashboard } from "../hooks/useDashboard";
import { useRestaurantSettingsContext } from "../contexts/useRestaurantSettingsContext";
import { formatCurrency } from "../lib/utils";

// The StatCard component remains the same
const StatCard = ({
    title,
    value,
    icon: Icon,
    change,
    color,
}: {
    title: string;
    value: string;
    icon: React.ElementType;
    change: string;
    color: string;
}) => {
    const iconColorClass = `bg-${color}-100 text-${color}-600`;

    return (
        <div className="bg-white p-6 rounded-lg shadow-sm">
            <div className="flex items-start justify-between">
                <div className="flex flex-col space-y-2">
                    <span className="text-sm font-medium text-gray-500">
                        {title}
                    </span>
                    <span className="text-3xl font-bold text-gray-900">
                        {value}
                    </span>
                    <span className="text-xs text-gray-500">{change}</span>
                </div>
                <div className={`p-3 rounded-full ${iconColorClass}`}>
                    <Icon className="h-6 w-6" />
                </div>
            </div>
        </div>
    );
};

export function Dashboard() {
    const [isCreateOrderModalOpen, setCreateOrderModalOpen] = useState(false);
    const { stats, loading, error } = useDashboard();
    const { settings } = useRestaurantSettingsContext();

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-gray-500">Loading dashboard...</div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-red-500">{error}</div>
            </div>
        );
    }

    if (!stats) {
        return null;
    }

    // Build stats array from real data
    const statsData = [
        {
            title: "Today's Revenue",
            value: formatCurrency(stats.todayRevenue, settings?.currency || 'OMR'),
            icon: IndianRupee,
            change: stats.revenueChange,
            color: "blue",
        },
        {
            title: "Today's Orders",
            value: stats.todayOrders.toString(),
            icon: ShoppingCart,
            change: stats.ordersChange,
            color: "orange",
        },
        {
            title: "New Customers",
            value: stats.newCustomers.toString(),
            icon: Users,
            change: `${stats.customersThisHour} this hour`,
            color: "green",
        },
        {
            title: "Pending Orders",
            value: stats.pendingOrders.toString(),
            icon: Package,
            change:
                stats.pendingOrders > 5
                    ? `${stats.pendingOrders - 5} more than usual`
                    : "Normal load",
            color: "red",
        },
    ];

    return (
        <div>
            {/* 3. This is the new header section */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">
                        Dashboard
                    </h1>
                    <p className="mt-1 text-gray-600">
                        Welcome back! Here's a summary of your business today.
                    </p>
                </div>
                <button
                    onClick={() => setCreateOrderModalOpen(true)}
                    className="bg-blue-600 text-white font-semibold px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 transition-colors"
                >
                    <Plus size={20} />
                    Create Order
                </button>
            </div>

            {/* Stat Cards Grid */}
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
                {statsData.map((stat) => (
                    <StatCard key={stat.title} {...stat} />
                ))}
            </div>

            {/* Revenue Chart */}
            <div className="mt-8">
                <RevenueChart />
            </div>

            {/* 4. Conditionally render the modal */}
            {isCreateOrderModalOpen && (
                <CreateOrderModal
                    onClose={() => setCreateOrderModalOpen(false)}
                />
            )}
        </div>
    );
}
