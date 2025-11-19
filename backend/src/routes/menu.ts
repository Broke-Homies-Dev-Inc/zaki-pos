// backend/src/routes/menu.ts
import { Router, Request, Response } from 'express';
import { pool } from '../server';

const router = Router();

// Helper: get full menu item with recipe
const getFullMenuItem = async (client: any, id: string) => {
  const itemResult = await client.query(
    `
    SELECT 
      mi.*, 
      (SELECT json_agg(
        json_build_object(
          'inventory_item_id', r.inventory_item_id,
          'item_name', inv.item_name,
          'quantity_used', r.quantity_used
        )
      )
      FROM recipes r
      JOIN inventory inv ON inv.id = r.inventory_item_id
      WHERE r.menu_item_id = mi.id) as recipe
    FROM menu_items mi
    WHERE mi.id = $1;
  `,
    [id]
  );
  const item = itemResult.rows[0];
  if (item) item.recipe = item.recipe || [];
  return item;
};

/* ---------------------------
   Categories endpoints
   - GET /menu/categories         -> [{ main_category, sub_category, id }]
   - GET /menu/categories/main    -> distinct main categories
   - GET /menu/categories/:main/subcategories -> subcategories for main
   - POST /menu/categories        -> create (main_category, sub_category)
   - PUT /menu/categories/:id     -> update
   - DELETE /menu/categories/:id  -> delete
----------------------------*/

// Return all category rows (main + sub)
router.get('/categories', async (req: Request, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT id, main_category, sub_category
      FROM categories
      ORDER BY main_category NULLS LAST, sub_category NULLS LAST;
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Return distinct main categories (simple list)
router.get('/categories/main', async (req: Request, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT DISTINCT main_category
      FROM categories
      WHERE main_category IS NOT NULL
      ORDER BY main_category;
    `);
    res.json(result.rows.map((r: any) => r.main_category));
  } catch (error) {
    console.error('Error fetching main categories:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Return subcategories for a given main (use URL encoded main name)
router.get('/categories/:main/subcategories', async (req: Request, res: Response) => {
  const main = req.params.main;
  try {
    const result = await pool.query(
      `SELECT id, sub_category FROM categories WHERE main_category = $1 ORDER BY sub_category NULLS LAST;`,
      [main]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching subcategories:', err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Create category (main + optional sub). Allow same main repeating, ensure pair unique (db constraint)
router.post('/categories', async (req: Request, res: Response) => {
  const { main_category, sub_category } = req.body;
  if (!main_category || String(main_category).trim() === '') {
    return res.status(400).json({ message: 'main_category required' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO categories (main_category, sub_category) VALUES ($1, $2)
       ON CONFLICT (main_category, sub_category) DO NOTHING
       RETURNING id, main_category, sub_category;`,
      [main_category.trim(), sub_category ?? null]
    );

    // If nothing returned (conflict), return the existing record or 200 with the input.
    if (result.rows.length > 0) {
      return res.status(201).json(result.rows[0]);
    } else {
      // fetch the existing row (or just echo back)
      const exist = await pool.query(
        `SELECT id, main_category, sub_category FROM categories WHERE main_category = $1 AND (sub_category IS NOT DISTINCT FROM $2) LIMIT 1;`,
        [main_category.trim(), sub_category ?? null]
      );
      if (exist.rows.length > 0) return res.status(200).json(exist.rows[0]);
      return res.status(200).json({ main_category: main_category.trim(), sub_category: sub_category ?? null });
    }
  } catch (err: any) {
    console.error('Error creating category:', err);
    // If unique constraint error arises for some other index, return friendly message
    return res.status(500).json({ message: 'Failed to create category' });
  }
});

