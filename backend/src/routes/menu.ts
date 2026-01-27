import { Router, type Request, type Response } from "express"
import { pool } from "../server"

const router = Router()

// Helper: get full menu item with recipe
const getFullMenuItem = async (client: any, id: string) => {
  const itemResult = await client.query(
    `
    SELECT 
      mi.*, 
      (
        SELECT json_agg(
          json_build_object(
            'inventory_item_id', r.inventory_item_id,
            'item_name',        inv.item_name,
            'quantity_used',    r.quantity_used
          )
        )
        FROM recipes r
        JOIN inventory inv ON inv.id = r.inventory_item_id
        WHERE r.menu_item_id = mi.id
      ) AS recipe
    FROM menu_items mi
    WHERE mi.id = $1;
  `,
    [id],
  )
  const item = itemResult.rows[0]
  if (item) item.recipe = item.recipe || []
  return item
}

/* ---------------------------
   Categories endpoints
----------------------------*/

// Return all category rows (main + sub)
router.get("/categories", async (req: Request, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT id, main_category, sub_category
      FROM categories
      ORDER BY main_category NULLS LAST, sub_category NULLS LAST;
    `)
    res.json(result.rows)
  } catch (error) {
    console.error("Error fetching categories:", error)
    res.status(500).json({ message: "Internal Server Error" })
  }
})

// Return distinct main categories (simple list)
router.get("/categories/main", async (req: Request, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT DISTINCT main_category
      FROM categories
      WHERE main_category IS NOT NULL
      ORDER BY main_category;
    `)
    res.json(result.rows.map((r: any) => r.main_category))
  } catch (error) {
    console.error("Error fetching main categories:", error)
    res.status(500).json({ message: "Internal Server Error" })
  }
})

// Return subcategories for a given main (use URL encoded main name)
router.get("/categories/:main/subcategories", async (req: Request, res: Response) => {
  const main = req.params.main
  try {
    const result = await pool.query(
      `SELECT id, sub_category 
         FROM categories 
         WHERE main_category = $1 
         ORDER BY sub_category NULLS LAST;`,
      [main],
    )
    res.json(result.rows)
  } catch (err) {
    console.error("Error fetching subcategories:", err)
    res.status(500).json({ message: "Internal Server Error" })
  }
})

// Create category (main + optional sub). Allow same main repeating, ensure pair unique (db constraint)
router.post("/categories", async (req: Request, res: Response) => {
  const { main_category, sub_category } = req.body
  if (!main_category || String(main_category).trim() === "") {
    return res.status(400).json({ message: "main_category required" })
  }

  try {
    const result = await pool.query(
      `INSERT INTO categories (main_category, sub_category) VALUES ($1, $2)
       ON CONFLICT (main_category, sub_category) DO NOTHING
       RETURNING id, main_category, sub_category;`,
      [main_category.trim(), sub_category ?? null],
    )

    // If nothing returned (conflict), return the existing record or 200 with the input.
    if (result.rows.length > 0) {
      return res.status(201).json(result.rows[0])
    } else {
      const exist = await pool.query(
        `SELECT id, main_category, sub_category 
         FROM categories 
         WHERE main_category = $1 
           AND (sub_category IS NOT DISTINCT FROM $2) 
         LIMIT 1;`,
        [main_category.trim(), sub_category ?? null],
      )
      if (exist.rows.length > 0) return res.status(200).json(exist.rows[0])
      return res.status(200).json({ main_category: main_category.trim(), sub_category: sub_category ?? null })
    }
  } catch (err: any) {
    console.error("Error creating category:", err)
    return res.status(500).json({ message: "Failed to create category" })
  }
})

// Update (rename) a category row (by id)
router.put("/categories/:id", async (req: Request, res: Response) => {
  const { id } = req.params
  const { main_category, sub_category } = req.body
  if (!main_category || String(main_category).trim() === "") {
    return res.status(400).json({ message: "main_category required" })
  }
  try {
    const result = await pool.query(
      `UPDATE categories 
       SET main_category = $1, sub_category = $2 
       WHERE id = $3 
       RETURNING id, main_category, sub_category;`,
      [main_category.trim(), sub_category ?? null, id],
    )
    if (result.rows.length === 0) return res.status(404).json({ message: "Not found" })
    res.json(result.rows[0])
  } catch (err) {
    console.error("Error updating category:", err)
    res.status(500).json({ message: "Failed to update category" })
  }
})

