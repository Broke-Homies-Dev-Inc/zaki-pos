import { Router, Request, Response } from 'express';
import { pool } from '../server';

const router = Router();

// GET restaurant settings (name, address, phone, registration number, tax rate, loyalty, print preview, points value)
router.get('/settings', async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    const result = await client.query('SELECT id, restaurant_name, address, contact_number, registration_number, tax_rate, loyalty_points_enabled, loyalty_points_per_100, points_value, print_preview_enabled FROM restaurant_settings LIMIT 1');
    if (result.rows.length === 0) {
      // Return default values if no settings exist
      return res.json({
        restaurant_name: 'Restaurant Name',
        address: 'Restaurant Address',
        contact_number: 'Phone Number',
        registration_number: '',
        tax_rate: 0,
        loyalty_points_enabled: true,
        loyalty_points_per_100: 10,
        points_value: 0.1,
        print_preview_enabled: true
      });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching restaurant settings:', error);
    // Return defaults on error
    res.json({
      restaurant_name: 'Restaurant Name',
      address: 'Restaurant Address',
      contact_number: 'Phone Number',
      registration_number: '',
      tax_rate: 0,
      loyalty_points_enabled: true,
      loyalty_points_per_100: 10,
      points_value: 0.1,
      print_preview_enabled: true
    });
  } finally {
    client.release();
  }
});

