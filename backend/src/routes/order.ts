import { Router, Request, Response } from 'express';
import { pool } from '../server';
import * as htmlPdf from 'html-pdf-node';
import * as fs from 'fs';
import * as path from 'path';

const router = Router();

// GET all orders
router.get('/', async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    const { date, orderType } = req.query;
    let baseQuery = `
      SELECT o.*, c.name AS customer_name, c.mobile_number, rt.name AS table_name, s.name AS section_name, f.name AS floor_name
      FROM orders o
      LEFT JOIN customers c ON o.customer_id = c.id
      LEFT JOIN restaurant_tables rt ON o.restaurant_table_id = rt.id
      LEFT JOIN sections s ON rt.section_id = s.id
      LEFT JOIN floors f ON s.floor_id = f.id
    `;
    const params = [];
    const whereClauses = [];
    let paramIndex = 1;
    if (date && typeof date === 'string') {
      whereClauses.push(`o.created_at::date = $${paramIndex++}::date`);
      params.push(date);
    }
    if (orderType && orderType !== 'all' && typeof orderType === 'string') {
      whereClauses.push(`o.order_type = $${paramIndex++}`);
      params.push(orderType);
    }
    if (whereClauses.length > 0) { baseQuery += ` WHERE ${whereClauses.join(' AND ')}`; }
    baseQuery += ` ORDER BY o.created_at DESC;`;
    const ordersResult = await client.query(baseQuery, params);
    const orders = ordersResult.rows;
    if (orders.length > 0) {
      const orderIds = orders.map(o => o.id);

      // Determine the underlying type of orders.id so we can pass the correct
      // typed array to the items query (some DBs use integer ids, others uuid).
      const typeRes = await client.query(
        "SELECT udt_name FROM information_schema.columns WHERE table_name='orders' AND column_name='id' AND table_schema='public' LIMIT 1"
      );
      const udt = typeRes.rows[0] ? typeRes.rows[0].udt_name : null;

      let itemsResult;
      if (udt === 'int4' || udt === 'int8') {
        // DB uses integer ids
        const numericIds = orderIds.map(id => Number(id));
        itemsResult = await client.query(`
          SELECT oi.order_id, oi.id, oi.quantity, COALESCE(oi.unit_price, mi.price) AS unit_price, oi.total_price, mi.name as menu_item_name
          FROM order_items oi JOIN menu_items mi ON mi.id = oi.menu_item_id
          WHERE oi.order_id = ANY($1::int4[])
        `, [numericIds]);
      } else {
        // default to uuid-based ids
        itemsResult = await client.query(`
          SELECT oi.order_id, oi.id, oi.quantity, COALESCE(oi.unit_price, mi.price) AS unit_price, oi.total_price, mi.name as menu_item_name
          FROM order_items oi JOIN menu_items mi ON mi.id = oi.menu_item_id
          WHERE oi.order_id = ANY($1::uuid[])
        `, [orderIds]);
      }

      orders.forEach(order => {
        order.order_items = itemsResult.rows.filter(item => item.order_id === order.id);
      });
    }
    res.json(orders);
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  } finally {
    client.release();
  }
});

