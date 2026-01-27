// src/pages/Settings.tsx
import { useState } from "react";
import CustomizeTables from "./settings/CustomizeTables";
import { RestaurantSettings } from "./settings/RestaurantSettings";
import { LoyaltySettings } from "./settings/LoyaltySettings";
import { PrintSettings } from "./settings/PrintSettings";
import { TimerSettings } from "./settings/TimerSettings";
import { OrderExpirySettings } from "./settings/OrderExpirySettings";
import Waiters from "./settings/Waiter";
import OfferSettings from "./settings/Offer";
import { DeliveryPartnerSettings } from "./settings/DeliveryPartnerSettings";
import { KotDeviceSettings } from "./settings/KotDeviceSettings";
import { KitchenStationSettings } from "./settings/KitchenStationSettings";
import { QuickNotesSettings } from "./settings/QuickNotesSettings";
import { UserManagement } from "./settings/UserManagement";
import { RoleManagement } from "./settings/RoleManagement";
import { ChevronRight } from "lucide-react";

type SettingsView =
  | "main"
  | "customize_tables"
  | "restaurant_settings"
  | "loyalty_settings"
  | "print_settings"
  | "timer_settings"
  | "order_expiry"
  | "waiter"
  | "offer"
  | "delivery_partners"
  | "kot_devices"
  | "kitchen_stations"
  | "quick_notes"
  | "user_management"
  | "role_management";

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
          className="flex items-center justify-between w-full p-6 text-left border-b hover:bg-gray-50"
        >
          <div>
            <p className="text-lg font-semibold text-gray-800">Offer Management</p>
            <p className="text-sm text-gray-500">Manage offers and discounts.</p>
          </div>
          <ChevronRight size={20} className="text-gray-400" />
        </button>

        {/* TABLE TIMER SETTINGS */}
        <button
          onClick={() => setActiveView("timer_settings")}
          className="flex items-center justify-between w-full p-6 text-left border-b hover:bg-gray-50"
        >
          <div>
            <p className="text-lg font-semibold text-gray-800">Table Timer Settings</p>
            <p className="text-sm text-gray-500">Configure timer color thresholds.</p>
          </div>
          <ChevronRight size={20} className="text-gray-400" />
        </button>

        {/* ORDER EXPIRY SETTINGS */}
        <button
          onClick={() => setActiveView("order_expiry")}
          className="flex items-center justify-between w-full p-6 text-left border-b hover:bg-gray-50"
        >
          <div>
            <p className="text-lg font-semibold text-gray-800">Order Expiry Settings</p>
            <p className="text-sm text-gray-500">Configure automatic order expiration (testing).</p>
          </div>
          <ChevronRight size={20} className="text-gray-400" />
        </button>

        {/* DELIVERY PARTNERS */}
        <button
          onClick={() => setActiveView("delivery_partners")}
          className="flex items-center justify-between w-full p-6 text-left border-b hover:bg-gray-50"
        >
          <div>
            <p className="text-lg font-semibold text-gray-800">Delivery Partners</p>
            <p className="text-sm text-gray-500">Manage online delivery partners.</p>
          </div>
          <ChevronRight size={20} className="text-gray-400" />
        </button>

        {/* KOT DEVICES */}
        <button
          onClick={() => setActiveView("kot_devices")}
          className="flex items-center justify-between w-full p-6 text-left border-b hover:bg-gray-50"
        >
          <div>
            <p className="text-lg font-semibold text-gray-800">KOT Devices</p>
            <p className="text-sm text-gray-500">Configure kitchen ticket printers.</p>
          </div>
          <ChevronRight size={20} className="text-gray-400" />
        </button>

        {/* KITCHEN STATIONS */}
        <button
          onClick={() => setActiveView("kitchen_stations")}
          className="flex items-center justify-between w-full p-6 text-left border-b hover:bg-gray-50"
        >
          <div>
            <p className="text-lg font-semibold text-gray-800">Kitchen Stations</p>
            <p className="text-sm text-gray-500">Manage kitchen work areas and device mappings.</p>
          </div>
          <ChevronRight size={20} className="text-gray-400" />
        </button>

        {/* GLOBAL QUICK NOTES */}
        <button
          onClick={() => setActiveView("quick_notes")}
          className="flex items-center justify-between w-full p-6 text-left border-b hover:bg-gray-50"
        >
          <div>
            <p className="text-lg font-semibold text-gray-800">Global Quick Notes</p>
            <p className="text-sm text-gray-500">Manage common order notes for all menu items.</p>
          </div>
          <ChevronRight size={20} className="text-gray-400" />
        </button>

        {/* USER MANAGEMENT */}
        <button
          onClick={() => setActiveView("user_management")}
          className="flex items-center justify-between w-full p-6 text-left border-b hover:bg-gray-50"
        >
          <div>
            <p className="text-lg font-semibold text-gray-800">User Management</p>
            <p className="text-sm text-gray-500">Manage user accounts and access.</p>
          </div>
          <ChevronRight size={20} className="text-gray-400" />
        </button>

        {/* ROLE MANAGEMENT */}
        <button
          onClick={() => setActiveView("role_management")}
          className="flex items-center justify-between w-full p-6 text-left hover:bg-gray-50"
        >
          <div>
            <p className="text-lg font-semibold text-gray-800">Role Management</p>
            <p className="text-sm text-gray-500">Configure roles and tab permissions.</p>
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

  if (activeView === "timer_settings")
    return <TimerSettings onBack={() => setActiveView("main")} />;

  if (activeView === "order_expiry")
    return <OrderExpirySettings onBack={() => setActiveView("main")} />;

  if (activeView === "delivery_partners")
    return <DeliveryPartnerSettings onBack={() => setActiveView("main")} />;

  if (activeView === "kot_devices")
    return <KotDeviceSettings onBack={() => setActiveView("main")} />;

  if (activeView === "kitchen_stations")
    return <KitchenStationSettings onBack={() => setActiveView("main")} />;

  if (activeView === "quick_notes")
    return <QuickNotesSettings onBack={() => setActiveView("main")} />;

  if (activeView === "user_management")
    return <UserManagement onBack={() => setActiveView("main")} />;

  if (activeView === "role_management")
    return <RoleManagement onBack={() => setActiveView("main")} />;

  return <MainSettingsView />;
}

export default Settings;