// Delete a category row (by id)
router.delete("/categories/:id", async (req: Request, res: Response) => {
  const { id } = req.params
  try {
    await pool.query("DELETE FROM categories WHERE id = $1", [id])
    res.status(204).send()
  } catch (err) {
    console.error("Error deleting category:", err)
    res.status(500).json({ message: "Failed to delete category" })
  }
})

/* ---------------------------
   Menu items endpoints
----------------------------*/

// GET all menu items (include sub_category, is_vegetarian, and recipe). Accept optional filters.
router.get("/", async (req: Request, res: Response) => {
  try {
    const { category, sub_category } = req.query
    const params: any[] = []
    let whereClause = `WHERE 1=1`
    if (category) {
      params.push(category)
      whereClause += ` AND mi.category = $${params.length}`
    }
    if (sub_category) {
      params.push(sub_category)
      whereClause += ` AND mi.sub_category = $${params.length}`
    }

    const sql = `
      SELECT 
        mi.*, 
        ks.name as station_name,
        (
          SELECT json_agg(
            json_build_object(
              'inventory_item_id', r.inventory_item_id,
              'item_name',        inv.item_name,
              'quantity_used',    r.quantity_used
            )
          )
          FROM recipes r
          JOIN inventory inv ON inv.id = r.inventory_item_id
          WHERE r.menu_item_id = mi.id
        ) AS recipe
      FROM menu_items mi
      LEFT JOIN kitchen_stations ks ON mi.station_id = ks.id
      ${whereClause}
      ORDER BY mi.category, mi.sub_category NULLS LAST, mi.name;
    `
    const result = await pool.query(sql, params)
    res.json(
      result.rows.map((row: any) => ({
        ...row,
        recipe: row.recipe || [],
      })),
    )
  } catch (error) {
    console.error("Error fetching menu items:", error)
    res.status(500).json({ message: "Internal Server Error" })
  }
})

// POST create new menu item (sub_category, is_vegetarian, portion_sizes, station_id, quick_notes, and name_ar supported)
router.post("/", async (req: Request, res: Response) => {
  const {
    name,
    name_ar,
    category,
    sub_category,
    price,
    available,
    recipe,
    stock,
    low_stock_threshold,
    description,
    image_url,
    portion_sizes,
    is_vegetarian,
    station_id,
    apply_vat,
    quick_notes,
  } = req.body

  // IMPORTANT: pg does not auto-JSON encode objects. Serialize before insert.
  const portionJson =
    portion_sizes && Array.isArray(portion_sizes) && portion_sizes.length > 0 ? JSON.stringify(portion_sizes) : null
  const quickNotesJson =
    quick_notes && Array.isArray(quick_notes) && quick_notes.length > 0 ? JSON.stringify(quick_notes) : null

  const client = await pool.connect()
  try {
    await client.query("BEGIN")

    const newItemResult = await client.query(
      `INSERT INTO menu_items 
        (name, name_ar, category, sub_category, price, available, stock, low_stock_threshold, description, image_url, portion_sizes, is_vegetarian, station_id, apply_vat, quick_notes)
       VALUES 
        ($1,   $2,      $3,       $4,          $5,    $6,        $7,    $8,                 $9,          $10,        $11,         $12,          $13,        $14,       $15)
       RETURNING id`,
      [
        name,
        name_ar ?? null,
        category,
        sub_category ?? null,
        price,
        available ?? true,
        stock ?? 0,
        low_stock_threshold ?? 5,
        description ?? null,
        image_url ?? null,
        portionJson,
        is_vegetarian ?? false,
        station_id ?? null,
        apply_vat ?? false,
        quickNotesJson,
      ],
    )
    const newItemId = newItemResult.rows[0].id

    if (recipe && recipe.length > 0) {
      for (const ingredient of recipe) {
        await client.query("INSERT INTO recipes (menu_item_id, inventory_item_id, quantity_used) VALUES ($1, $2, $3)", [
          newItemId,
          ingredient.inventory_item_id,
          ingredient.quantity_used,
        ])
      }
    }

    await client.query("COMMIT")

    const finalItem = await getFullMenuItem(client, newItemId)
    res.status(201).json(finalItem)
  } catch (error) {
    await client.query("ROLLBACK")
    console.error("Error creating menu item:", error)
    res.status(500).json({ message: "Internal Server Error" })
  } finally {
    client.release()
  }
})

