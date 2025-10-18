import { Router, Request, Response } from 'express';
import { pool } from '../server';

const router = Router();

// GET dashboard statistics
router.get('/', async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    // Today's Revenue
    const todayRevenueResult = await client.query(
      `SELECT COALESCE(SUM(grand_total), 0) as revenue 
       FROM orders 
       WHERE created_at >= $1 AND created_at < $2 AND status != 'cancelled'`,
      [today, tomorrow]
    );

    // Yesterday's Revenue
    const yesterdayRevenueResult = await client.query(
      `SELECT COALESCE(SUM(grand_total), 0) as revenue 
       FROM orders 
       WHERE created_at >= $1 AND created_at < $2 AND status != 'cancelled'`,
      [yesterday, today]
    );

    // Today's Orders Count
    const todayOrdersResult = await client.query(
      `SELECT COUNT(*) as count 
       FROM orders 
       WHERE created_at >= $1 AND created_at < $2 AND status != 'cancelled'`,
      [today, tomorrow]
    );

    // Yesterday's Orders Count
    const yesterdayOrdersResult = await client.query(
      `SELECT COUNT(*) as count 
       FROM orders 
       WHERE created_at >= $1 AND created_at < $2 AND status != 'cancelled'`,
      [yesterday, today]
    );

    // New Customers Today
    const newCustomersResult = await client.query(
      `SELECT COUNT(*) as count 
       FROM customers 
       WHERE created_at >= $1 AND created_at < $2`,
      [today, tomorrow]
    );

    // New Customers This Hour
    const oneHourAgo = new Date();
    oneHourAgo.setHours(oneHourAgo.getHours() - 1);
    const customersThisHourResult = await client.query(
      `SELECT COUNT(*) as count 
       FROM customers 
       WHERE created_at >= $1`,
      [oneHourAgo]
    );

    // Pending Orders
    const pendingOrdersResult = await client.query(
      `SELECT COUNT(*) as count 
       FROM orders 
       WHERE status = 'pending'`
    );

    // Calculate percentage changes
    const todayRevenue = parseFloat(todayRevenueResult.rows[0].revenue);
    const yesterdayRevenue = parseFloat(yesterdayRevenueResult.rows[0].revenue);
    
    let revenueChange: string;
    if (yesterdayRevenue === 0) {
      if (todayRevenue > 0) {
        revenueChange = 'First sales today!';
      } else {
        revenueChange = 'No sales yet';
      }
    } else {
      const revenueChangeNum = ((todayRevenue - yesterdayRevenue) / yesterdayRevenue * 100);
      const sign = revenueChangeNum > 0 ? '+' : '';
      revenueChange = `${sign}${revenueChangeNum.toFixed(1)}% from yesterday`;
    }

    const todayOrders = parseInt(todayOrdersResult.rows[0].count);
    const yesterdayOrders = parseInt(yesterdayOrdersResult.rows[0].count);
    
    let ordersChange: string;
    if (yesterdayOrders === 0) {
      if (todayOrders > 0) {
        ordersChange = `${todayOrders} ${todayOrders === 1 ? 'order' : 'orders'} today`;
      } else {
        ordersChange = 'No orders yet';
      }
    } else {
      const ordersChangeNum = ((todayOrders - yesterdayOrders) / yesterdayOrders * 100);
      const sign = ordersChangeNum > 0 ? '+' : '';
      ordersChange = `${sign}${ordersChangeNum.toFixed(1)}% from yesterday`;
    }

    const stats = {
      todayRevenue: todayRevenue,
      revenueChange: revenueChange,
      todayOrders: todayOrders,
      ordersChange: ordersChange,
      newCustomers: parseInt(newCustomersResult.rows[0].count),
      customersThisHour: parseInt(customersThisHourResult.rows[0].count),
      pendingOrders: parseInt(pendingOrdersResult.rows[0].count),
    };

    res.json(stats);
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ message: 'Failed to fetch dashboard statistics' });
  } finally {
    client.release();
  }
});

// GET revenue chart data
router.get('/revenue-chart', async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    const { period, startDate, endDate } = req.query;
    
    let query = '';
    let params: any[] = [];
    
    if (period === 'weekly') {
      // Last 7 days
      query = `
        SELECT 
          DATE(created_at) as date,
          COALESCE(SUM(grand_total), 0) as revenue,
          COUNT(*) as orders
        FROM orders
        WHERE created_at >= NOW() - INTERVAL '7 days'
          AND status != 'cancelled'
        GROUP BY DATE(created_at)
        ORDER BY date ASC
      `;
    } else if (period === 'monthly') {
      // Last 30 days
      query = `
        SELECT 
          DATE(created_at) as date,
          COALESCE(SUM(grand_total), 0) as revenue,
          COUNT(*) as orders
        FROM orders
        WHERE created_at >= NOW() - INTERVAL '30 days'
          AND status != 'cancelled'
        GROUP BY DATE(created_at)
        ORDER BY date ASC
      `;
    } else if (period === 'custom' && startDate && endDate) {
      // Custom date range
      const start = new Date(startDate as string);
      const end = new Date(endDate as string);
      end.setHours(23, 59, 59, 999);
      
      query = `
        SELECT 
          DATE(created_at) as date,
          COALESCE(SUM(grand_total), 0) as revenue,
          COUNT(*) as orders
        FROM orders
        WHERE created_at >= $1 AND created_at <= $2
          AND status != 'cancelled'
        GROUP BY DATE(created_at)
        ORDER BY date ASC
      `;
      params = [start, end];
    } else {
      return res.status(400).json({ message: 'Invalid period or missing date range' });
    }

    const result = await client.query(query, params);
    
    // Format the data
    const chartData = result.rows.map(row => ({
      date: new Date(row.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      revenue: parseFloat(row.revenue),
      orders: parseInt(row.orders)
    }));

    res.json(chartData);
  } catch (error) {
    console.error('Error fetching revenue chart data:', error);
    res.status(500).json({ message: 'Failed to fetch revenue chart data' });
  } finally {
    client.release();
  }
});

export default router;
