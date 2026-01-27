// backend/src/routes/auth.ts
import { Router, Request, Response } from "express";
import { pool } from "../server";
import bcrypt from "bcrypt";

const router = Router();

// POST /auth/login - Authenticate user
router.post("/login", async (req: Request, res: Response) => {
    console.log("🔐 [AUTH] Login attempt started");
    console.log("🔐 [AUTH] Request body:", { username: req.body.username, passwordProvided: !!req.body.password });

    const { username, password } = req.body;

    if (!username || !password) {
        console.log("🔐 [AUTH] ❌ Missing username or password");
        return res.status(400).json({ message: "Username and password are required" });
    }

    const client = await pool.connect();
    try {
        console.log("🔐 [AUTH] Querying database for user:", username);

        // Get user with role
        const result = await client.query(
            `SELECT u.id, u.username, u.password_hash, u.name, u.is_active, u.role_id,
              r.id as role_id, r.name as role_name,
              r.tab_dashboard, r.tab_orders, r.tab_menu, r.tab_inventory,
              r.tab_ingredients, r.tab_billing, r.tab_reports, r.tab_customers, r.tab_settings
       FROM users u
       LEFT JOIN roles r ON u.role_id = r.id
       WHERE u.username = $1`,
            [username]
        );

        console.log("🔐 [AUTH] Query result rows:", result.rows.length);

        if (result.rows.length === 0) {
            console.log("🔐 [AUTH] ❌ User not found:", username);
            return res.status(401).json({ message: "Invalid username or password" });
        }

        const user = result.rows[0];
        console.log("🔐 [AUTH] User found:", { id: user.id, username: user.username, name: user.name, is_active: user.is_active, role_name: user.role_name });
        console.log("🔐 [AUTH] Password hash exists:", !!user.password_hash);
        console.log("🔐 [AUTH] Password hash length:", user.password_hash?.length);

        if (!user.is_active) {
            console.log("🔐 [AUTH] ❌ Account is disabled");
            return res.status(401).json({ message: "Account is disabled" });
        }

        // Verify password
        console.log("🔐 [AUTH] Comparing passwords...");
        const validPassword = await bcrypt.compare(password, user.password_hash);
        console.log("🔐 [AUTH] Password valid:", validPassword);

        if (!validPassword) {
            console.log("🔐 [AUTH] ❌ Invalid password for user:", username);
            return res.status(401).json({ message: "Invalid username or password" });
        }

        // Update last login
        await client.query(
            "UPDATE users SET last_login = NOW() WHERE id = $1",
            [user.id]
        );
        console.log("🔐 [AUTH] Updated last_login for user");

        // --- POS Session Logic (Admin Only) ---
        if (user.role_name === 'Admin' || user.role_name === 'admin' || user.role_name === 'Manager') {
            console.log("🔐 [AUTH] User is Admin/Manager - Managing POS Session...");

            // 1. Close any existing active sessions for this user (or globally if we want single admin session?)
            // For now, let's just ensure THIS user's previous sessions are closed.
            // Actually, if we want "System Online", maybe we want to close ALL other sessions? 
            // Let's stick to closing this user's sessions to be safe.
            await client.query(
                "UPDATE pos_sessions SET status = 'closed', log_out_time = NOW() WHERE user_id = $1 AND status = 'active'",
                [user.id]
            );

            // 2. Create new active session
            await client.query(
                "INSERT INTO pos_sessions (user_id, status, log_in_time) VALUES ($1, 'active', NOW())",
                [user.id]
            );
            console.log("🔐 [AUTH] ✅ POS Session Started for Admin");
        }
        // --------------------------------------

        // Return user data (without password hash)
        const responseData = {
            user: {
                id: user.id,
                username: user.username,
                name: user.name,
                role: {
                    id: user.role_id,
                    name: user.role_name,
                    tab_dashboard: user.tab_dashboard,
                    tab_orders: user.tab_orders,
                    tab_menu: user.tab_menu,
                    tab_inventory: user.tab_inventory,
                    tab_ingredients: user.tab_ingredients,
                    tab_billing: user.tab_billing,
                    tab_reports: user.tab_reports,
                    tab_customers: user.tab_customers,
                    tab_settings: user.tab_settings,
                },
            },
        };

        console.log("🔐 [AUTH] ✅ Login successful for user:", username);
        console.log("🔐 [AUTH] Response data:", JSON.stringify(responseData, null, 2));

        res.json(responseData);
    } catch (error) {
        console.error("🔐 [AUTH] ❌ Error during login:", error);
        res.status(500).json({ message: "Login failed" });
    } finally {
        client.release();
    }
});

// POST /auth/logout - Logout user
router.post("/logout", async (req: Request, res: Response) => {
    // We need to know WHO is logging out to close the session.
    // Ideally, the client sends user ID. If not, we can't close server-side session easily without JWT inspection.
    // BUT the requirement says "when he logs out".
    // Let's expect userId in body or just handle it if passed.
    const { userId } = req.body;

    if (userId) {
        const client = await pool.connect();
        try {
            await client.query(
                "UPDATE pos_sessions SET status = 'closed', log_out_time = NOW() WHERE user_id = $1 AND status = 'active'",
                [userId]
            );
            console.log(`🔐 [AUTH] POS Session closed for user ${userId}`);
        } catch (e) {
            console.error("Error closing session on logout", e);
        } finally {
            client.release();
        }
    }

    res.json({ message: "Logged out successfully" });
});

// GET /auth/me - Get current user (requires user ID in header for now)
router.get("/me", async (req: Request, res: Response) => {
    const userId = req.headers["x-user-id"] as string;

    if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
    }

    const client = await pool.connect();
    try {
        const result = await client.query(
            `SELECT u.id, u.username, u.name, u.is_active, u.role_id,
              r.id as role_id, r.name as role_name,
              r.tab_dashboard, r.tab_orders, r.tab_menu, r.tab_inventory,
              r.tab_ingredients, r.tab_billing, r.tab_reports, r.tab_customers, r.tab_settings
       FROM users u
       LEFT JOIN roles r ON u.role_id = r.id
       WHERE u.id = $1`,
            [userId]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ message: "User not found" });
        }

        const user = result.rows[0];

        res.json({
            user: {
                id: user.id,
                username: user.username,
                name: user.name,
                role: user.role_id ? {
                    id: user.role_id,
                    name: user.role_name,
                    tab_dashboard: user.tab_dashboard,
                    tab_orders: user.tab_orders,
                    tab_menu: user.tab_menu,
                    tab_inventory: user.tab_inventory,
                    tab_ingredients: user.tab_ingredients,
                    tab_billing: user.tab_billing,
                    tab_reports: user.tab_reports,
                    tab_customers: user.tab_customers,
                    tab_settings: user.tab_settings,
                } : null,
            },
        });
    } catch (error) {
        console.error("Error fetching current user:", error);
        res.status(500).json({ message: "Failed to fetch user" });
    } finally {
        client.release();
    }
});

export default router;