// Update (rename) a category row (by id)
router.put('/categories/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { main_category, sub_category } = req.body;
  if (!main_category || String(main_category).trim() === '') {
    return res.status(400).json({ message: 'main_category required' });
  }
  try {
    const result = await pool.query(
      `UPDATE categories SET main_category = $1, sub_category = $2 WHERE id = $3 RETURNING id, main_category, sub_category;`,
      [main_category.trim(), sub_category ?? null, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating category:', err);
    res.status(500).json({ message: 'Failed to update category' });
  }
});

// Delete a category row (by id)
router.delete('/categories/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM categories WHERE id = $1', [id]);
    res.status(204).send();
  } catch (err) {
    console.error('Error deleting category:', err);
    res.status(500).json({ message: 'Failed to delete category' });
  }
});

/* ---------------------------
   Menu items endpoints (existing logic preserved)
   Note: GET / supports optional ?category=&sub_category= filters
----------------------------*/

// GET all menu items (include sub_category and recipe). Accept optional filters.
router.get('/', async (req: Request, res: Response) => {
  try {
    const { category, sub_category } = req.query;
    // Use parameterized query; if param is missing, pass NULL and handle with IS NULL OR = ...
    const params: any[] = [];
    let whereClause = `WHERE 1=1`;
    if (category) {
      params.push(category);
      whereClause += ` AND mi.category = $${params.length}`;
    }
    if (sub_category) {
      params.push(sub_category);
      whereClause += ` AND mi.sub_category = $${params.length}`;
    }

    const sql = `
      SELECT 
        mi.*, 
        (SELECT json_agg(
          json_build_object(
            'inventory_item_id', r.inventory_item_id,
            'item_name', inv.item_name,
            'quantity_used', r.quantity_used
          )
        )
        FROM recipes r
        JOIN inventory inv ON inv.id = r.inventory_item_id
        WHERE r.menu_item_id = mi.id) as recipe
      FROM menu_items mi
      ${whereClause}
      ORDER BY mi.category, mi.sub_category NULLS LAST, mi.name;
    `;
    const result = await pool.query(sql, params);
    res.json(result.rows.map((row: any) => ({ ...row, recipe: row.recipe || [] })));
  } catch (error) {
    console.error('Error fetching menu items:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// POST create new menu item (sub_category supported)
router.post('/', async (req: Request, res: Response) => {
  const { name, category, sub_category, price, available, recipe } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const newItemResult = await client.query(
      `INSERT INTO menu_items (name, category, sub_category, price, available)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [name, category, sub_category ?? null, price, available ?? true]
    );
    const newItemId = newItemResult.rows[0].id;

    if (recipe && recipe.length > 0) {
      for (const ingredient of recipe) {
        await client.query(
          'INSERT INTO recipes (menu_item_id, inventory_item_id, quantity_used) VALUES ($1, $2, $3)',
          [newItemId, ingredient.inventory_item_id, ingredient.quantity_used]
        );
      }
    }
    await client.query('COMMIT');

    const finalItem = await getFullMenuItem(client, newItemId);
    res.status(201).json(finalItem);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating menu item:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  } finally {
    client.release();
  }
});

// PUT update menu item (include sub_category)
router.put('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, category, sub_category, price, available, recipe } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      'UPDATE menu_items SET name = $1, category = $2, sub_category = $3, price = $4, available = $5, updated_at = NOW() WHERE id = $6',
      [name, category, sub_category ?? null, price, available, id]
    );

    await client.query('DELETE FROM recipes WHERE menu_item_id = $1', [id]);
    if (recipe && recipe.length > 0) {
      for (const ingredient of recipe) {
        await client.query(
          'INSERT INTO recipes (menu_item_id, inventory_item_id, quantity_used) VALUES ($1, $2, $3)',
          [id, ingredient.inventory_item_id, ingredient.quantity_used]
        );
      }
    }
    await client.query('COMMIT');

    const finalItem = await getFullMenuItem(client, id);
    res.json(finalItem);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating menu item:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  } finally {
    client.release();
  }
});

// DELETE menu item
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM menu_items WHERE id = $1', [id]);
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting menu item:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

export default router;
