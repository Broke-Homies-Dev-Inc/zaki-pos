import { useContext } from "react";
import { RestaurantSettingsContext } from "./RestaurantSettingsContext";

export function useRestaurantSettingsContext() {
    const context = useContext(RestaurantSettingsContext);
    if (context === undefined) {
        throw new Error(
            "useRestaurantSettingsContext must be used within a RestaurantSettingsProvider"
        );
    }
    return context;
}
