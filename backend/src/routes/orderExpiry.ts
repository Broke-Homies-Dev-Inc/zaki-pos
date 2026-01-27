// backend/src/routes/orderExpiry.ts
import { Router, Request, Response } from 'express';
import { pool } from '../server';

const router = Router();

// POST /api/order-expiry/check-and-expire
// Check for expired orders and automatically clean them up
router.post('/check-and-expire', async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Get the order expiry time setting (in minutes)
    const settingsResult = await client.query(
      'SELECT order_expiry_time FROM restaurant_settings LIMIT 1'
    );
    const expiryTime = settingsResult.rows[0]?.order_expiry_time || 60; // Default 60 minutes

    console.log(`🕐 Checking for orders older than ${expiryTime} minutes...`);

    // 2. Find all orders that are pending or confirmed and older than expiry time
    const expiredOrdersResult = await client.query(
      `SELECT o.id, o.restaurant_table_id, o.order_type
       FROM orders o
       WHERE o.status IN ('pending', 'confirmed')
       AND o.created_at < NOW() - INTERVAL '1 minute' * $1`,
      [expiryTime]
    );

    const expiredOrders = expiredOrdersResult.rows;

    if (expiredOrders.length === 0) {
      console.log('✅ No expired orders found');
      await client.query('COMMIT');
      return res.json({
        success: true,
        message: 'No expired orders found',
        expiredCount: 0,
      });
    }

    console.log(`⚠️  Found ${expiredOrders.length} expired order(s)`);

    // 3. Process each expired order
    for (const order of expiredOrders) {
      console.log(`📋 Expiring order ${order.id}...`);

      // Mark order as expired
      await client.query(
        "UPDATE orders SET status = 'expired', updated_at = NOW() WHERE id = $1",
        [order.id]
      );

      // If it's a dine-in order with a table, free the table and remove combinations
      if (order.order_type === 'dine_in' && order.restaurant_table_id) {
        // Check if this table is part of a combination
        const tableResult = await client.query(
          'SELECT id, linked_order_id FROM restaurant_tables WHERE id = $1',
          [order.restaurant_table_id]
        );

        if (tableResult.rows.length > 0) {
          const table = tableResult.rows[0];

          // If the table has a linked order, find all tables in the combination
          if (table.linked_order_id) {
            // Get all tables linked to this order
            const linkedTablesResult = await client.query(
              'SELECT id FROM restaurant_tables WHERE linked_order_id = $1',
              [table.linked_order_id]
            );

            const linkedTableIds = linkedTablesResult.rows.map(row => row.id);

            if (linkedTableIds.length > 0) {
              // Separate all linked tables and mark as available
              await client.query(
                `UPDATE restaurant_tables 
                 SET status = 'available', linked_order_id = NULL, updated_at = NOW() 
                 WHERE id = ANY($1::uuid[])`,
                [linkedTableIds]
              );
              console.log(`   ✅ Freed and separated ${linkedTableIds.length} linked table(s)`);
            }
          } else {
            // Just a single table, mark it as available
            await client.query(
              "UPDATE restaurant_tables SET status = 'available', updated_at = NOW() WHERE id = $1",
              [order.restaurant_table_id]
            );
            console.log(`   ✅ Freed table ${order.restaurant_table_id}`);
          }
        }
      }
    }

    await client.query('COMMIT');

    // Emit WebSocket event for order expiry
    try {
      const { getIO } = await import('../websocket');
      getIO().emit('orders:expired', {
        expiredOrderIds: expiredOrders.map(o => o.id),
        count: expiredOrders.length,
      });
    } catch (err) {
      console.warn('WebSocket not available:', err);
    }

    console.log(`✅ Successfully expired ${expiredOrders.length} order(s)`);

    res.json({
      success: true,
      message: `Expired ${expiredOrders.length} order(s)`,
      expiredCount: expiredOrders.length,
      expiredOrderIds: expiredOrders.map(o => o.id),
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error expiring orders:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to expire orders',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  } finally {
    client.release();
  }
});

