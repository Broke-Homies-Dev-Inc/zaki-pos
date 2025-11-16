import { createContext, useMemo } from "react";
import type { ReactNode } from "react";
import { useRestaurantSettings } from "../hooks/useRestaurantSettings";
import type { Database } from "../lib/database.types";

type RestaurantSettings =
    Database["public"]["Tables"]["restaurant_settings"]["Row"];
type RestaurantSettingsInsert =
    Database["public"]["Tables"]["restaurant_settings"]["Insert"];

interface RestaurantSettingsContextType {
    settings: RestaurantSettings;
    loading: boolean;
    error: string | null;
    saveSettings: (
        settingsData: RestaurantSettingsInsert
    ) => Promise<{
        success: boolean;
        data?: RestaurantSettings;
        error?: string;
    }>;
    refetch: () => Promise<void>;
}

export const RestaurantSettingsContext = createContext<
    RestaurantSettingsContextType | undefined
>(undefined);

export function RestaurantSettingsProvider({
    children,
}: {
    children: ReactNode;
}) {
    const restaurantSettings = useRestaurantSettings();

    const contextValue = useMemo(() => restaurantSettings, [
        restaurantSettings.settings,
        restaurantSettings.loading,
        restaurantSettings.error,
        restaurantSettings.refetch,
        restaurantSettings.saveSettings,
    ]);

    return (
        <RestaurantSettingsContext.Provider value={contextValue}>
            {children}
        </RestaurantSettingsContext.Provider>
    );
}
