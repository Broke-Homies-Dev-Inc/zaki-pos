import { Router } from 'express';
import { pool } from '../server';

const router = Router();

// Thawani API Configuration - MUST be configured in .env
const THAWANI_API_KEY = process.env.THAWANI_SECRET_KEY || '';
const THAWANI_BASE_URL = process.env.THAWANI_BASE_URL || 'https://uatcheckout.thawani.om/api/v1';

/**
 * POST /api/refunds
 * Initiate a refund via Thawani API
 * Body: { order_id, amount, reason, created_by }
 */
router.post('/', async (req, res) => {
  const client = await pool.connect();
  try {
    const { order_id, amount, reason, created_by } = req.body;

    if (!order_id || !amount || !reason) {
      return res.status(400).json({ error: 'order_id, amount, and reason are required' });
    }

    // Get order details including payment_reference
    const orderResult = await client.query(
      `SELECT id, order_number, payment_reference, payment_status, payment_method, 
                    grand_total, total_refunded, refund_status
             FROM orders WHERE id = $1`,
      [order_id]
    );

    if (orderResult.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const order = orderResult.rows[0];

    // Validate order is eligible for refund
    if (order.payment_method !== 'online') {
      return res.status(400).json({ error: 'Only online payment orders can be refunded via Thawani' });
    }

    if (order.payment_status !== 'paid') {
      return res.status(400).json({ error: 'Order payment status is not "paid"' });
    }

    if (!order.payment_reference) {
      return res.status(400).json({ error: 'No payment reference found for this order' });
    }

    // Calculate refundable amount
    const alreadyRefunded = parseFloat(order.total_refunded) || 0;
    const grandTotal = parseFloat(order.grand_total);
    const maxRefundable = grandTotal - alreadyRefunded;
    const refundAmount = parseFloat(amount);

    if (refundAmount <= 0) {
      return res.status(400).json({ error: 'Refund amount must be greater than 0' });
    }

    if (refundAmount > maxRefundable) {
      return res.status(400).json({
        error: `Refund amount exceeds refundable balance. Max: ${maxRefundable.toFixed(3)} OMR`
      });
    }

    // Determine refund type
    const refundType = refundAmount >= maxRefundable ? 'full' : 'partial';

    // Check if Thawani API key is configured
    if (!THAWANI_API_KEY) {
      console.error('❌ THAWANI_SECRET_KEY not configured');
      return res.status(500).json({ error: 'Payment gateway not configured for refunds' });
    }

    // Convert to baisa (1 OMR = 1000 Baisa)
    const amountInBaisa = Math.round(refundAmount * 1000);

    console.log(`💸 Initiating Thawani refund for order ${order.order_number}`);
    console.log(`   Payment Reference: ${order.payment_reference}`);
    console.log(`   Amount: ${refundAmount} OMR (${amountInBaisa} baisa)`);
    console.log(`   Type: ${refundType} refund`);

    // Call Thawani Refund API (using native fetch - Node 18+)
    const refundResponse = await fetch(`${THAWANI_BASE_URL}/refunds`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'thawani-api-key': THAWANI_API_KEY
      },
      body: JSON.stringify({
        payment_id: order.payment_reference,
        amount: amountInBaisa,
        reason: reason
      })
    });

    const refundData = await refundResponse.json() as any;
    console.log('📥 Thawani refund response:', JSON.stringify(refundData, null, 2));

    if (!refundResponse.ok || !refundData.success) {
      console.error('❌ Thawani refund failed:', refundData);

      // Still record the failed refund attempt
      await client.query(
        `INSERT INTO refunds (order_id, payment_reference, amount, reason, status, refund_type, created_by)
                 VALUES ($1, $2, $3, $4, 'failed', $5, $6)`,
        [order_id, order.payment_reference, refundAmount, reason, refundType, created_by]
      );

      return res.status(500).json({
        error: 'Thawani refund failed',
        details: refundData.description || refundData.message || 'Unknown error'
      });
    }

    // Record successful refund
    await client.query('BEGIN');

    const refundResult = await client.query(
      `INSERT INTO refunds (order_id, payment_reference, refund_reference, amount, reason, status, refund_type, created_by, processed_at)
             VALUES ($1, $2, $3, $4, $5, 'completed', $6, $7, NOW())
             RETURNING *`,
      [order_id, order.payment_reference, refundData.data?.refund_id || null, refundAmount, reason, refundType, created_by]
    );

    // Update order refund totals
    const newTotalRefunded = alreadyRefunded + refundAmount;
    const newRefundStatus = newTotalRefunded >= grandTotal ? 'full' : 'partial';

    await client.query(
      `UPDATE orders SET total_refunded = $1, refund_status = $2 WHERE id = $3`,
      [newTotalRefunded, newRefundStatus, order_id]
    );

    await client.query('COMMIT');

    console.log(`✅ Refund successful for order ${order.order_number}: ${refundAmount} OMR`);

    res.json({
      success: true,
      message: `${refundType === 'full' ? 'Full' : 'Partial'} refund of ${refundAmount.toFixed(3)} OMR processed successfully`,
      refund: refundResult.rows[0],
      order_refund_status: newRefundStatus,
      total_refunded: newTotalRefunded
    });

  } catch (err: any) {
    await client.query('ROLLBACK').catch(() => { });
    console.error('❌ Refund error:', err.message);
    res.status(500).json({ error: 'Failed to process refund', details: err.message });
  } finally {
    client.release();
  }
});

/**
 * GET /api/refunds/order/:orderId
 * Get refund history for an order
 */
router.get('/order/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;

    const result = await pool.query(
      `SELECT r.*, o.order_number, o.grand_total, o.total_refunded, o.refund_status
             FROM refunds r
             JOIN orders o ON r.order_id = o.id
             WHERE r.order_id = $1
             ORDER BY r.created_at DESC`,
      [orderId]
    );

    // Get order info even if no refunds
    const orderResult = await pool.query(
      `SELECT id, order_number, grand_total, total_refunded, refund_status, payment_method, payment_status, payment_reference
             FROM orders WHERE id = $1`,
      [orderId]
    );

    if (orderResult.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const order = orderResult.rows[0];
    const refundable = order.payment_method === 'online' &&
      order.payment_status === 'paid' &&
      order.payment_reference;

    res.json({
      order: {
        id: order.id,
        order_number: order.order_number,
        grand_total: parseFloat(order.grand_total),
        total_refunded: parseFloat(order.total_refunded) || 0,
        refund_status: order.refund_status || 'none',
        payment_method: order.payment_method,
        payment_status: order.payment_status,
        is_refundable: refundable,
        max_refundable: refundable ? parseFloat(order.grand_total) - (parseFloat(order.total_refunded) || 0) : 0
      },
      refunds: result.rows.map(r => ({
        ...r,
        amount: parseFloat(r.amount)
      }))
    });
  } catch (err: any) {
    console.error('Error fetching refund history:', err.message);
    res.status(500).json({ error: 'Failed to fetch refund history' });
  }
});

/**
 * GET /api/refunds/:refundId
 * Get single refund details
 */
router.get('/:refundId', async (req, res) => {
  try {
    const { refundId } = req.params;

    const result = await pool.query(
      `SELECT r.*, o.order_number
             FROM refunds r
             JOIN orders o ON r.order_id = o.id
             WHERE r.id = $1`,
      [refundId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Refund not found' });
    }

    res.json(result.rows[0]);
  } catch (err: any) {
    console.error('Error fetching refund:', err.message);
    res.status(500).json({ error: 'Failed to fetch refund' });
  }
});

export default router;
