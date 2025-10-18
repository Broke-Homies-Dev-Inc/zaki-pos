import { Router, Request, Response } from 'express';
import { pool } from '../server';

const router = Router();

// A helper function to get a full menu item with its recipe
const getFullMenuItem = async (client: any, id: string) => {
  const itemResult = await client.query(`
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
  `, [id]);
  const item = itemResult.rows[0];
  if (item) {
    item.recipe = item.recipe || []; // Ensure recipe is always an array
  }
  return item;
};


// GET all menu items
router.get('/', async (req: Request, res: Response) => {
  try {
    const result = await pool.query(`
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
      ORDER BY mi.category, mi.name;
    `);
    res.json(result.rows.map(row => ({ ...row, recipe: row.recipe || [] })));
  } catch (error) {
    console.error('Error fetching menu items:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// POST a new menu item
router.post('/', async (req: Request, res: Response) => {
  const { name, category, price, available, recipe } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const newItemResult = await client.query(
      'INSERT INTO menu_items (name, category, price, available) VALUES ($1, $2, $3, $4) RETURNING id',
      [name, category, price, available ?? true]
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

// PUT (update) an existing menu item
router.put('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, category, price, available, recipe } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      'UPDATE menu_items SET name = $1, category = $2, price = $3, available = $4, updated_at = NOW() WHERE id = $5',
      [name, category, price, available, id]
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