// GET /api/order-expiry/status
// Get information about potentially expired orders
router.get('/status', async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    // Get the order expiry time setting
    const settingsResult = await client.query(
      'SELECT order_expiry_time FROM restaurant_settings LIMIT 1'
    );
    const expiryTime = settingsResult.rows[0]?.order_expiry_time || 60;

    // Find orders approaching expiry
    const ordersResult = await client.query(
      `SELECT 
         o.id, 
         o.order_type,
         o.status,
         o.created_at,
         EXTRACT(EPOCH FROM (NOW() - o.created_at)) / 60 AS age_minutes,
         $1 - EXTRACT(EPOCH FROM (NOW() - o.created_at)) / 60 AS minutes_until_expiry
       FROM orders o
       WHERE o.status IN ('pending', 'confirmed')
       ORDER BY o.created_at ASC`,
      [expiryTime]
    );

    const orders = ordersResult.rows.map(order => ({
      ...order,
      age_minutes: Math.floor(Number(order.age_minutes)),
      minutes_until_expiry: Math.max(0, Math.floor(Number(order.minutes_until_expiry))),
      is_expired: Number(order.minutes_until_expiry) <= 0,
    }));

    res.json({
      expiry_time_minutes: expiryTime,
      active_orders: orders,
      expired_count: orders.filter(o => o.is_expired).length,
      approaching_expiry_count: orders.filter(o => !o.is_expired && o.minutes_until_expiry < 10).length,
    });

  } catch (error) {
    console.error('Error fetching order expiry status:', error);
    res.status(500).json({
      message: 'Failed to fetch order expiry status',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  } finally {
    client.release();
  }
});

// POST /api/order-expiry/clear-all-pending
// Clear all pending and confirmed orders, free all tables, remove all combinations
router.post('/clear-all-pending', async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    console.log('🧹 Starting to clear all pending orders...');

    // 1. Find all pending and confirmed orders
    const ordersResult = await client.query(
      `SELECT id, order_type, restaurant_table_id 
       FROM orders 
       WHERE status IN ('pending', 'confirmed')`
    );

    const orders = ordersResult.rows;
    const orderCount = orders.length;

    if (orderCount === 0) {
      console.log('✅ No pending orders to clear');
      await client.query('COMMIT');
      return res.json({
        success: true,
        message: 'No pending orders to clear',
        ordersCleared: 0,
        tablesFreed: 0,
        combinationsRemoved: 0,
      });
    }

    console.log(`⚠️  Found ${orderCount} pending/confirmed order(s) to clear`);

    // 2. Get all unique linked_order_ids for combinations
    const combinationsResult = await client.query(
      `SELECT DISTINCT linked_order_id 
       FROM restaurant_tables 
       WHERE linked_order_id IS NOT NULL`
    );
    const combinationsCount = combinationsResult.rows.length;

    // 3. Expire all pending and confirmed orders
    await client.query(
      `UPDATE orders 
       SET status = 'expired', updated_at = NOW() 
       WHERE status IN ('pending', 'confirmed')`
    );
    console.log(`   ✅ Expired ${orderCount} order(s)`);

    // 4. Free all tables and remove all combinations
    const tablesResult = await client.query(
      `UPDATE restaurant_tables 
       SET status = 'available', 
           linked_order_id = NULL, 
           updated_at = NOW() 
       WHERE status != 'available' OR linked_order_id IS NOT NULL
       RETURNING id`
    );
    const tablesFreed = tablesResult.rows.length;
    console.log(`   ✅ Freed ${tablesFreed} table(s) and removed all combinations`);

    await client.query('COMMIT');

    // Emit WebSocket event for clearing all orders
    try {
      const { getIO } = await import('../websocket');
      getIO().emit('orders:all-cleared', {
        ordersCleared: orderCount,
        tablesFreed,
        combinationsRemoved: combinationsCount,
      });
    } catch (err) {
      console.warn('WebSocket not available:', err);
    }

    console.log(`✅ Successfully cleared all pending orders and reset dining area`);

    res.json({
      success: true,
      message: `Successfully cleared ${orderCount} order(s) and freed ${tablesFreed} table(s)`,
      ordersCleared: orderCount,
      tablesFreed,
      combinationsRemoved: combinationsCount,
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error clearing all pending orders:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to clear pending orders',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  } finally {
    client.release();
  }
});

export default router;
