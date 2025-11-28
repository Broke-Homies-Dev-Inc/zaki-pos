import { useState } from "react";
import CustomizeTables from "./settings/CustomizeTables";
import { RestaurantSettings } from "./settings/RestaurantSettings";
import { LoyaltySettings } from "./settings/LoyaltySettings";
import { PrintSettings } from "./settings/PrintSettings";
import { ChevronRight } from "lucide-react";
import Waiters from "./settings/Waiter";

type SettingsView =
  | "main"
  | "customize_tables"
  | "restaurant_settings"
  | "loyalty_settings"
  | "print_settings"
  | "waiter";

export function Settings() {
  const [activeView, setActiveView] = useState<SettingsView>("main");

  const MainSettingsView = () => (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Settings</h1>
      <div className="bg-white rounded-lg shadow-sm">
        <button
          onClick={() => setActiveView("restaurant_settings")}
          className="flex items-center justify-between w-full p-6 text-left border-b hover:bg-gray-50"
        >
          <div>
            <p className="text-lg font-semibold text-gray-800">
              Restaurant Settings
            </p>
            <p className="text-sm text-gray-500">
              Configure restaurant name, address, phone, registration number,
              and tax rate.
            </p>
          </div>
          <ChevronRight size={20} className="text-gray-400" />
        </button>
        <button
          onClick={() => setActiveView("loyalty_settings")}
          className="flex items-center justify-between w-full p-6 text-left border-b hover:bg-gray-50"
        >
          <div>
            <p className="text-lg font-semibold text-gray-800">
              Loyalty Points
            </p>
            <p className="text-sm text-gray-500">
              Configure loyalty points system and rewards for customers.
            </p>
          </div>
          <ChevronRight size={20} className="text-gray-400" />
        </button>
        <button
          onClick={() => setActiveView("print_settings")}
          className="flex items-center justify-between w-full p-6 text-left border-b hover:bg-gray-50"
        >
          <div>
            <p className="text-lg font-semibold text-gray-800">
              Print Settings
            </p>
            <p className="text-sm text-gray-500">
              Configure print preview and PDF saving options for bills.
            </p>
          </div>
          <ChevronRight size={20} className="text-gray-400" />
        </button>
        <button
          onClick={() => setActiveView("customize_tables")}
          className="flex items-center justify-between w-full p-6 text-left border-b hover:bg-gray-50"
        >
          <div>
            <p className="text-lg font-semibold text-gray-800">
              Customize Tables
            </p>
            <p className="text-sm text-gray-500">
              Manage floors, sections, and tables for your restaurant.
            </p>
          </div>
          <ChevronRight size={20} className="text-gray-400" />
        </button>
        <button
          onClick={() => setActiveView("waiter")}
          className="flex items-center justify-between w-full p-6 text-left border-b hover:bg-gray-50"
        >
          <div>
            <p className="text-lg font-semibold text-gray-800">
              Employee Management
            </p>
            <p className="text-sm text-gray-500">
              Manage Employees of the restaurant.
            </p>
          </div>
          <ChevronRight size={20} className="text-gray-400" />
        </button>
      </div>
    </div>
  );

  if (activeView === "restaurant_settings") {
    return <RestaurantSettings onBack={() => setActiveView("main")} />;
  }

  if (activeView === "loyalty_settings") {
    return <LoyaltySettings onBack={() => setActiveView("main")} />;
  }

  if (activeView === "print_settings") {
    return <PrintSettings onBack={() => setActiveView("main")} />;
  }

  if (activeView === "customize_tables") {
    return <CustomizeTables onBack={() => setActiveView("main")} />;
  }

  if (activeView === "waiter") {
    return <Waiters onBack={() => setActiveView("main")} />;
  }

  return <MainSettingsView />;
}
