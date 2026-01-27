// src/contexts/AuthContext.tsx
import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import api from "../lib/api";

// Types
export interface Role {
    id: string;
    name: string;
    tab_dashboard: boolean;
    tab_orders: boolean;
    tab_menu: boolean;
    tab_inventory: boolean;
    tab_ingredients: boolean;
    tab_billing: boolean;
    tab_reports: boolean;
    tab_customers: boolean;
    tab_settings: boolean;
}

export interface User {
    id: string;
    username: string;
    name: string;
    role: Role | null;
}

interface AuthContextType {
    user: User | null;
    loading: boolean;
    isAuthenticated: boolean;
    login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
    logout: () => void;
    hasPermission: (tabName: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_STORAGE_KEY = "pos_auth_user";

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    // On mount, check for stored user
    useEffect(() => {
        const storedUser = localStorage.getItem(AUTH_STORAGE_KEY);
        if (storedUser) {
            try {
                const parsed = JSON.parse(storedUser);
                setUser(parsed);
            } catch (e) {
                localStorage.removeItem(AUTH_STORAGE_KEY);
            }
        }
        setLoading(false);
    }, []);

    const login = useCallback(async (username: string, password: string) => {
        console.log("🔐 [AuthContext] Login attempt started");
        console.log("🔐 [AuthContext] Username:", username);

        try {
            console.log("🔐 [AuthContext] Making API request to /auth/login...");
            const response = await api.post<{ user: User }>("/auth/login", {
                username,
                password,
            });

            console.log("🔐 [AuthContext] API Response status:", response.status);
            console.log("🔐 [AuthContext] API Response data:", JSON.stringify(response.data, null, 2));

            if (!response.data || !response.data.user) {
                console.error("🔐 [AuthContext] ❌ Invalid response structure - missing user data");
                return { success: false, error: "Invalid response from server" };
            }

            console.log("🔐 [AuthContext] ✅ Setting user in state:", response.data.user.username);
            setUser(response.data.user);

            console.log("🔐 [AuthContext] Saving to localStorage...");
            localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(response.data.user));

            console.log("🔐 [AuthContext] ✅ Login successful!");
            return { success: true };
        } catch (error: any) {
            console.error("🔐 [AuthContext] ❌ Login error:", error);
            console.error("🔐 [AuthContext] Error response:", error?.response?.data);
            console.error("🔐 [AuthContext] Error status:", error?.response?.status);
            console.error("🔐 [AuthContext] Error message:", error?.message);

            const message = error?.response?.data?.message || error?.message || "Login failed";
            return { success: false, error: message };
        }
    }, []);

    const logout = useCallback(() => {
        if (user) {
            api.post("/auth/logout", { userId: user.id }).catch((err) => {
                console.error("Logout API call failed:", err);
            });
        }
        setUser(null);
        localStorage.removeItem(AUTH_STORAGE_KEY);
    }, [user]);

    const hasPermission = useCallback((tabName: string) => {
        if (!user || !user.role) return false;

        const permKey = `tab_${tabName.toLowerCase()}` as keyof Role;
        return user.role[permKey] === true;
    }, [user]);

    return (
        <AuthContext.Provider
            value={{
                user,
                loading,
                isAuthenticated: !!user,
                login,
                logout,
                hasPermission,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
}
