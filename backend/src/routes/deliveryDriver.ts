import { Router, Request, Response } from 'express';
import { pool } from '../server';

const router = Router();

// GET all delivery drivers (including inactive if requested)
router.get('/', async (req: Request, res: Response) => {
  try {
    const { include_inactive } = req.query;
    
    let query = 'SELECT * FROM delivery_drivers';
    let params: string[] = [];
    
    if (include_inactive !== 'true') {
      query += ' WHERE status IN ($1, $2, $3) ORDER BY name';
      params = ['active', 'on_delivery', 'on_break'];
    } else {
      query += ' ORDER BY name';
    }
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching delivery drivers:', error);
    res.status(500).json({ message: 'Failed to fetch delivery drivers' });
  }
});

// GET all delivery drivers with statistics (including inactive if requested)
router.get('/with-stats', async (req: Request, res: Response) => {
  try {
    const { include_inactive } = req.query;
    
    let whereClause = '';
    let params: string[] = [];
    
    if (include_inactive !== 'true') {
      whereClause = 'WHERE db.status IN ($1, $2, $3)';
      params = ['active', 'on_delivery', 'on_break'];
    }
    
    const result = await pool.query(`
      SELECT 
        db.id,
        db.name,
        db.employee_id,
        db.phone_number,
        db.vehicle_type,
        db.vehicle_number,
        db.status,
        db.created_at,
        db.updated_at,
        COUNT(o.id) FILTER (WHERE o.status IN ('pending', 'preparing') AND o.order_type = 'delivery') AS active_orders,
        COUNT(o.id) FILTER (WHERE o.status = 'completed' AND o.order_type = 'delivery' AND o.created_at::date = CURRENT_DATE) AS completed_today,
        COALESCE(SUM(CASE WHEN o.status = 'completed' AND o.order_type = 'delivery' AND o.created_at::date = CURRENT_DATE THEN o.grand_total ELSE 0 END), 0) AS sales_today
      FROM delivery_drivers db
      LEFT JOIN orders o ON db.id = o.delivery_driver_id
      ${whereClause}
      GROUP BY db.id, db.name, db.employee_id, db.phone_number, db.vehicle_type, db.vehicle_number, db.status, db.created_at, db.updated_at
      ORDER BY db.name
    `, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching delivery drivers with stats:', error);
    res.status(500).json({ message: 'Failed to fetch delivery drivers' });
  }
});

// GET delivery driver by ID with statistics
router.get('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const deliveryDriverResult = await pool.query('SELECT * FROM delivery_drivers WHERE id = $1', [id]);
    
    if (deliveryDriverResult.rows.length === 0) {
      return res.status(404).json({ message: 'Delivery driver not found' });
    }

    const deliveryDriver = deliveryDriverResult.rows[0];

    // Get statistics
    const statsResult = await pool.query(`
      SELECT 
        COUNT(*) as total_orders,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_orders,
        COUNT(CASE WHEN status IN ('pending', 'preparing') THEN 1 END) as active_orders,
        COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_orders,
        COALESCE(SUM(CASE WHEN status = 'completed' THEN grand_total ELSE 0 END), 0) as total_sales,
        COALESCE(AVG(CASE WHEN status = 'completed' THEN grand_total END), 0) as avg_order_value
      FROM orders
      WHERE delivery_driver_id = $1 AND order_type = 'delivery'
    `, [id]);

    deliveryDriver.statistics = statsResult.rows[0];
    
    res.json(deliveryDriver);
  } catch (error) {
    console.error('Error fetching delivery driver:', error);
    res.status(500).json({ message: 'Failed to fetch delivery driver' });
  }
});

// POST create new delivery driver
router.post('/', async (req: Request, res: Response) => {
  const { name, employee_id, phone_number, vehicle_type, vehicle_number, status } = req.body;
  
  if (!name || !employee_id) {
    return res.status(400).json({ message: 'Name and employee ID are required' });
  }

  try {
    const result = await pool.query(
      'INSERT INTO delivery_drivers (name, employee_id, phone_number, vehicle_type, vehicle_number, status) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [name, employee_id, phone_number, vehicle_type, vehicle_number, status || 'active']
    );
    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    if (error.code === '23505') { // Unique violation
      return res.status(400).json({ message: 'Employee ID already exists' });
    }
    console.error('Error creating delivery driver:', error);
    res.status(500).json({ message: 'Failed to create delivery driver' });
  }
});

