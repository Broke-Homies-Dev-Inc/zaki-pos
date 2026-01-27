// backend/src/routes/roles.ts
import { Router, Request, Response } from "express";
import { pool } from "../server";

const router = Router();

// GET /roles - List all roles with permissions
router.get("/", async (_req: Request, res: Response) => {
    const client = await pool.connect();
    try {
        const result = await client.query(
            `SELECT id, name, tab_dashboard, tab_orders, tab_menu, tab_inventory,
              tab_ingredients, tab_billing, tab_reports, tab_customers, tab_settings,
              created_at, updated_at
       FROM roles
       ORDER BY name ASC`
        );

        res.json(result.rows);
    } catch (error) {
        console.error("Error fetching roles:", error);
        res.status(500).json({ message: "Failed to fetch roles" });
    } finally {
        client.release();
    }
});

// GET /roles/:id - Get single role
router.get("/:id", async (req: Request, res: Response) => {
    const { id } = req.params;
    const client = await pool.connect();
    try {
        const result = await client.query(
            `SELECT id, name, tab_dashboard, tab_orders, tab_menu, tab_inventory,
              tab_ingredients, tab_billing, tab_reports, tab_customers, tab_settings,
              created_at, updated_at
       FROM roles
       WHERE id = $1`,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: "Role not found" });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error("Error fetching role:", error);
        res.status(500).json({ message: "Failed to fetch role" });
    } finally {
        client.release();
    }
});

// POST /roles - Create new role
router.post("/", async (req: Request, res: Response) => {
    const {
        name,
        tab_dashboard = true,
        tab_orders = true,
        tab_menu = false,
        tab_inventory = false,
        tab_ingredients = false,
        tab_billing = false,
        tab_reports = false,
        tab_customers = false,
        tab_settings = false,
    } = req.body;

    if (!name) {
        return res.status(400).json({ message: "Role name is required" });
    }

    const client = await pool.connect();
    try {
        // Check if name already exists
        const existingRole = await client.query(
            "SELECT id FROM roles WHERE name = $1",
            [name]
        );

        if (existingRole.rows.length > 0) {
            return res.status(400).json({ message: "Role name already exists" });
        }

        const result = await client.query(
            `INSERT INTO roles (name, tab_dashboard, tab_orders, tab_menu, tab_inventory,
                          tab_ingredients, tab_billing, tab_reports, tab_customers, tab_settings)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
            [name, tab_dashboard, tab_orders, tab_menu, tab_inventory,
                tab_ingredients, tab_billing, tab_reports, tab_customers, tab_settings]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error("Error creating role:", error);
        res.status(500).json({ message: "Failed to create role" });
    } finally {
        client.release();
    }
});

// PUT /roles/:id - Update role
router.put("/:id", async (req: Request, res: Response) => {
    const { id } = req.params;
    const {
        name,
        tab_dashboard,
        tab_orders,
        tab_menu,
        tab_inventory,
        tab_ingredients,
        tab_billing,
        tab_reports,
        tab_customers,
        tab_settings,
    } = req.body;

    const client = await pool.connect();
    try {
        // Check if role exists
        const existingRole = await client.query(
            "SELECT id FROM roles WHERE id = $1",
            [id]
        );

        if (existingRole.rows.length === 0) {
            return res.status(404).json({ message: "Role not found" });
        }

        // Check if name is taken by another role
        if (name) {
            const duplicateCheck = await client.query(
                "SELECT id FROM roles WHERE name = $1 AND id != $2",
                [name, id]
            );
            if (duplicateCheck.rows.length > 0) {
                return res.status(400).json({ message: "Role name already exists" });
            }
        }

        // Build update query dynamically
        const updates: string[] = [];
        const values: any[] = [];
        let paramIndex = 1;

        if (name !== undefined) {
            updates.push(`name = $${paramIndex++}`);
            values.push(name);
        }
        if (tab_dashboard !== undefined) {
            updates.push(`tab_dashboard = $${paramIndex++}`);
            values.push(tab_dashboard);
        }
        if (tab_orders !== undefined) {
            updates.push(`tab_orders = $${paramIndex++}`);
            values.push(tab_orders);
        }
        if (tab_menu !== undefined) {
            updates.push(`tab_menu = $${paramIndex++}`);
            values.push(tab_menu);
        }
        if (tab_inventory !== undefined) {
            updates.push(`tab_inventory = $${paramIndex++}`);
            values.push(tab_inventory);
        }
        if (tab_ingredients !== undefined) {
            updates.push(`tab_ingredients = $${paramIndex++}`);
            values.push(tab_ingredients);
        }
        if (tab_billing !== undefined) {
            updates.push(`tab_billing = $${paramIndex++}`);
            values.push(tab_billing);
        }
        if (tab_reports !== undefined) {
            updates.push(`tab_reports = $${paramIndex++}`);
            values.push(tab_reports);
        }
        if (tab_customers !== undefined) {
            updates.push(`tab_customers = $${paramIndex++}`);
            values.push(tab_customers);
        }
        if (tab_settings !== undefined) {
            updates.push(`tab_settings = $${paramIndex++}`);
            values.push(tab_settings);
        }

        updates.push(`updated_at = NOW()`);
        values.push(id);

        const result = await client.query(
            `UPDATE roles SET ${updates.join(", ")} WHERE id = $${paramIndex} RETURNING *`,
            values
        );

        res.json(result.rows[0]);
    } catch (error) {
        console.error("Error updating role:", error);
        res.status(500).json({ message: "Failed to update role" });
    } finally {
        client.release();
    }
});

// DELETE /roles/:id - Delete role
router.delete("/:id", async (req: Request, res: Response) => {
    const { id } = req.params;

    const client = await pool.connect();
    try {
        // Check if any users are assigned to this role
        const usersWithRole = await client.query(
            "SELECT COUNT(*) as count FROM users WHERE role_id = $1",
            [id]
        );

        if (parseInt(usersWithRole.rows[0].count) > 0) {
            return res.status(400).json({
                message: "Cannot delete role: users are still assigned to this role"
            });
        }

        const result = await client.query(
            "DELETE FROM roles WHERE id = $1 RETURNING id",
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: "Role not found" });
        }

        res.json({ message: "Role deleted successfully" });
    } catch (error) {
        console.error("Error deleting role:", error);
        res.status(500).json({ message: "Failed to delete role" });
    } finally {
        client.release();
    }
});

export default router;
