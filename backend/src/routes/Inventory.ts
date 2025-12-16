import { Router, Request, Response } from 'express';
import { pool } from '../server';

const router = Router();

// GET all inventory items
router.get('/', async (req: Request, res: Response) => {
  try {
    const result = await pool.query('SELECT * FROM inventory ORDER BY item_name');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching inventory items:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// POST a new inventory item
router.post('/', async (req: Request, res: Response) => {
  try {
    const { item_name, quantity, cost, low_stock_threshold } = req.body;
    const newItem = await pool.query(
      'INSERT INTO inventory (item_name, quantity, cost, low_stock_threshold) VALUES ($1, $2, $3, $4) RETURNING *',
      [item_name, quantity, cost, low_stock_threshold]
    );
    res.status(201).json(newItem.rows[0]);
  } catch (error) {
    console.error('Error creating inventory item:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// PUT (update) an existing inventory item
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { item_name, quantity, cost, low_stock_threshold } = req.body;
    const updatedItem = await pool.query(
      'UPDATE inventory SET item_name = $1, quantity = $2, cost = $3, low_stock_threshold = $4, updated_at = NOW() WHERE id = $5 RETURNING *',
      [item_name, quantity, cost, low_stock_threshold, id]
    );
    if (updatedItem.rows.length === 0) {
      return res.status(404).json({ message: 'Item not found' });
    }
    res.json(updatedItem.rows[0]);
  } catch (error) {
    console.error('Error updating inventory item:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// DELETE an inventory item
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM inventory WHERE id = $1', [id]);
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting inventory item:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

export default router;