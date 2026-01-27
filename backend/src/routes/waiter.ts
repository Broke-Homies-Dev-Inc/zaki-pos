import { Router, Request, Response } from 'express';
import { pool } from '../server';

const router = Router();

// GET all waiters (including inactive if requested)
router.get('/', async (req: Request, res: Response) => {
  try {
    const { include_inactive } = req.query;
    
    let query = 'SELECT * FROM waiters';
    let params: string[] = [];
    
    if (include_inactive !== 'true') {
      query += ' WHERE status IN ($1, $2) ORDER BY name';
      params = ['active', 'on_break'];
    } else {
      query += ' ORDER BY name';
    }
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching waiters:', error);
    res.status(500).json({ message: 'Failed to fetch waiters' });
  }
});

// GET all waiters with statistics (including inactive if requested)
router.get('/with-stats', async (req: Request, res: Response) => {
  try {
    const { include_inactive } = req.query;
    
    let whereClause = '';
    let params: string[] = [];
    
    if (include_inactive !== 'true') {
      whereClause = 'WHERE w.status IN ($1, $2)';
      params = ['active', 'on_break'];
    }
    
    const result = await pool.query(`
      SELECT 
        w.id,
        w.name,
        w.employee_id,
        w.phone_number,
        w.status,
        w.created_at,
        w.updated_at,
        COUNT(o.id) FILTER (WHERE o.status = 'pending') AS active_orders,
        COUNT(o.id) FILTER (WHERE o.status = 'completed' AND o.created_at::date = CURRENT_DATE) AS completed_today,
        COALESCE(SUM(CASE WHEN o.status = 'completed' AND o.created_at::date = CURRENT_DATE THEN o.grand_total ELSE 0 END), 0) AS sales_today
      FROM waiters w
      LEFT JOIN orders o ON w.id = o.waiter_id
      ${whereClause}
      GROUP BY w.id, w.name, w.employee_id, w.phone_number, w.status, w.created_at, w.updated_at
      ORDER BY w.name
    `, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching waiters with stats:', error);
    res.status(500).json({ message: 'Failed to fetch waiters' });
  }
});

// GET waiter by ID with statistics
router.get('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const waiterResult = await pool.query('SELECT * FROM waiters WHERE id = $1', [id]);
    
    if (waiterResult.rows.length === 0) {
      return res.status(404).json({ message: 'Waiter not found' });
    }

    const waiter = waiterResult.rows[0];

    // Get statistics
    const statsResult = await pool.query(`
      SELECT 
        COUNT(*) as total_orders,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_orders,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as active_orders,
        COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_orders,
        COALESCE(SUM(CASE WHEN status = 'completed' THEN grand_total ELSE 0 END), 0) as total_sales,
        COALESCE(AVG(CASE WHEN status = 'completed' THEN grand_total END), 0) as avg_order_value
      FROM orders
      WHERE waiter_id = $1
    `, [id]);

    waiter.statistics = statsResult.rows[0];
    
    res.json(waiter);
  } catch (error) {
    console.error('Error fetching waiter:', error);
    res.status(500).json({ message: 'Failed to fetch waiter' });
  }
});

// POST create new waiter
router.post('/', async (req: Request, res: Response) => {
  const { name, employee_id, phone_number, status } = req.body;
  
  if (!name || !employee_id) {
    return res.status(400).json({ message: 'Name and employee ID are required' });
  }

  try {
    const result = await pool.query(
      'INSERT INTO waiters (name, employee_id, phone_number, status) VALUES ($1, $2, $3, $4) RETURNING *',
      [name, employee_id, phone_number, status || 'active']
    );
    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    if (error.code === '23505') { // Unique violation
      return res.status(400).json({ message: 'Employee ID already exists' });
    }
    console.error('Error creating waiter:', error);
    res.status(500).json({ message: 'Failed to create waiter' });
  }
});

// PUT update waiter
router.put('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, employee_id, phone_number, status } = req.body;
  
  if (!name || !employee_id) {
    return res.status(400).json({ message: 'Name and employee ID are required' });
  }

  try {
    const result = await pool.query(
      'UPDATE waiters SET name = $1, employee_id = $2, phone_number = $3, status = $4, updated_at = NOW() WHERE id = $5 RETURNING *',
      [name, employee_id, phone_number, status, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Waiter not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error: any) {
    if (error.code === '23505') {
      return res.status(400).json({ message: 'Employee ID already exists' });
    }
    console.error('Error updating waiter:', error);
    res.status(500).json({ message: 'Failed to update waiter' });
  }
});

// DELETE waiter (soft delete by setting status to inactive)
router.delete('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  
  try {
    // Check if waiter has any pending orders
    const pendingOrdersResult = await pool.query(
      "SELECT COUNT(*) as count FROM orders WHERE waiter_id = $1 AND status = 'pending'",
      [id]
    );
    
    if (parseInt(pendingOrdersResult.rows[0].count) > 0) {
      return res.status(400).json({ 
        message: 'Cannot deactivate waiter with pending orders' 
      });
    }

    const result = await pool.query(
      "UPDATE waiters SET status = 'inactive', updated_at = NOW() WHERE id = $1 RETURNING *",
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Waiter not found' });
    }
    
    res.json({ message: 'Waiter deactivated successfully', waiter: result.rows[0] });
  } catch (error) {
    console.error('Error deactivating waiter:', error);
    res.status(500).json({ message: 'Failed to deactivate waiter' });
  }
});

// GET waiter performance/dashboard
router.get('/:id/performance', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { startDate, endDate } = req.query;
  
  try {
    let query = `
      SELECT 
        COUNT(*) as total_orders,
        COUNT(CASE WHEN o.status = 'completed' THEN 1 END) as completed_orders,
        COUNT(CASE WHEN o.status = 'pending' THEN 1 END) as pending_orders,
        COUNT(CASE WHEN o.status = 'cancelled' THEN 1 END) as cancelled_orders,
        COALESCE(SUM(CASE WHEN o.status = 'completed' THEN o.grand_total ELSE 0 END), 0) as total_sales,
        COALESCE(AVG(CASE WHEN o.status = 'completed' THEN o.grand_total END), 0) as avg_order_value
      FROM orders o
      WHERE o.waiter_id = $1
    `;
    
    const params: any[] = [id];
    
    if (startDate) {
      params.push(startDate);
      query += ` AND o.created_at >= $${params.length}`;
    }
    
    if (endDate) {
      params.push(endDate);
      query += ` AND o.created_at <= $${params.length}`;
    }
    
    const result = await pool.query(query, params);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching waiter performance:', error);
    res.status(500).json({ message: 'Failed to fetch performance data' });
  }
});

// GET waiter's active orders
router.get('/:id/orders', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status } = req.query;
  
  try {
    let query = `
      SELECT 
        o.id,
        o.order_number,
        o.order_type,
        o.status,
        o.grand_total,
        o.created_at,
        o.updated_at,
        rt.name AS table_name,
        c.name AS customer_name,
        c.mobile_number
      FROM orders o
      LEFT JOIN restaurant_tables rt ON o.restaurant_table_id = rt.id
      LEFT JOIN customers c ON o.customer_id = c.id
      WHERE o.waiter_id = $1
    `;
    
    const params: any[] = [id];
    
    if (status) {
      params.push(status);
      query += ` AND o.status = $${params.length}`;
    }
    
    query += ` ORDER BY o.created_at DESC`;
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching waiter orders:', error);
    res.status(500).json({ message: 'Failed to fetch orders' });
  }
});

export default router;
