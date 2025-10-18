import { createContext, useContext } from "react";
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

const RestaurantSettingsContext = createContext<
    RestaurantSettingsContextType | undefined
>(undefined);

export function RestaurantSettingsProvider({
    children,
}: {
    children: ReactNode;
}) {
    const restaurantSettings = useRestaurantSettings();

    return (
        <RestaurantSettingsContext.Provider value={restaurantSettings}>
            {children}
        </RestaurantSettingsContext.Provider>
    );
}

export function useRestaurantSettingsContext() {
    const context = useContext(RestaurantSettingsContext);
    if (context === undefined) {
        throw new Error(
            "useRestaurantSettingsContext must be used within a RestaurantSettingsProvider"
        );
    }
    return context;
}