// PUT/POST update restaurant settings
router.post('/settings', async (req: Request, res: Response) => {
  const { restaurant_name, address, contact_number, registration_number, tax_rate, loyalty_points_enabled, loyalty_points_per_100, points_value, print_preview_enabled } = req.body;
  const client = await pool.connect();
  try {
    // Check if settings exist
    const checkResult = await client.query('SELECT id FROM restaurant_settings LIMIT 1');
    
    let result;
    if (checkResult.rows.length === 0) {
      // Insert new settings
      result = await client.query(
        'INSERT INTO restaurant_settings (restaurant_name, address, contact_number, registration_number, tax_rate, loyalty_points_enabled, loyalty_points_per_100, points_value, print_preview_enabled) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *',
        [restaurant_name, address, contact_number, registration_number || '', tax_rate || 0, loyalty_points_enabled !== undefined ? loyalty_points_enabled : true, loyalty_points_per_100 || 10, points_value || 0.1, print_preview_enabled !== undefined ? print_preview_enabled : true]
      );
    } else {
      // Update existing settings
      result = await client.query(
        'UPDATE restaurant_settings SET restaurant_name = $1, address = $2, contact_number = $3, registration_number = $4, tax_rate = $5, loyalty_points_enabled = $6, loyalty_points_per_100 = $7, points_value = $8, print_preview_enabled = $9 WHERE id = $10 RETURNING *',
        [restaurant_name, address, contact_number, registration_number || '', tax_rate || 0, loyalty_points_enabled !== undefined ? loyalty_points_enabled : true, loyalty_points_per_100 || 10, points_value || 0.1, print_preview_enabled !== undefined ? print_preview_enabled : true, checkResult.rows[0].id]
      );
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating restaurant settings:', error);
    res.status(500).json({ message: 'Failed to update restaurant settings' });
  } finally {
    client.release();
  }
});

// --- TYPE DEFINITIONS for clarity ---
interface ActiveOrder {
  order_id: string;
  order_number: string;
  grand_total: number;
  status: string;
  created_at: string;
}

interface Table {
  table_id: string;
  table_name: string;
  table_status: string;
  active_order: ActiveOrder | null;
}

interface Section {
  section_id: string;
  section_name: string;
  tables: Table[];
}

interface Floor {
  floor_id: string;
  floor_name: string;
  sections: Section[];
}

// GET all layout data with active order info
router.get('/layout', async (req: Request, res: Response) => {
    const client = await pool.connect();
    try {
  // Some installations may not have timestamp columns on these small lookup tables.
  // Order by name instead of a non-guaranteed `created_at` column to avoid SQL errors.
  const floorsResult = await client.query('SELECT id as floor_id, name as floor_name FROM floors ORDER BY name');
  const sectionsResult = await client.query('SELECT id as section_id, name as section_name, floor_id FROM sections ORDER BY name');
        
        // THIS IS THE CRITICAL QUERY FOR THE BILLING PAGE
        const tablesResult = await client.query(`
      SELECT 
        rt.id AS table_id, 
        rt.section_id, 
        rt.name AS table_name,
        rt.status AS table_status,
                o.id AS active_order_id,
                o.order_number AS active_order_number,
                o.grand_total AS active_order_grand_total,
                o.status AS active_order_status,
                o.created_at AS active_order_created_at
      FROM restaurant_tables rt
            LEFT JOIN (
        SELECT *, ROW_NUMBER() OVER(PARTITION BY restaurant_table_id ORDER BY orders.created_at DESC) as rn
        FROM orders 
                WHERE status = 'pending'
            ) o ON o.restaurant_table_id = rt.id AND o.rn = 1
      ORDER BY rt.name;
        `);

        const layout: Floor[] = floorsResult.rows.map(floor => ({
            ...floor,
            sections: sectionsResult.rows
                .filter(s => s.floor_id === floor.floor_id)
                .map(section => ({
                    ...section,
                    tables: tablesResult.rows
                        .filter(t => t.section_id === section.section_id)
            .map(table => {
                            // Determine actual status from database
                            // Keep 'cleaning' and other statuses intact, only default NULL to 'available'
                            let actualStatus = table.table_status || 'available';
                            
                            // Only override status to 'available' if:
                            // 1. No active order AND
                            // 2. Status is 'occupied' or 'bill_printed' (not cleaning!)
                            if (!table.active_order_id && 
                                (actualStatus === 'occupied' || actualStatus === 'bill_printed')) {
                                actualStatus = 'available';
                            }
                            
                            return {
                                table_id: table.table_id,
                                table_name: table.table_name,
                                table_status: actualStatus,
                                active_order: table.active_order_id ? {
                                    order_id: table.active_order_id,
                                    order_number: table.active_order_number,
                                    grand_total: parseFloat(table.active_order_grand_total),
                                    status: table.active_order_status,
                                    created_at: table.active_order_created_at
                                } : null
                            };
                        })
                }))
        }));
        
        res.json(layout);
    } catch (error) {
        console.error('---!!! ERROR Fetching Layout !!!---:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    } finally {
        client.release();
    }
});

// POST a new floor
router.post('/floors', async (req: Request, res: Response) => {
    const { name } = req.body;
    await pool.query('INSERT INTO floors (name) VALUES ($1)', [name]);
    res.status(201).send();
});

// POST a new section
router.post('/sections', async (req: Request, res: Response) => {
    const { name, floor_id } = req.body;
    await pool.query('INSERT INTO sections (name, floor_id) VALUES ($1, $2)', [name, floor_id]);
    res.status(201).send();
});

// POST a new table
router.post('/tables', async (req: Request, res: Response) => {
    const { name, section_id } = req.body;
    await pool.query('INSERT INTO restaurant_tables (name, section_id) VALUES ($1, $2)', [name, section_id]);
    res.status(201).send();
});

// DELETE a floor
router.delete('/floors/:id', async (req: Request, res: Response) => {
    const { id } = req.params;
    await pool.query('DELETE FROM floors WHERE id = $1', [id]);
    res.status(204).send();
});

// DELETE a section
router.delete('/sections/:id', async (req: Request, res: Response) => {
    const { id } = req.params;
    await pool.query('DELETE FROM sections WHERE id = $1', [id]);
    res.status(204).send();
});

// DELETE a table
router.delete('/tables/:id', async (req: Request, res: Response) => {
    const { id } = req.params;
    await pool.query('DELETE FROM restaurant_tables WHERE id = $1', [id]);
    res.status(204).send();
});

// PUT update a table's status
router.put('/tables/:id/status', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status } = req.body;
  const client = await pool.connect();
  try {
      const result = await client.query(
          'UPDATE restaurant_tables SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *;',
          [status, id]
      );
      if (result.rows.length === 0) {
          return res.status(404).json({ message: 'Table not found' });
      }
      res.json(result.rows[0]);
  } catch (error) {
      console.error('Error updating table status:', error);
      res.status(500).json({ message: 'Failed to update table status' });
  } finally {
      client.release();
  }
});

