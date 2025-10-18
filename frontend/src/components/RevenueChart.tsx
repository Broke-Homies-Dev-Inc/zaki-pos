import React, { useState } from "react";
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
} from "recharts";
import { Calendar } from "lucide-react";
import { useRevenueChart, type ChartPeriod } from "../hooks/useRevenueChart";
import { formatCurrency } from "../lib/utils";

const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-white p-4 border border-gray-200 rounded-lg shadow-lg">
                <p className="text-sm font-semibold text-gray-900 mb-2">
                    {payload[0].payload.date}
                </p>
                <p className="text-sm text-blue-600">
                    Revenue: {formatCurrency(payload[0].value as number)}
                </p>
                <p className="text-sm text-orange-600">
                    Orders: {payload[1].value}
                </p>
            </div>
        );
    }
    return null;
};

export function RevenueChart() {
    const [period, setPeriod] = useState<ChartPeriod>("weekly");
    const [startDate, setStartDate] = useState<Date | null>(null);
    const [endDate, setEndDate] = useState<Date | null>(null);
    const [showDatePicker, setShowDatePicker] = useState(false);

    const { data, loading, error } = useRevenueChart({
        period,
        startDate,
        endDate,
    });

    const handlePeriodChange = (newPeriod: ChartPeriod) => {
        setPeriod(newPeriod);
        if (newPeriod !== "custom") {
            setShowDatePicker(false);
            setStartDate(null);
            setEndDate(null);
        } else {
            setShowDatePicker(true);
        }
    };

    const handleApplyCustomRange = () => {
        if (startDate && endDate) {
            // The hook will automatically refetch when dates change
            setShowDatePicker(false);
        }
    };

    const formatDateForInput = (date: Date | null) => {
        if (!date) return "";
        return date.toISOString().split("T")[0];
    };

    const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setStartDate(e.target.value ? new Date(e.target.value) : null);
    };

    const handleEndDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setEndDate(e.target.value ? new Date(e.target.value) : null);
    };

    // Calculate total revenue and orders for the period
    const totalRevenue = data.reduce((sum, item) => sum + item.revenue, 0);
    const totalOrders = data.reduce((sum, item) => sum + item.orders, 0);
    const avgRevenue = data.length > 0 ? totalRevenue / data.length : 0;

    return (
        <div className="bg-white p-6 rounded-lg shadow-sm">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h2 className="text-xl font-bold text-gray-900">
                        Revenue Overview
                    </h2>
                    <p className="text-sm text-gray-500 mt-1">
                        Track your revenue and order trends
                    </p>
                </div>

                {/* Period Selector */}
                <div className="flex gap-2">
                    <button
                        onClick={() => handlePeriodChange("weekly")}
                        className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                            period === "weekly"
                                ? "bg-blue-600 text-white"
                                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                        }`}
                    >
                        Weekly
                    </button>
                    <button
                        onClick={() => handlePeriodChange("monthly")}
                        className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                            period === "monthly"
                                ? "bg-blue-600 text-white"
                                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                        }`}
                    >
                        Monthly
                    </button>
                    <button
                        onClick={() => handlePeriodChange("custom")}
                        className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                            period === "custom"
                                ? "bg-blue-600 text-white"
                                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                        }`}
                    >
                        <Calendar size={16} />
                        Custom
                    </button>
                </div>
            </div>

            {/* Custom Date Range Picker */}
            {showDatePicker && (
                <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex items-end gap-4">
                        <div className="flex-1">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Start Date
                            </label>
                            <input
                                type="date"
                                value={formatDateForInput(startDate)}
                                onChange={handleStartDateChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>
                        <div className="flex-1">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                End Date
                            </label>
                            <input
                                type="date"
                                value={formatDateForInput(endDate)}
                                onChange={handleEndDateChange}
                                min={formatDateForInput(startDate)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>
                        <button
                            onClick={handleApplyCustomRange}
                            disabled={!startDate || !endDate}
                            className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                        >
                            Apply
                        </button>
                    </div>
                    {startDate && endDate && (
                        <p className="text-sm text-gray-600 mt-2">
                            Showing data from {startDate.toLocaleDateString()}{" "}
                            to {endDate.toLocaleDateString()}
                        </p>
                    )}
                </div>
            )}

            {/* Summary Stats */}
            {!loading && data.length > 0 && (
                <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="bg-blue-50 p-4 rounded-lg">
                        <p className="text-sm text-blue-600 font-medium">
                            Total Revenue
                        </p>
                        <p className="text-2xl font-bold text-blue-900 mt-1">
                            {formatCurrency(totalRevenue)}
                        </p>
                    </div>
                    <div className="bg-orange-50 p-4 rounded-lg">
                        <p className="text-sm text-orange-600 font-medium">
                            Total Orders
                        </p>
                        <p className="text-2xl font-bold text-orange-900 mt-1">
                            {totalOrders}
                        </p>
                    </div>
                    <div className="bg-green-50 p-4 rounded-lg">
                        <p className="text-sm text-green-600 font-medium">
                            Avg Daily Revenue
                        </p>
                        <p className="text-2xl font-bold text-green-900 mt-1">
                            {formatCurrency(avgRevenue)}
                        </p>
                    </div>
                </div>
            )}

            {/* Chart */}
            {loading ? (
                <div className="flex items-center justify-center h-80">
                    <div className="text-gray-500">Loading chart data...</div>
                </div>
            ) : error ? (
                <div className="flex items-center justify-center h-80">
                    <div className="text-red-500">{error}</div>
                </div>
            ) : data.length === 0 ? (
                <div className="flex items-center justify-center h-80">
                    <div className="text-gray-500">
                        {period === "custom"
                            ? "Please select a date range to view data"
                            : "No data available for this period"}
                    </div>
                </div>
            ) : (
                <ResponsiveContainer width="100%" height={400}>
                    <LineChart
                        data={data}
                        margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                    >
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis
                            dataKey="date"
                            stroke="#6b7280"
                            style={{ fontSize: "12px" }}
                        />
                        <YAxis
                            stroke="#6b7280"
                            style={{ fontSize: "12px" }}
                            tickFormatter={(value: number) =>
                                `₹${(value / 1000).toFixed(0)}k`
                            }
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend
                            wrapperStyle={{ paddingTop: "20px" }}
                            iconType="line"
                        />
                        <Line
                            type="monotone"
                            dataKey="revenue"
                            stroke="#2563eb"
                            strokeWidth={3}
                            dot={{ fill: "#2563eb", r: 4 }}
                            activeDot={{ r: 6 }}
                            name="Revenue (₹)"
                        />
                        <Line
                            type="monotone"
                            dataKey="orders"
                            stroke="#f97316"
                            strokeWidth={3}
                            dot={{ fill: "#f97316", r: 4 }}
                            activeDot={{ r: 6 }}
                            name="Orders"
                            yAxisId={0}
                        />
                    </LineChart>
                </ResponsiveContainer>
            )}
        </div>
    );
}
