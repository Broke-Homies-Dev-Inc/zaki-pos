// src/pages/Settings.tsx
import { useState } from "react";
import CustomizeTables from "./settings/CustomizeTables";
import { RestaurantSettings } from "./settings/RestaurantSettings";
import { LoyaltySettings } from "./settings/LoyaltySettings";
import { PrintSettings } from "./settings/PrintSettings";
import Waiters from "./settings/Waiter";
import OfferSettings from "./settings/Offer"; // <-- YOU WILL CREATE THIS FILE
import { ChevronRight } from "lucide-react";

type SettingsView =
  | "main"
  | "customize_tables"
  | "restaurant_settings"
  | "loyalty_settings"
  | "print_settings"
  | "waiter"
  | "offer";  // <-- NEW

export function Settings() {
  const [activeView, setActiveView] = useState<SettingsView>("main");

  const MainSettingsView = () => (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Settings</h1>
      <div className="bg-white rounded-lg shadow-sm">

        {/* Restaurant */}
        <button
          onClick={() => setActiveView("restaurant_settings")}
          className="flex items-center justify-between w-full p-6 text-left border-b hover:bg-gray-50"
        >
          <div>
            <p className="text-lg font-semibold text-gray-800">Restaurant Settings</p>
            <p className="text-sm text-gray-500">Configure restaurant details.</p>
          </div>
          <ChevronRight size={20} className="text-gray-400" />
        </button>

        {/* Loyalty */}
        <button
          onClick={() => setActiveView("loyalty_settings")}
          className="flex items-center justify-between w-full p-6 text-left border-b hover:bg-gray-50"
        >
          <div>
            <p className="text-lg font-semibold text-gray-800">Loyalty Points</p>
            <p className="text-sm text-gray-500">Set up the points system.</p>
          </div>
          <ChevronRight size={20} className="text-gray-400" />
        </button>

        {/* Print */}
        <button
          onClick={() => setActiveView("print_settings")}
          className="flex items-center justify-between w-full p-6 text-left border-b hover:bg-gray-50"
        >
          <div>
            <p className="text-lg font-semibold text-gray-800">Print Settings</p>
            <p className="text-sm text-gray-500">Configure bill printing.</p>
          </div>
          <ChevronRight size={20} className="text-gray-400" />
        </button>

        {/* Customize Tables */}
        <button
          onClick={() => setActiveView("customize_tables")}
          className="flex items-center justify-between w-full p-6 text-left border-b hover:bg-gray-50"
        >
          <div>
            <p className="text-lg font-semibold text-gray-800">Customize Tables</p>
            <p className="text-sm text-gray-500">Manage restaurant tables.</p>
          </div>
          <ChevronRight size={20} className="text-gray-400" />
        </button>

        {/* Waiters */}
        <button
          onClick={() => setActiveView("waiter")}
          className="flex items-center justify-between w-full p-6 text-left border-b hover:bg-gray-50"
        >
          <div>
            <p className="text-lg font-semibold text-gray-800">Employee Management</p>
            <p className="text-sm text-gray-500">Manage your employees.</p>
          </div>
          <ChevronRight size={20} className="text-gray-400" />
        </button>

        {/* OFFER MANAGEMENT (NEW VIEW) */}
        <button
          onClick={() => setActiveView("offer")}
          className="flex items-center justify-between w-full p-6 text-left hover:bg-gray-50"
        >
          <div>
            <p className="text-lg font-semibold text-gray-800">Offer Management</p>
            <p className="text-sm text-gray-500">Manage offers and discounts.</p>
          </div>
          <ChevronRight size={20} className="text-gray-400" />
        </button>

      </div>
    </div>
  );

  // VIEW SWITCHING (DON'T TOUCH ANY LOGIC)
  if (activeView === "restaurant_settings")
    return <RestaurantSettings onBack={() => setActiveView("main")} />;

  if (activeView === "loyalty_settings")
    return <LoyaltySettings onBack={() => setActiveView("main")} />;

  if (activeView === "print_settings")
    return <PrintSettings onBack={() => setActiveView("main")} />;

  if (activeView === "customize_tables")
    return <CustomizeTables onBack={() => setActiveView("main")} />;

  if (activeView === "waiter")
    return <Waiters onBack={() => setActiveView("main")} />;

  if (activeView === "offer")
    return <OfferSettings onBack={() => setActiveView("main")} />;  // <-- NEW

  return <MainSettingsView />;
}

export default Settings;
