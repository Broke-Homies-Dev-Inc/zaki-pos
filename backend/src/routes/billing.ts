import { Router, Request, Response } from 'express';
import { pool } from '../server';

const router = Router();

// Helper function to generate a unique bill number
function generateBillNumber(): string {
  const timestamp = Date.now().toString().slice(-6);
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `BILL-${timestamp}${random}`;
}

// POST /api/billing/settle
// This is a major transactional endpoint
router.post('/settle', async (req: Request, res: Response) => {
  const {
    order_id,
    table_id,
    payment_method,
    amount_paid,
    grand_total
  } = req.body;

  if (!order_id || !payment_method || !amount_paid) {
    return res.status(400).json({ message: 'Missing required payment information.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Mark the order as 'completed'
    const orderUpdateResult = await client.query(
      "UPDATE orders SET status = 'completed', updated_at = NOW() WHERE id = $1 RETURNING *;",
      [order_id]
    );
    if (orderUpdateResult.rows.length === 0) {
      throw new Error('Order not found.');
    }
    const order = orderUpdateResult.rows[0];

    // 2. If it was a dine-in order, mark all linked tables as 'paid' and separate them
    if (order.order_type === 'dine_in') {
      // Get all tables linked to this order
      const linkedTablesResult = await client.query(
        "SELECT id FROM restaurant_tables WHERE linked_order_id = $1",
        [order_id]
      );
      
      const linkedTableIds = linkedTablesResult.rows.map(row => row.id);
      
      if (linkedTableIds.length > 0) {
        // Clear linked_order_id and set status to paid for all linked tables (they separate now)
        await client.query(
          "UPDATE restaurant_tables SET status = 'paid', linked_order_id = NULL, updated_at = NOW() WHERE id = ANY($1::uuid[])",
          [linkedTableIds]
        );
        console.log(`✅ Marked ${linkedTableIds.length} linked tables as paid and separated them`);
        
        // Emit WebSocket event for table status update
        try {
          const { getIO } = await import('../websocket');
          getIO().emit('posTableStatusUpdate', {
            tableIds: linkedTableIds,
            newStatus: 'paid',
            source: 'pos-billing',
            timestamp: new Date().toISOString()
          });
          console.log(`📤 Table status update emitted for ${linkedTableIds.length} tables`);
        } catch (err) {
          console.warn('WebSocket not available:', err);
        }
      } else if (table_id) {
        // Fallback: single table
        await client.query(
          "UPDATE restaurant_tables SET status = 'paid', linked_order_id = NULL, updated_at = NOW() WHERE id = $1",
          [table_id]
        );
        
        // Emit WebSocket event for table status update
        try {
          const { getIO } = await import('../websocket');
          getIO().emit('posTableStatusUpdate', {
            tableIds: [table_id],
            newStatus: 'paid',
            source: 'pos-billing',
            timestamp: new Date().toISOString()
          });
          console.log(`📤 Table status update emitted for table ${table_id}`);
        } catch (err) {
          console.warn('WebSocket not available:', err);
        }
      }
    }

    // 3. Deduct inventory (the same logic from the old 'complete' endpoint)
    const orderItemsResult = await client.query('SELECT * FROM order_items WHERE order_id = $1', [order_id]);
    for (const item of orderItemsResult.rows) {
      const recipeResult = await client.query('SELECT * FROM recipes WHERE menu_item_id = $1', [item.menu_item_id]);
      for (const ingredient of recipeResult.rows) {
        const quantityToDeduct = Number(item.quantity) * Number(ingredient.quantity_used);
        await client.query('UPDATE inventory SET quantity = quantity - $1 WHERE id = $2', [quantityToDeduct, ingredient.inventory_item_id]);
      }
    }

    // 4. Create the official bill record
    const billNumber = generateBillNumber();
    const changeDue = Math.max(0, Number(amount_paid) - Number(grand_total));
    await client.query(
      `INSERT INTO bills (order_id, bill_number, payment_method, amount_paid, change_due)
       VALUES ($1, $2, $3, $4, $5)`,
      [order_id, billNumber, payment_method, amount_paid, changeDue]
    );

    await client.query('COMMIT');

    // Emit WebSocket event for order completion
    try {
      const { getIO } = await import('../websocket');
      getIO().emit('order:completed', { orderId: order_id });
    } catch (err) {
      console.warn('WebSocket not available:', err);
    }

    res.status(200).json({ success: true, message: 'Payment settled successfully.' });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error settling payment:', error);
    res.status(500).json({ message: 'Failed to settle payment.' });
  } finally {
    client.release();
  }
});


export default router;