import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout } from "./components/Layout";
import { Dashboard } from "./pages/Dashboard";
import { Orders } from "./pages/Orders";
import { Menu } from "./pages/Menu";
import { Inventory } from "./pages/Inventory";
import { Billing } from "./pages/Billing";
import Reports from "./pages/Reports";
import { Settings } from "./pages/Settings";
import { Customers } from "./pages/Customers";
import { Ingredients } from "./pages/Ingredients";
import { RestaurantSettingsProvider } from "./contexts/RestaurantSettingsContext";
import "react-datepicker/dist/react-datepicker.css";

function App() {
    return (
        <RestaurantSettingsProvider>
            <BrowserRouter>
                <Routes>
                    <Route path="/" element={<Layout />}>
                        <Route index element={<Dashboard />} />
                        <Route path="orders" element={<Orders />} />
                        <Route path="menu" element={<Menu />} />
                        <Route path="inventory" element={<Inventory />} />
                        <Route path="ingredients" element={<Ingredients />} />
                        <Route path="billing" element={<Billing />} />
                        <Route path="reports" element={<Reports />} />
                        <Route path="customers" element={<Customers />} />
                        <Route path="settings" element={<Settings />} />
                    </Route>
                </Routes>
            </BrowserRouter>
        </RestaurantSettingsProvider>
    );
}

export default App;
