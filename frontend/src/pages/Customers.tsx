import { useState, useEffect } from "react";
import { Users, Phone, Calendar, Award, TrendingUp } from "lucide-react";
import api from "../lib/api";

interface Customer {
    id: number;
    name: string;
    mobile_number: string;
    loyalty_points: number;
    created_at: string;
    total_orders?: number;
    total_spent?: number;
}

interface LoyaltyTransaction {
    id: number;
    points_earned: number;
    points_redeemed: number;
    transaction_type: string;
    description: string;
    order_amount: string;
    created_at: string;
}

export function Customers() {
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
        null
    );
    const [transactions, setTransactions] = useState<LoyaltyTransaction[]>([]);
    const [showDetails, setShowDetails] = useState(false);

    useEffect(() => {
        fetchCustomers();
    }, []);

    const fetchCustomers = async () => {
        try {
            setLoading(true);
            const response = await api.get("/customers");
            setCustomers(response.data);
        } catch (error) {
            console.error("Error fetching customers:", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchCustomerDetails = async (customerId: number) => {
        try {
            const response = await api.get(`/customers/${customerId}/loyalty`);
            setTransactions(response.data.transactions || []);
        } catch (error) {
            console.error("Error fetching customer details:", error);
            setTransactions([]);
        }
    };

    const handleCustomerClick = async (customer: Customer) => {
        setSelectedCustomer(customer);
        setShowDetails(true);
        await fetchCustomerDetails(customer.id);
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString("en-IN", {
            year: "numeric",
            month: "short",
            day: "numeric",
        });
    };

    const formatDateTime = (dateString: string) => {
        return new Date(dateString).toLocaleString("en-IN", {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-gray-500">Loading customers...</div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">
                        Customers
                    </h1>
                    <p className="text-gray-500 mt-1">
                        Manage your customer database and loyalty points
                    </p>
                </div>
                <div className="text-right">
                    <div className="text-sm text-gray-500">Total Customers</div>
                    <div className="text-3xl font-bold text-blue-600">
                        {customers.length}
                    </div>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white rounded-lg shadow p-6">
                    <div className="flex items-center gap-4">
                        <div className="bg-blue-100 p-3 rounded-lg">
                            <Users className="w-6 h-6 text-blue-600" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">
                                Total Customers
                            </p>
                            <p className="text-2xl font-bold text-gray-900">
                                {customers.length}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-lg shadow p-6">
                    <div className="flex items-center gap-4">
                        <div className="bg-green-100 p-3 rounded-lg">
                            <Award className="w-6 h-6 text-green-600" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">
                                Total Loyalty Points
                            </p>
                            <p className="text-2xl font-bold text-gray-900">
                                {customers.reduce(
                                    (sum, c) => sum + (c.loyalty_points || 0),
                                    0
                                )}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-lg shadow p-6">
                    <div className="flex items-center gap-4">
                        <div className="bg-purple-100 p-3 rounded-lg">
                            <TrendingUp className="w-6 h-6 text-purple-600" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">
                                With Loyalty Points
                            </p>
                            <p className="text-2xl font-bold text-gray-900">
                                {
                                    customers.filter(
                                        (c) => (c.loyalty_points || 0) > 0
                                    ).length
                                }
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Customers Table */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Customer
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Phone Number
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Loyalty Points
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Member Since
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Actions
                            </th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {customers.length === 0 ? (
                            <tr>
                                <td
                                    colSpan={5}
                                    className="px-6 py-8 text-center text-gray-500"
                                >
                                    <Users className="w-12 h-12 mx-auto text-gray-300 mb-2" />
                                    <p>No customers found</p>
                                    <p className="text-sm text-gray-400 mt-1">
                                        Customers will appear here when they
                                        place orders
                                    </p>
                                </td>
                            </tr>
                        ) : (
                            customers.map((customer) => (
                                <tr
                                    key={customer.id}
                                    className="hover:bg-gray-50 cursor-pointer"
                                    onClick={() =>
                                        handleCustomerClick(customer)
                                    }
                                >
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center">
                                            <div className="flex-shrink-0 h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center">
                                                <span className="text-blue-600 font-semibold">
                                                    {customer.name
                                                        .charAt(0)
                                                        .toUpperCase()}
                                                </span>
                                            </div>
                                            <div className="ml-4">
                                                <div className="text-sm font-medium text-gray-900">
                                                    {customer.name}
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center text-sm text-gray-900">
                                            <Phone className="w-4 h-4 mr-2 text-gray-400" />
                                            {customer.mobile_number}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center">
                                            <Award className="w-4 h-4 mr-2 text-yellow-500" />
                                            <span className="text-sm font-semibold text-gray-900">
                                                {customer.loyalty_points || 0}
                                            </span>
                                            <span className="text-xs text-gray-500 ml-1">
                                                points
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        <div className="flex items-center">
                                            <Calendar className="w-4 h-4 mr-2 text-gray-400" />
                                            {formatDate(customer.created_at)}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                                        <button className="text-blue-600 hover:text-blue-800 font-medium">
                                            View Details
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Customer Details Modal */}
            {showDetails && selectedCustomer && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
                        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
                            <div>
                                <h2 className="text-2xl font-bold text-gray-900">
                                    {selectedCustomer.name}
                                </h2>
                                <p className="text-sm text-gray-500 mt-1">
                                    Customer Details & Loyalty History
                                </p>
                            </div>
                            <button
                                onClick={() => setShowDetails(false)}
                                className="text-gray-400 hover:text-gray-600"
                            >
                                <span className="text-2xl">×</span>
                            </button>
                        </div>

                        <div className="p-6 space-y-6">
                            {/* Customer Info */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-gray-50 p-4 rounded-lg">
                                    <div className="text-sm text-gray-500 mb-1">
                                        Phone Number
                                    </div>
                                    <div className="text-lg font-semibold text-gray-900 flex items-center">
                                        <Phone className="w-4 h-4 mr-2" />
                                        {selectedCustomer.mobile_number}
                                    </div>
                                </div>
                                <div className="bg-gray-50 p-4 rounded-lg">
                                    <div className="text-sm text-gray-500 mb-1">
                                        Member Since
                                    </div>
                                    <div className="text-lg font-semibold text-gray-900 flex items-center">
                                        <Calendar className="w-4 h-4 mr-2" />
                                        {formatDate(
                                            selectedCustomer.created_at
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Loyalty Points */}
                            <div className="bg-gradient-to-r from-blue-500 to-purple-600 text-white p-6 rounded-lg">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <div className="text-sm opacity-90 mb-1">
                                            Total Loyalty Points
                                        </div>
                                        <div className="text-4xl font-bold">
                                            {selectedCustomer.loyalty_points ||
                                                0}
                                        </div>
                                    </div>
                                    <Award className="w-16 h-16 opacity-50" />
                                </div>
                            </div>

                            {/* Transaction History */}
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                                    Loyalty Transaction History
                                </h3>
                                {transactions.length === 0 ? (
                                    <div className="text-center py-8 text-gray-500">
                                        <Award className="w-12 h-12 mx-auto text-gray-300 mb-2" />
                                        <p>No transactions yet</p>
                                        <p className="text-sm text-gray-400 mt-1">
                                            Points will appear here when orders
                                            are completed
                                        </p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {transactions.map((transaction) => (
                                            <div
                                                key={transaction.id}
                                                className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                                            >
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-3">
                                                        <div
                                                            className={`p-2 rounded-lg ${
                                                                transaction.transaction_type ===
                                                                "earned"
                                                                    ? "bg-green-100"
                                                                    : "bg-red-100"
                                                            }`}
                                                        >
                                                            <Award
                                                                className={`w-5 h-5 ${
                                                                    transaction.transaction_type ===
                                                                    "earned"
                                                                        ? "text-green-600"
                                                                        : "text-red-600"
                                                                }`}
                                                            />
                                                        </div>
                                                        <div>
                                                            <div className="font-medium text-gray-900">
                                                                {transaction.transaction_type ===
                                                                "earned"
                                                                    ? `+${transaction.points_earned}`
                                                                    : `-${transaction.points_redeemed}`}{" "}
                                                                points
                                                            </div>
                                                            <div className="text-sm text-gray-500">
                                                                {
                                                                    transaction.description
                                                                }
                                                            </div>
                                                            <div className="text-xs text-gray-400 mt-1">
                                                                {formatDateTime(
                                                                    transaction.created_at
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    {transaction.order_amount && (
                                                        <div className="text-right">
                                                            <div className="text-sm text-gray-500">
                                                                Order Amount
                                                            </div>
                                                            <div className="font-semibold text-gray-900">
                                                                ₹
                                                                {parseFloat(
                                                                    transaction.order_amount
                                                                ).toFixed(2)}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="sticky bottom-0 bg-gray-50 px-6 py-4 border-t border-gray-200">
                            <button
                                onClick={() => setShowDetails(false)}
                                className="w-full px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
