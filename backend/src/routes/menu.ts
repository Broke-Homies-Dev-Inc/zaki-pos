// backend/src/routes/menu.ts
import { Router, Request, Response } from 'express';
import { pool } from '../server';

const router = Router();

// A helper function to get a full menu item with its recipe
const getFullMenuItem = async (client: any, id: string) => {
  const itemResult = await client.query(
    `
    SELECT 
      mi.*, 
      (SELECT coalesce(json_agg(
        json_build_object(
          'inventory_item_id', r.inventory_item_id,
          'item_name', inv.item_name,
          'quantity_used', r.quantity_used
        )
      ), '[]'::json) 
       FROM recipes r
       JOIN inventory inv ON inv.id = r.inventory_item_id
       WHERE r.menu_item_id = mi.id) as recipe
    FROM menu_items mi
    WHERE mi.id = $1;
  `,
    [id]
  );
  const item = itemResult.rows[0];
  if (item) {
    item.recipe = item.recipe || [];
  }
  return item;
};

/* ---------------------------------------------------
   Categories endpoints
   - GET /categories  -> list categories (from categories table if exists, else distinct menu_items)
   - POST /categories -> create a category in categories table
--------------------------------------------------- */

router.get('/categories', async (req: Request, res: Response) => {
  try {
    // Prefer categories table if exists
    const check = await pool.query(`
      SELECT to_regclass('public.categories') as exists;
    `);
    const exists = check.rows[0] && check.rows[0].exists;

    if (exists) {
      const r = await pool.query(`SELECT name FROM categories ORDER BY name;`);
      return res.json(r.rows.map((r2: any) => r2.name));
    } else {
      // fallback: distinct categories from menu_items
      const r = await pool.query(`SELECT DISTINCT COALESCE(NULLIF(TRIM(category),''),'Uncategorized') AS name FROM menu_items ORDER BY name;`);
      return res.json(r.rows.map((r2: any) => r2.name));
    }
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

router.post('/categories', async (req: Request, res: Response) => {
  const { name } = req.body;
  if (!name || !String(name).trim()) return res.status(400).json({ message: 'Category name required' });

  const client = await pool.connect();
  try {
    // Ensure categories table exists — create if not present (safe idempotent)
    await client.query(`
      CREATE TABLE IF NOT EXISTS categories (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        name varchar(255) NOT NULL UNIQUE,
        created_at timestamptz DEFAULT now()
      );
    `);

    // Insert category
    await client.query('INSERT INTO categories (name) VALUES ($1) ON CONFLICT (name) DO NOTHING', [name.trim()]);

    // Return updated list
    const r = await client.query(`SELECT name FROM categories ORDER BY name;`);
    res.status(201).json(r.rows.map((r2: any) => r2.name));
  } catch (err) {
    console.error('Error creating category:', err);
    res.status(500).json({ message: 'Failed to create category' });
  } finally {
    client.release();
  }
});

/* ---------------------------------------------------
   Menu item CRUD (existing logic with minor safety tweaks)
--------------------------------------------------- */

// GET all menu items
router.get('/', async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `
      SELECT 
        mi.*, 
        (SELECT coalesce(json_agg(
          json_build_object(
            'inventory_item_id', r.inventory_item_id,
            'item_name', inv.item_name,
            'quantity_used', r.quantity_used
          )
        ), '[]'::json)
        FROM recipes r
        JOIN inventory inv ON inv.id = r.inventory_item_id
        WHERE r.menu_item_id = mi.id) as recipe
      FROM menu_items mi
      ORDER BY mi.category NULLS LAST, mi.name;
    `
    );
    res.json(result.rows.map((row: any) => ({ ...row, recipe: row.recipe || [] })));
  } catch (error) {
    console.error('Error fetching menu items:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// POST a new menu item
router.post('/', async (req: Request, res: Response) => {
  const { name, category, price, available, recipe } = req.body;
  if (!name || typeof price === 'undefined') return res.status(400).json({ message: 'name and price required' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const newItemResult = await client.query(
      'INSERT INTO menu_items (name, category, price, available) VALUES ($1, $2, $3, $4) RETURNING id',
      [name, category ?? null, price, available ?? true]
    );
    const newItemId = newItemResult.rows[0].id;

    if (Array.isArray(recipe) && recipe.length > 0) {
      for (const ingredient of recipe) {
        await client.query(
          'INSERT INTO recipes (menu_item_id, inventory_item_id, quantity_used) VALUES ($1, $2, $3)',
          [newItemId, ingredient.inventory_item_id, ingredient.quantity_used]
        );
      }
    }
    await client.query('COMMIT');

    // if categories table exists and category provided, ensure it exists there too
    if (category && category.trim()) {
      try {
        await pool.query(`
          CREATE TABLE IF NOT EXISTS categories (
            id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
            name varchar(255) NOT NULL UNIQUE,
            created_at timestamptz DEFAULT now()
          );
        `);
        await pool.query('INSERT INTO categories (name) VALUES ($1) ON CONFLICT (name) DO NOTHING', [category.trim()]);
      } catch (e) {
        // ignore category insert errors
        console.warn('Warning: could not insert category into categories table', e);
      }
    }

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

// PUT (update) an existing menu item
router.put('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, category, price, available, recipe } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      'UPDATE menu_items SET name = $1, category = $2, price = $3, available = $4, updated_at = NOW() WHERE id = $5',
      [name, category ?? null, price, available, id]
    );

    await client.query('DELETE FROM recipes WHERE menu_item_id = $1', [id]);
    if (Array.isArray(recipe) && recipe.length > 0) {
      for (const ingredient of recipe) {
        await client.query(
          'INSERT INTO recipes (menu_item_id, inventory_item_id, quantity_used) VALUES ($1, $2, $3)',
          [id, ingredient.inventory_item_id, ingredient.quantity_used]
        );
      }
    }
    await client.query('COMMIT');

    // also ensure category existence in categories table
    if (category && category.trim()) {
      try {
        await pool.query(`
          CREATE TABLE IF NOT EXISTS categories (
            id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
            name varchar(255) NOT NULL UNIQUE,
            created_at timestamptz DEFAULT now()
          );
        `);
        await pool.query('INSERT INTO categories (name) VALUES ($1) ON CONFLICT (name) DO NOTHING', [category.trim()]);
      } catch (e) {
        console.warn('Warning: could not insert category into categories table', e);
      }
    }

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

// DELETE a menu item
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
