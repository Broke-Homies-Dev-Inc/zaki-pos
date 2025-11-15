import { Router, Request, Response } from 'express';
import { pool } from '../server';

const router = Router();

// GET all VERIFIED customers
router.get('/', async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT 
        c.id, 
        c.name, 
        c.mobile_number, 
        c.loyalty_points, 
        c.status,
        c.created_at,
        COUNT(DISTINCT o.id) as total_orders,
        COALESCE(SUM(o.grand_total), 0) as total_spent
       FROM customers c
       LEFT JOIN orders o ON c.id = o.customer_id
       WHERE c.status = 'verified'
       GROUP BY c.id, c.name, c.mobile_number, c.loyalty_points, c.status, c.created_at
       ORDER BY c.created_at DESC`
    );
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching customers:', error);
    res.status(500).json({ message: 'Failed to fetch customers' });
  } finally {
    client.release();
  }
});

// GET customer loyalty points and history
router.get('/:customerId/loyalty', async (req: Request, res: Response) => {
  const { customerId } = req.params;
  const client = await pool.connect();
  try {
    // Get customer points
    const customerResult = await client.query(
      'SELECT id, name, mobile_number, loyalty_points, status FROM customers WHERE id = $1',
      [customerId]
    );
    
    if (customerResult.rows.length === 0) {
      return res.status(404).json({ message: 'Customer not found' });
    }
    
    const customer = customerResult.rows[0];
    
    // Get transaction history
    const transactionsResult = await client.query(
      `SELECT * FROM loyalty_transactions 
       WHERE customer_id = $1 
       ORDER BY created_at DESC 
       LIMIT 20`,
      [customerId]
    );
    
    res.json({
      customer,
      transactions: transactionsResult.rows
    });
  } catch (error) {
    console.error('Error fetching loyalty data:', error);
    res.status(500).json({ message: 'Failed to fetch loyalty data' });
  } finally {
    client.release();
  }
});

// GET customer by phone number
router.get('/phone/:phone', async (req: Request, res: Response) => {
  const { phone } = req.params;
  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT id, name, mobile_number, loyalty_points, status, created_at FROM customers WHERE mobile_number = $1',
      [phone]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Customer not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching customer:', error);
    res.status(500).json({ message: 'Failed to fetch customer' });
  } finally {
    client.release();
  }
});

export default router;
