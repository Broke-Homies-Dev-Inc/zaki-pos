import { Link, Outlet, useLocation } from "react-router-dom";
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
    // HandPlatter,
} from "lucide-react";
import { useRestaurantSettingsContext } from "../contexts/useRestaurantSettingsContext";

const navigation = [
    { name: "Dashboard", href: "/", icon: Home },
    { name: "Orders", href: "/orders", icon: ShoppingBag },
    { name: "Menu", href: "/menu", icon: Receipt },
    { name: "Inventory", href: "/inventory", icon: Package },
    { name: "Ingredients", href: "/ingredients", icon: ShoppingBasket },
    // { name: "Waiters", href: "/waiters", icon: HandPlatter },
    { name: "Billing", href: "/billing", icon: FileText },
    { name: "Reports", href: "/reports", icon: BarChart2 },
    { name: "Customers", href: "/customers", icon: Users },
    { name: "Settings", href: "/settings", icon: Settings },
];

export function Layout() {
    const location = useLocation();
    const { settings, loading } = useRestaurantSettingsContext();

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
                    {navigation.map((item) => {
                        const isActive = location.pathname === item.href;
                        const Icon = item.icon;

                        return (
                            <Link
                                key={item.name}
                                to={item.href}
                                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                                    isActive
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
            </aside>

            <main className="ml-64 flex-1 h-screen overflow-y-auto custom-scrollbar">
                <div className="p-6">
                    <Outlet />
                </div>
            </main>
        </div>
    );
}

export default Layout;