// GET a single order by ID with all details
router.get('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const client = await pool.connect();
  try {
    const orderResult = await client.query(`
      SELECT o.*, 
             c.name AS customer_name, 
             c.mobile_number, 
             c.loyalty_points,
             c.status as customer_status,
             rt.name AS table_name, 
             s.name AS section_name, 
             f.name AS floor_name
      FROM orders o
      LEFT JOIN customers c ON o.customer_id = c.id
      LEFT JOIN restaurant_tables rt ON o.restaurant_table_id = rt.id
      LEFT JOIN sections s ON rt.section_id = s.id
      LEFT JOIN floors f ON s.floor_id = f.id
      WHERE o.id = $1
    `, [id]);

    if (orderResult.rows.length === 0) {
      return res.status(404).json({ message: 'Order not found' });
    }

    const order = orderResult.rows[0];

    // Fetch order items with menu item details
    const itemsResult = await client.query(`
      SELECT oi.id, oi.quantity, COALESCE(oi.unit_price, mi.price) AS unit_price, oi.total_price, mi.name as menu_item_name
      FROM order_items oi 
      JOIN menu_items mi ON mi.id = oi.menu_item_id
      WHERE oi.order_id = $1
    `, [id]);

    order.order_items = itemsResult.rows;

    // Calculate loyalty points that will be earned for this order (if customer is verified)
    if (order.customer_status === 'verified' && order.mobile_number) {
      try {
        const settingsResult = await client.query(
          'SELECT loyalty_points_enabled, loyalty_points_per_100 FROM restaurant_settings LIMIT 1'
        );
        
        if (settingsResult.rows.length > 0) {
          const { loyalty_points_enabled, loyalty_points_per_100 } = settingsResult.rows[0];
          
          if (loyalty_points_enabled) {
            const pointsEarned = Math.floor((order.grand_total / 100) * loyalty_points_per_100);
            order.loyalty_points_earned = pointsEarned;
            order.loyalty_points_rate = loyalty_points_per_100;
          } else {
            order.loyalty_points_earned = 0;
          }
        }
      } catch (err) {
        console.warn('Could not fetch loyalty settings:', err);
        order.loyalty_points_earned = 0;
      }
    } else {
      order.loyalty_points_earned = 0;
    }

    res.json(order);
  } catch (error) {
    console.error('Error fetching order:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  } finally {
    client.release();
  }
});