// PUT complete an order and update table status
router.put('/orders/:orderId/complete', async (req: Request, res: Response) => {
  const { orderId } = req.params;
  const { tableId, status, pointsRedeemed = 0, finalAmount } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const orderUpdateResult = await client.query('UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *;', [status, orderId]);
    if (orderUpdateResult.rows.length === 0) throw new Error('Order not found');
    const order = orderUpdateResult.rows[0];
    
    if (status === 'completed') {
      const orderItemsResult = await client.query('SELECT * FROM order_items WHERE order_id = $1', [orderId]);
      for (const item of orderItemsResult.rows) {
        const recipeResult = await client.query('SELECT * FROM recipes WHERE menu_item_id = $1', [item.menu_item_id]);
        for (const ingredient of recipeResult.rows) {
          const quantityToDeduct = Number(item.quantity) * Number(ingredient.quantity_used);
          await client.query('UPDATE inventory SET quantity = quantity - $1 WHERE id = $2', [quantityToDeduct, ingredient.inventory_item_id]);
        }
      }
      
      // Handle loyalty points redemption and earning
      if (order.customer_id) {
        const settingsResult = await client.query('SELECT loyalty_points_enabled, loyalty_points_per_100, points_value FROM restaurant_settings LIMIT 1');
        if (settingsResult.rows.length > 0) {
          const { loyalty_points_enabled, loyalty_points_per_100, points_value } = settingsResult.rows[0];
          
          if (loyalty_points_enabled) {
            // 1. REDEEM POINTS (if any)
            if (pointsRedeemed > 0) {
              // Verify customer has enough points
              const customerResult = await client.query('SELECT loyalty_points FROM customers WHERE id = $1', [order.customer_id]);
              if (customerResult.rows.length > 0) {
                const currentPoints = customerResult.rows[0].loyalty_points;
                if (currentPoints >= pointsRedeemed && pointsRedeemed >= 200) {
                  // Deduct redeemed points
                  await client.query('UPDATE customers SET loyalty_points = loyalty_points - $1 WHERE id = $2', [pointsRedeemed, order.customer_id]);
                  
                  // Record redemption transaction
                  // Use dynamic points_value from settings (default: 0.1 means 10 points = ₹1)
                  const pointsValueAmount = pointsRedeemed * (parseFloat(points_value) || 0.1);
                  await client.query(
                    'INSERT INTO loyalty_transactions (customer_id, order_id, points_redeemed, transaction_type, description, order_amount) VALUES ($1, $2, $3, $4, $5, $6)',
                    [order.customer_id, orderId, pointsRedeemed, 'redeemed', `Redeemed ${pointsRedeemed} points (₹${pointsValueAmount.toFixed(2)}) for order`, order.grand_total]
                  );
                }
              }
            }
            
            // 2. EARN POINTS (based on final amount paid, not the original bill)
            const amountForPoints = finalAmount !== undefined ? parseFloat(finalAmount.toString()) : parseFloat(order.grand_total);
            if (amountForPoints > 0) {
              // Calculate points: (amount_paid / 100) * loyalty_points_per_100
              const pointsEarned = Math.floor((amountForPoints / 100) * loyalty_points_per_100);
              if (pointsEarned > 0) {
                // Update customer loyalty points (add earned points)
                await client.query('UPDATE customers SET loyalty_points = loyalty_points + $1 WHERE id = $2', [pointsEarned, order.customer_id]);
                
                // Record earning transaction
                await client.query(
                  'INSERT INTO loyalty_transactions (customer_id, order_id, points_earned, transaction_type, description, order_amount) VALUES ($1, $2, $3, $4, $5, $6)',
                  [order.customer_id, orderId, pointsEarned, 'earned', `Earned ${pointsEarned} points from order (paid: ₹${amountForPoints.toFixed(2)})`, amountForPoints]
                );
              }
            }
          }
        }
      }
    }

    // Set table to 'cleaning' when order is completed, then schedule reset to 'available' after 2 minutes
    if (tableId && status === 'completed') {
      await client.query("UPDATE restaurant_tables SET status = 'cleaning', updated_at = NOW() WHERE id = $1;", [tableId]);
      
      // Schedule table to be reset to 'available' after 2 minutes (120 seconds)
      setTimeout(async () => {
        const cleanupClient = await pool.connect();
        try {
          await cleanupClient.query(
            "UPDATE restaurant_tables SET status = 'available', updated_at = NOW() WHERE id = $1 AND status = 'cleaning';",
            [tableId]
          );
          console.log(`✅ Table ${tableId} reset to 'available' after cleaning period`);
        } catch (error) {
          console.error(`❌ Error resetting table ${tableId}:`, error);
        } finally {
          cleanupClient.release();
        }
      }, 120000); // 2 minutes in milliseconds
    }

    await client.query('COMMIT');
    const finalOrderResult = await client.query(`
        SELECT o.*, c.name as customer_name, c.mobile_number,
               (SELECT json_agg(json_build_object('menu_item_name', mi.name, 'quantity', oi.quantity, 'id', oi.id, 'unit_price', oi.unit_price, 'total_price', oi.total_price)) 
                FROM order_items oi JOIN menu_items mi ON mi.id = oi.menu_item_id WHERE oi.order_id = o.id) as order_items
        FROM orders o LEFT JOIN customers c ON o.customer_id = c.id WHERE o.id = $1;
    `, [orderId]);
    res.json({ ...finalOrderResult.rows[0], order_items: finalOrderResult.rows[0].order_items || [] });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error completing order:', error);
    res.status(500).json({ message: 'Failed to complete order' });
  } finally {
    client.release();
  }
});

export default router;