// backend/src/routes/users.ts
import { Router, Request, Response } from "express";
import { pool } from "../server";
import bcrypt from "bcrypt";

const router = Router();
const SALT_ROUNDS = 10;

// GET /users - List all users
router.get("/", async (_req: Request, res: Response) => {
    const client = await pool.connect();
    try {
        const result = await client.query(
            `SELECT u.id, u.username, u.name, u.is_active, u.last_login, u.created_at, u.updated_at,
              r.id as role_id, r.name as role_name
       FROM users u
       LEFT JOIN roles r ON u.role_id = r.id
       ORDER BY u.name ASC`
        );

        res.json(result.rows.map(row => ({
            id: row.id,
            username: row.username,
            name: row.name,
            is_active: row.is_active,
            last_login: row.last_login,
            created_at: row.created_at,
            updated_at: row.updated_at,
            role: row.role_id ? {
                id: row.role_id,
                name: row.role_name,
            } : null,
        })));
    } catch (error) {
        console.error("Error fetching users:", error);
        res.status(500).json({ message: "Failed to fetch users" });
    } finally {
        client.release();
    }
});

// GET /users/:id - Get single user
router.get("/:id", async (req: Request, res: Response) => {
    const { id } = req.params;
    const client = await pool.connect();
    try {
        const result = await client.query(
            `SELECT u.id, u.username, u.name, u.is_active, u.last_login, u.created_at, u.updated_at,
              r.id as role_id, r.name as role_name
       FROM users u
       LEFT JOIN roles r ON u.role_id = r.id
       WHERE u.id = $1`,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: "User not found" });
        }

        const row = result.rows[0];
        res.json({
            id: row.id,
            username: row.username,
            name: row.name,
            is_active: row.is_active,
            last_login: row.last_login,
            created_at: row.created_at,
            updated_at: row.updated_at,
            role: row.role_id ? {
                id: row.role_id,
                name: row.role_name,
            } : null,
        });
    } catch (error) {
        console.error("Error fetching user:", error);
        res.status(500).json({ message: "Failed to fetch user" });
    } finally {
        client.release();
    }
});

// POST /users - Create new user
router.post("/", async (req: Request, res: Response) => {
    const { username, password, name, role_id, is_active = true } = req.body;

    if (!username || !password || !name) {
        return res.status(400).json({ message: "Username, password, and name are required" });
    }

    const client = await pool.connect();
    try {
        // Check if username already exists
        const existingUser = await client.query(
            "SELECT id FROM users WHERE username = $1",
            [username]
        );

        if (existingUser.rows.length > 0) {
            return res.status(400).json({ message: "Username already exists" });
        }

        // Hash password
        const password_hash = await bcrypt.hash(password, SALT_ROUNDS);

        // Create user
        const result = await client.query(
            `INSERT INTO users (username, password_hash, name, role_id, is_active)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, username, name, role_id, is_active, created_at`,
            [username, password_hash, name, role_id || null, is_active]
        );

        // Get role info
        let role = null;
        if (role_id) {
            const roleResult = await client.query(
                "SELECT id, name FROM roles WHERE id = $1",
                [role_id]
            );
            if (roleResult.rows.length > 0) {
                role = roleResult.rows[0];
            }
        }

        res.status(201).json({
            ...result.rows[0],
            role,
        });
    } catch (error) {
        console.error("Error creating user:", error);
        res.status(500).json({ message: "Failed to create user" });
    } finally {
        client.release();
    }
});

// PUT /users/:id - Update user
router.put("/:id", async (req: Request, res: Response) => {
    const { id } = req.params;
    const { username, password, name, role_id, is_active } = req.body;

    const client = await pool.connect();
    try {
        // Check if user exists
        const existingUser = await client.query(
            "SELECT id FROM users WHERE id = $1",
            [id]
        );

        if (existingUser.rows.length === 0) {
            return res.status(404).json({ message: "User not found" });
        }

        // Check if username is taken by another user
        if (username) {
            const duplicateCheck = await client.query(
                "SELECT id FROM users WHERE username = $1 AND id != $2",
                [username, id]
            );
            if (duplicateCheck.rows.length > 0) {
                return res.status(400).json({ message: "Username already exists" });
            }
        }

        // Build update query dynamically
        const updates: string[] = [];
        const values: any[] = [];
        let paramIndex = 1;

        if (username !== undefined) {
            updates.push(`username = $${paramIndex++}`);
            values.push(username);
        }
        if (password) {
            const password_hash = await bcrypt.hash(password, SALT_ROUNDS);
            updates.push(`password_hash = $${paramIndex++}`);
            values.push(password_hash);
        }
        if (name !== undefined) {
            updates.push(`name = $${paramIndex++}`);
            values.push(name);
        }
        if (role_id !== undefined) {
            updates.push(`role_id = $${paramIndex++}`);
            values.push(role_id || null);
        }
        if (is_active !== undefined) {
            updates.push(`is_active = $${paramIndex++}`);
            values.push(is_active);
        }

        updates.push(`updated_at = NOW()`);
        values.push(id);

        const result = await client.query(
            `UPDATE users SET ${updates.join(", ")} WHERE id = $${paramIndex} RETURNING *`,
            values
        );

        // Get role info
        let role = null;
        if (result.rows[0].role_id) {
            const roleResult = await client.query(
                "SELECT id, name FROM roles WHERE id = $1",
                [result.rows[0].role_id]
            );
            if (roleResult.rows.length > 0) {
                role = roleResult.rows[0];
            }
        }

        res.json({
            id: result.rows[0].id,
            username: result.rows[0].username,
            name: result.rows[0].name,
            is_active: result.rows[0].is_active,
            role,
        });
    } catch (error) {
        console.error("Error updating user:", error);
        res.status(500).json({ message: "Failed to update user" });
    } finally {
        client.release();
    }
});

// DELETE /users/:id - Delete user
router.delete("/:id", async (req: Request, res: Response) => {
    const { id } = req.params;

    const client = await pool.connect();
    try {
        const result = await client.query(
            "DELETE FROM users WHERE id = $1 RETURNING id",
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: "User not found" });
        }

        res.json({ message: "User deleted successfully" });
    } catch (error) {
        console.error("Error deleting user:", error);
        res.status(500).json({ message: "Failed to delete user" });
    } finally {
        client.release();
    }
});

export default router;
