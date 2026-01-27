import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
    Home,
    ShoppingBag,
    Package,
    FileText,
    Receipt,
    Settings,
    Users,
    BarChart2,
    ShoppingBasket,
    LogOut,
    // HandPlatter,
} from "lucide-react";
import { useRestaurantSettingsContext } from "../contexts/useRestaurantSettingsContext";
import { NotificationBell } from "./NotificationBell";
import { useAuth } from "../contexts/AuthContext";

const navigation = [
    { name: "Dashboard", href: "/", icon: Home, permKey: "tab_dashboard" },
    { name: "Orders", href: "/orders", icon: ShoppingBag, permKey: "tab_orders" },
    { name: "Menu", href: "/menu", icon: Receipt, permKey: "tab_menu" },
    { name: "Inventory", href: "/inventory", icon: Package, permKey: "tab_inventory" },
    { name: "Ingredients", href: "/ingredients", icon: ShoppingBasket, permKey: "tab_ingredients" },
    // { name: "Waiters", href: "/waiters", icon: HandPlatter, permKey: "tab_waiters" },
    { name: "Billing", href: "/billing", icon: FileText, permKey: "tab_billing" },
    { name: "Reports", href: "/reports", icon: BarChart2, permKey: "tab_reports" },
    { name: "Customers", href: "/customers", icon: Users, permKey: "tab_customers" },
    { name: "Settings", href: "/settings", icon: Settings, permKey: "tab_settings" },
];

export function Layout() {
    const location = useLocation();
    const navigate = useNavigate();
    const { settings, loading } = useRestaurantSettingsContext();
    const { user, logout, hasPermission } = useAuth();

    // Filter navigation based on user's role permissions
    const visibleNavigation = navigation.filter(item => {
        // Extract tab name from permKey (e.g., "tab_dashboard" -> "dashboard")
        const tabName = item.permKey.replace("tab_", "");
        return hasPermission(tabName);
    });

    const handleLogout = () => {
        logout();
        navigate("/login");
    };

    return (
        <div className="h-screen bg-gray-50 flex overflow-hidden">
            <aside className="w-64 bg-white border-r border-gray-200 fixed h-full flex flex-col">
                <div className="p-6 border-b border-gray-200 flex-shrink-0">
                    <h1 className="text-2xl font-bold text-gray-900">
                        {loading
                            ? "POS System"
                            : settings?.restaurant_name || "POS System"}
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">Point of Sale</p>
                </div>

                <nav className="p-4 space-y-1 overflow-y-auto flex-1 custom-scrollbar">
                    {visibleNavigation.map((item) => {
                        const isActive = location.pathname === item.href;
                        const Icon = item.icon;

                        return (
                            <Link
                                key={item.name}
                                to={item.href}
                                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive
                                    ? "bg-blue-50 text-blue-600 font-medium"
                                    : "text-gray-700 hover:bg-gray-50"
                                    }`}
                            >
                                <Icon className="w-5 h-5" />
                                <span>{item.name}</span>
                            </Link>
                        );
                    })}
                </nav>

                {/* User info and logout */}
                <div className="p-4 border-t border-gray-200 flex-shrink-0">
                    <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">
                                {user?.name || "User"}
                            </p>
                            <p className="text-xs text-gray-500 truncate">
                                {user?.role?.name || "No role"}
                            </p>
                        </div>
                        <button
                            onClick={handleLogout}
                            className="ml-2 p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Logout"
                        >
                            <LogOut className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </aside>

            <main className="ml-64 flex-1 h-screen overflow-y-auto custom-scrollbar flex flex-col">
                {/* Top Header Bar with Notifications */}
                <div className="sticky top-0 z-30 bg-white border-b border-gray-200 px-6 py-3 flex justify-end items-center shadow-sm">
                    <NotificationBell />
                </div>

                <div className="p-6 flex-1">
                    <Outlet />
                </div>
            </main>
        </div>
    );
}

export default Layout;