// PUT update delivery driver
router.put('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, employee_id, phone_number, vehicle_type, vehicle_number, status } = req.body;
  
  if (!name || !employee_id) {
    return res.status(400).json({ message: 'Name and employee ID are required' });
  }

  try {
    const result = await pool.query(
      'UPDATE delivery_drivers SET name = $1, employee_id = $2, phone_number = $3, vehicle_type = $4, vehicle_number = $5, status = $6, updated_at = NOW() WHERE id = $7 RETURNING *',
      [name, employee_id, phone_number, vehicle_type, vehicle_number, status, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Delivery driver not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error: any) {
    if (error.code === '23505') {
      return res.status(400).json({ message: 'Employee ID already exists' });
    }
    console.error('Error updating delivery driver:', error);
    res.status(500).json({ message: 'Failed to update delivery driver' });
  }
});

// DELETE delivery driver (soft delete by setting status to inactive)
router.delete('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  
  try {
    // Check if delivery driver has any pending orders
    const pendingOrdersResult = await pool.query(
      "SELECT COUNT(*) as count FROM orders WHERE delivery_driver_id = $1 AND status IN ('pending', 'preparing') AND order_type = 'delivery'",
      [id]
    );
    
    if (parseInt(pendingOrdersResult.rows[0].count) > 0) {
      return res.status(400).json({ 
        message: 'Cannot deactivate delivery driver with pending orders' 
      });
    }

    const result = await pool.query(
      "UPDATE delivery_drivers SET status = 'inactive', updated_at = NOW() WHERE id = $1 RETURNING *",
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Delivery driver not found' });
    }
    
    res.json({ message: 'Delivery driver deactivated successfully', deliveryDriver: result.rows[0] });
  } catch (error) {
    console.error('Error deactivating delivery driver:', error);
    res.status(500).json({ message: 'Failed to deactivate delivery driver' });
  }
});

// GET delivery driver performance/dashboard
router.get('/:id/performance', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { startDate, endDate } = req.query;
  
  try {
    let query = `
      SELECT 
        COUNT(*) as total_orders,
        COUNT(CASE WHEN o.status = 'completed' THEN 1 END) as completed_orders,
        COUNT(CASE WHEN o.status IN ('pending', 'preparing') THEN 1 END) as pending_orders,
        COUNT(CASE WHEN o.status = 'cancelled' THEN 1 END) as cancelled_orders,
        COALESCE(SUM(CASE WHEN o.status = 'completed' THEN o.grand_total ELSE 0 END), 0) as total_sales,
        COALESCE(AVG(CASE WHEN o.status = 'completed' THEN o.grand_total END), 0) as avg_order_value
      FROM orders o
      WHERE o.delivery_driver_id = $1 AND o.order_type = 'delivery'
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
    console.error('Error fetching delivery driver performance:', error);
    res.status(500).json({ message: 'Failed to fetch performance data' });
  }
});

// GET delivery driver's orders
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
        o.delivery_address,
        o.created_at,
        o.updated_at,
        c.name AS customer_name,
        c.mobile_number
      FROM orders o
      LEFT JOIN customers c ON o.customer_id = c.id
      WHERE o.delivery_driver_id = $1 AND o.order_type = 'delivery'
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
    console.error('Error fetching delivery driver orders:', error);
    res.status(500).json({ message: 'Failed to fetch orders' });
  }
});

// GET available delivery drivers (not on delivery and active)
router.get('/available/list', async (req: Request, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT 
        db.id,
        db.name,
        db.employee_id,
        db.phone_number,
        db.vehicle_type,
        db.vehicle_number,
        db.status,
        COUNT(o.id) FILTER (WHERE o.status IN ('pending', 'preparing')) AS active_orders
      FROM delivery_drivers db
      LEFT JOIN orders o ON db.id = o.delivery_driver_id AND o.order_type = 'delivery'
      WHERE db.status = 'active'
      GROUP BY db.id, db.name, db.employee_id, db.phone_number, db.vehicle_type, db.vehicle_number, db.status
      ORDER BY active_orders ASC, db.name
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching available delivery drivers:', error);
    res.status(500).json({ message: 'Failed to fetch available delivery drivers' });
  }
});

export default router;