// PUT update menu item (include sub_category, is_vegetarian, portion_sizes, station_id, quick_notes, and name_ar)
router.put("/:id", async (req: Request, res: Response) => {
  const { id } = req.params
  const {
    name,
    name_ar,
    category,
    sub_category,
    price,
    available,
    recipe,
    stock,
    low_stock_threshold,
    description,
    image_url,
    portion_sizes,
    is_vegetarian,
    station_id,
    apply_vat,
    quick_notes,
  } = req.body

  const portionJson =
    portion_sizes && Array.isArray(portion_sizes) && portion_sizes.length > 0 ? JSON.stringify(portion_sizes) : null
  const quickNotesJson =
    quick_notes && Array.isArray(quick_notes) && quick_notes.length > 0 ? JSON.stringify(quick_notes) : null

  const client = await pool.connect()
  try {
    await client.query("BEGIN")

    await client.query(
      `UPDATE menu_items 
       SET name               = $1,
           name_ar            = $2,
           category           = $3,
           sub_category       = $4,
           price              = $5,
           available          = $6,
           stock              = $7,
           low_stock_threshold= $8,
           description        = $9,
           image_url          = $10,
           portion_sizes      = $11,
           is_vegetarian      = $12,
           station_id         = $13,
           apply_vat          = $14,
           quick_notes        = $15,
           updated_at         = NOW()
       WHERE id = $16`,
      [
        name,
        name_ar ?? null,
        category,
        sub_category ?? null,
        price,
        available,
        stock ?? 0,
        low_stock_threshold ?? 5,
        description ?? null,
        image_url ?? null,
        portionJson,
        is_vegetarian ?? false,
        station_id ?? null,
        apply_vat ?? false,
        quickNotesJson,
        id,
      ],
    )

    await client.query("DELETE FROM recipes WHERE menu_item_id = $1", [id])
    if (recipe && recipe.length > 0) {
      for (const ingredient of recipe) {
        await client.query("INSERT INTO recipes (menu_item_id, inventory_item_id, quantity_used) VALUES ($1, $2, $3)", [
          id,
          ingredient.inventory_item_id,
          ingredient.quantity_used,
        ])
      }
    }

    await client.query("COMMIT")

    const finalItem = await getFullMenuItem(client, id)
    res.json(finalItem)
  } catch (error) {
    await client.query("ROLLBACK")
    console.error("Error updating menu item:", error)
    res.status(500).json({ message: "Internal Server Error" })
  } finally {
    client.release()
  }
})

// DELETE menu item
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    await pool.query("DELETE FROM menu_items WHERE id = $1", [id])
    res.status(204).send()
  } catch (error) {
    console.error("Error deleting menu item:", error)
    res.status(500).json({ message: "Internal Server Error" })
  }
})

// PATCH adjust stock for a menu item
// Body: { adjustment: number } - positive to add, negative to subtract
router.patch("/:id/stock", async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const { adjustment } = req.body

    if (typeof adjustment !== "number") {
      return res.status(400).json({ message: "adjustment must be a number" })
    }

    // Validate: adjustment must be a whole number (no decimals)
    if (!Number.isInteger(adjustment)) {
      return res.status(400).json({ message: "adjustment must be a whole number" })
    }

    // Get current stock first to validate the operation
    const currentResult = await pool.query("SELECT stock FROM menu_items WHERE id = $1", [id])

    if (currentResult.rows.length === 0) {
      return res.status(404).json({ message: "Menu item not found" })
    }

    const currentStock = currentResult.rows[0].stock || 0
    const newStock = currentStock + adjustment

    // Validate: stock cannot go negative
    if (newStock < 0) {
      return res.status(400).json({
        message: `Cannot reduce stock below 0. Current stock: ${currentStock}, attempted adjustment: ${adjustment}`,
      })
    }

    // Perform the update with the validated new stock value
    const result = await pool.query("UPDATE menu_items SET stock = $1, updated_at = NOW() WHERE id = $2 RETURNING *", [
      newStock,
      id,
    ])

    res.json(result.rows[0])
  } catch (error) {
    console.error("Error adjusting stock:", error)
    res.status(500).json({ message: "Internal Server Error" })
  }
})

export default router