// POST generate PDF bill for an order
router.post('/:id/generate-pdf', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { tableName } = req.body;
  
  const client = await pool.connect();
  try {
    // Fetch order details
    const orderResult = await client.query(`
      SELECT o.*, 
             c.name AS customer_name, 
             c.mobile_number, 
             c.loyalty_points,
             c.status as customer_status,
             rt.name AS table_name, 
             s.name AS section_name, 
             f.name AS floor_name
      FROM orders o
      LEFT JOIN customers c ON o.customer_id = c.id
      LEFT JOIN restaurant_tables rt ON o.restaurant_table_id = rt.id
      LEFT JOIN sections s ON rt.section_id = s.id
      LEFT JOIN floors f ON s.floor_id = f.id
      WHERE o.id = $1
    `, [id]);

    if (orderResult.rows.length === 0) {
      return res.status(404).json({ message: 'Order not found' });
    }

    const order = orderResult.rows[0];

    // Fetch order items
    const itemsResult = await client.query(`
      SELECT oi.id, oi.quantity, COALESCE(oi.unit_price, mi.price) AS unit_price, oi.total_price, mi.name as menu_item_name
      FROM order_items oi 
      JOIN menu_items mi ON mi.id = oi.menu_item_id
      WHERE oi.order_id = $1
    `, [id]);

    order.order_items = itemsResult.rows;

    // Calculate loyalty points
    if (order.customer_status === 'verified' && order.mobile_number) {
      const settingsResult = await client.query(
        'SELECT loyalty_points_enabled, loyalty_points_per_100 FROM restaurant_settings LIMIT 1'
      );
      
      if (settingsResult.rows.length > 0) {
        const { loyalty_points_enabled, loyalty_points_per_100 } = settingsResult.rows[0];
        
        if (loyalty_points_enabled) {
          const pointsEarned = Math.floor((order.grand_total / 100) * loyalty_points_per_100);
          order.loyalty_points_earned = pointsEarned;
          order.loyalty_points_rate = loyalty_points_per_100;
        } else {
          order.loyalty_points_earned = 0;
        }
      }
    } else {
      order.loyalty_points_earned = 0;
    }

    // Fetch restaurant settings
    const restaurantSettings = await client.query('SELECT * FROM restaurant_settings LIMIT 1');
    const settings = restaurantSettings.rows[0] || {
      restaurant_name: 'Restaurant POS',
      address: '',
      contact_number: '',
      registration_number: ''
    };

    // Generate HTML for the bill
    const formatCurrency = (amount: number | string) => {
      const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
      return `₹${numAmount.toFixed(2)}`;
    };
    const formatDateTime = (date: string) => {
      const d = new Date(date);
      return d.toLocaleString('en-IN', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric', 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    };

    const billHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body {
            font-family: 'Courier New', monospace;
            max-width: 80mm;
            margin: 0 auto;
            padding: 10px;
            font-size: 12px;
          }
          .center { text-align: center; }
          .bold { font-weight: bold; }
          .header { 
            border-bottom: 2px dashed #000; 
            padding-bottom: 10px; 
            margin-bottom: 10px; 
          }
          .line { 
            border-bottom: 1px dashed #000; 
            margin: 10px 0; 
          }
          .row { 
            display: flex; 
            justify-content: space-between; 
            margin: 5px 0; 
          }
          .item-row {
            margin: 8px 0;
          }
          .item-name {
            font-weight: bold;
          }
          .item-details {
            display: flex;
            justify-content: space-between;
            font-size: 11px;
            color: #333;
          }
          .total-section {
            margin-top: 10px;
            padding-top: 10px;
            border-top: 1px solid #000;
          }
          .total-row {
            font-weight: bold;
            font-size: 14px;
            margin-top: 5px;
          }
          .footer {
            border-top: 2px dashed #000;
            padding-top: 10px;
            margin-top: 15px;
          }
          .loyalty-box {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 12px;
            border-radius: 8px;
            margin: 15px 0;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="center bold" style="font-size: 16px;">${settings.restaurant_name}</div>
          ${settings.address ? `<div class="center">${settings.address}</div>` : ''}
          ${settings.contact_number ? `<div class="center">Tel: ${settings.contact_number}</div>` : ''}
          ${settings.registration_number ? `<div class="center" style="font-size: 10px;">Reg: ${settings.registration_number}</div>` : ''}
        </div>

        <div class="row">
          <span>Table:</span>
          <span class="bold">${tableName || order.table_name || 'N/A'}</span>
        </div>
        <div class="row">
          <span>Order #:</span>
          <span>${order.order_number}</span>
        </div>
        <div class="row">
          <span>Date:</span>
          <span>${formatDateTime(order.created_at)}</span>
        </div>
        ${order.customer_name ? `
        <div class="row">
          <span>Customer:</span>
          <span>${order.customer_name}</span>
        </div>
        ` : ''}

        <div class="line"></div>

        <div style="margin: 15px 0;">
          ${order.order_items && order.order_items.length > 0 ? 
            order.order_items.map((item: any) => `
              <div class="item-row">
                <div class="item-name">${item.menu_item_name}</div>
                <div class="item-details">
                  <span>${item.quantity} x ${formatCurrency(item.unit_price)}</span>
                  <span>${formatCurrency(item.total_price)}</span>
                </div>
              </div>
            `).join('') 
            : '<div class="center">No items</div>'
          }
        </div>

        <div class="total-section">
          <div class="row">
            <span>Subtotal:</span>
            <span>${formatCurrency(order.subtotal)}</span>
          </div>
          <div class="row">
            <span>Tax:</span>
            <span>${formatCurrency(order.tax_amount)}</span>
          </div>
          <div class="row total-row">
            <span>TOTAL:</span>
            <span>${formatCurrency(order.grand_total)}</span>
          </div>
        </div>

        ${order.customer_status === 'verified' && order.mobile_number ? `
        <div class="line"></div>
        <div class="loyalty-box">
          <div class="center bold" style="font-size: 14px; margin-bottom: 8px;">🎉 Loyalty Rewards 🎉</div>
          ${order.loyalty_points_earned > 0 ? `
            <div class="row" style="color: #fff; margin: 6px 0; font-size: 13px;">
              <span>Points Earned:</span>
              <span class="bold" style="font-size: 16px;">+${order.loyalty_points_earned} pts</span>
            </div>
          ` : `
            <div class="center" style="font-size: 12px; opacity: 0.9;">
              Loyalty points not earned for this transaction
            </div>
          `}
          <div class="row" style="color: #fff; margin: 8px 0 4px 0; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.3);">
            <span>Total Points Balance:</span>
            <span class="bold" style="font-size: 16px;">${(order.loyalty_points || 0) + (order.loyalty_points_earned || 0)} pts</span>
          </div>
        </div>
        ` : ''}

        <div class="footer">
          <div class="center bold" style="margin-bottom: 5px;">Thank you for dining with us!</div>
          <div class="center">Please visit again</div>
        </div>
      </body>
      </html>
    `;

    // Generate PDF
    const file = { content: billHTML };
    const options = { 
      format: 'A4',
      margin: { top: '10mm', right: '10mm', bottom: '10mm', left: '10mm' },
      path: ''  // Will be set below
    };

    // Save PDF to bill_output folder
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const filename = `Bill-${order.order_number}-${timestamp}.pdf`;
    
    // Ensure directory exists
    const billOutputDir = path.join(__dirname, '../../bill_output');
    if (!fs.existsSync(billOutputDir)) {
      fs.mkdirSync(billOutputDir, { recursive: true });
    }
    
    const outputPath = path.join(billOutputDir, filename);
    options.path = outputPath;

    // Generate and save PDF
    try {
      const pdfResult: any = await (htmlPdf as any).generatePdf(file, options);
      
      // If the library returns a buffer, write it
      if (pdfResult && Buffer.isBuffer(pdfResult)) {
        fs.writeFileSync(outputPath, pdfResult);
      }
      // Otherwise it should have saved to the path already
    } catch (pdfError) {
      console.error('PDF generation error:', pdfError);
      throw pdfError;
    }

    res.json({ 
      success: true, 
      message: 'Bill generated successfully',
      filename: filename,
      path: outputPath
    });

  } catch (error) {
    console.error('Error generating PDF bill:', error);
    res.status(500).json({ message: 'Failed to generate PDF bill' });
  } finally {
    client.release();
  }
});

// POST a new order
router.post('/', async (req: Request, res: Response) => {
  const { order, items } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // VALIDATION 1: Dine-in orders must have a table assigned
    if (order.order_type === 'dine_in' && !order.restaurant_table_id) {
      return res.status(400).json({ message: 'Table selection is required for dine-in orders.' });
    }
    
    // VALIDATION 2: Check if the selected table is available (for dine-in orders)
    if (order.order_type === 'dine_in' && order.restaurant_table_id) {
      const tableCheck = await client.query(
        "SELECT status FROM restaurant_tables WHERE id = $1",
        [order.restaurant_table_id]
      );
      
      if (tableCheck.rows.length === 0) {
        return res.status(404).json({ message: 'Selected table not found.' });
      }
      
      if (tableCheck.rows[0].status !== 'available') {
        return res.status(400).json({ 
          message: `Table is not available. Current status: ${tableCheck.rows[0].status}. Please select a different table.` 
        });
      }
    }
    
    let customerId = null;
    if (order.mobile_number && order.mobile_number.trim()) {
      // If mobile number provided, find or create customer and mark as VERIFIED
      let customerResult = await client.query('SELECT id, status FROM customers WHERE mobile_number = $1', [order.mobile_number]);
      if (customerResult.rows.length > 0) {
        customerId = customerResult.rows[0].id;
        // If existing customer is not verified, mark as verified
        if (customerResult.rows[0].status !== 'verified') {
          await client.query("UPDATE customers SET status = 'verified' WHERE id = $1", [customerId]);
        }
      } else {
        const newCustomerResult = await client.query('INSERT INTO customers (name, mobile_number, status) VALUES ($1, $2, $3) RETURNING id', [order.customer_name || 'Unknown', order.mobile_number, 'verified']);
        customerId = newCustomerResult.rows[0].id;
      }
    } else {
      // Walk-in customer: create unverified customer record
      const walkInCustomerResult = await client.query('INSERT INTO customers (name, status) VALUES ($1, $2) RETURNING id', [order.customer_name || 'Walk-in', 'unverified']);
      customerId = walkInCustomerResult.rows[0].id;
    }
    const newOrderQuery = `
      INSERT INTO orders (order_number, customer_id, order_type, subtotal, tax_amount, grand_total, status, notes, restaurant_table_id, take_away_method, car_details, delivery_address)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *;`;
    const orderParams = [order.order_number, customerId, order.order_type, order.subtotal, order.tax_amount, order.grand_total, 'pending', order.notes || null, order.restaurant_table_id || null, order.take_away_method || null, order.car_details || null, order.delivery_address || null];
    const orderResult = await client.query(newOrderQuery, orderParams);
    const newOrder = orderResult.rows[0];

    if (order.order_type === 'dine_in' && order.restaurant_table_id) {
      await client.query("UPDATE restaurant_tables SET status = 'occupied' WHERE id = $1", [order.restaurant_table_id]);
    }

    for (const item of items) {
      // Ensure numeric conversion for integer ID columns
      await client.query(
        'INSERT INTO order_items (order_id, menu_item_id, quantity, unit_price, total_price) VALUES ($1, $2, $3, $4, $5);',
        [newOrder.id, item.menu_item_id, item.quantity, item.unit_price, item.total_price]
      );
    }
    await client.query('COMMIT');
    const finalOrderResult = await client.query(`
        SELECT o.*, c.name as customer_name, c.mobile_number,
               (SELECT json_agg(json_build_object('menu_item_name', mi.name, 'quantity', oi.quantity, 'id', oi.id, 'unit_price', COALESCE(oi.unit_price, mi.price), 'total_price', oi.total_price)) 
                FROM order_items oi JOIN menu_items mi ON mi.id = oi.menu_item_id WHERE oi.order_id = o.id) as order_items
        FROM orders o LEFT JOIN customers c ON o.customer_id = c.id WHERE o.id = $1;
    `, [newOrder.id]);
    res.status(201).json({ ...finalOrderResult.rows[0], order_items: finalOrderResult.rows[0].order_items || [] });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating order:', error);
    res.status(500).json({ message: 'Failed to create order' });
  } finally {
    client.release();
  }
});

// PUT update an order's items, totals, and notes
router.put('/:id', async (req: Request, res: Response) => {
    const { id } = req.params;
    const { items, subtotal, tax_amount, grand_total, notes } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const updatedOrderResult = await client.query(
            `UPDATE orders 
             SET subtotal = $1, tax_amount = $2, grand_total = $3, notes = $4, updated_at = NOW() 
             WHERE id = $5 RETURNING *`,
            [subtotal, tax_amount, grand_total, notes, id]
        );
        if (updatedOrderResult.rows.length === 0) throw new Error('Order not found');
        await client.query('DELETE FROM order_items WHERE order_id = $1', [id]);
        for (const item of items) {
            await client.query(
                'INSERT INTO order_items (order_id, menu_item_id, quantity, unit_price, total_price) VALUES ($1, $2, $3, $4, $5)',
                [id, item.menu_item_id, item.quantity, item.unit_price, item.total_price]
            );
        }
        await client.query('COMMIT');
        const finalOrderResult = await client.query(`
            SELECT o.*, c.name as customer_name, c.mobile_number,
                   (SELECT json_agg(json_build_object('menu_item_name', mi.name, 'quantity', oi.quantity, 'id', oi.id, 'unit_price', oi.unit_price, 'total_price', oi.total_price)) 
                    FROM order_items oi JOIN menu_items mi ON mi.id = oi.menu_item_id WHERE oi.order_id = o.id) as order_items
            FROM orders o LEFT JOIN customers c ON o.customer_id = c.id WHERE o.id = $1;
        `, [id]);
        res.json({ ...finalOrderResult.rows[0], order_items: finalOrderResult.rows[0].order_items || [] });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error updating order:', error);
        res.status(500).json({ message: 'Failed to update order' });
    } finally {
        client.release();
    }
});

// PUT update an order's status
router.put('/:id/status', async (req: Request, res: Response) => {
    const { id } = req.params;
    const { status } = req.body;
    if (!['completed', 'cancelled', 'pending'].includes(status)) { return res.status(400).json({ message: 'Invalid status provided.' }); }
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const updatedOrderResult = await client.query('UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *', [status, id]);
      if (updatedOrderResult.rows.length === 0) throw new Error('Order not found.');
      if (status === 'completed') {
        const orderItemsResult = await client.query('SELECT * FROM order_items WHERE order_id = $1', [id]);
        for (const item of orderItemsResult.rows) {
          const recipeResult = await client.query('SELECT * FROM recipes WHERE menu_item_id = $1', [item.menu_item_id]);
          for (const ingredient of recipeResult.rows) {
            const quantityToDeduct = Number(item.quantity) * Number(ingredient.quantity_used);
            await client.query('UPDATE inventory SET quantity = quantity - $1 WHERE id = $2', [quantityToDeduct, ingredient.inventory_item_id]);
          }
        }
      }
      await client.query('COMMIT');
      res.json(updatedOrderResult.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error updating order status:', error);
      res.status(500).json({ message: 'Failed to update order status' });
    } finally {
      client.release();
    }
});

export default router;