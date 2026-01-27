import { Router, Request, Response } from "express";
import { pool } from "../server";

const router = Router();

/* ---------------------------------------------------
   Helper – Validate date input
--------------------------------------------------- */
function validateDates(req: Request, res: Response) {
  const { from, to } = req.query;
  if (!from || !to) {
    res.status(400).json({ message: "from & to dates required" });
    return null;
  }
  return { from, to };
}

/* ---------------------------------------------------
   1) WORK PERIOD REPORT
--------------------------------------------------- */
router.get("/work-period", async (req, res) => {
  const range = validateDates(req, res);
  if (!range) return;

  const { from, to } = range;

  try {
    const result = await pool.query(
      `
      SELECT 
        COUNT(*) AS total_orders,
        SUM(subtotal) AS total_subtotal,
        SUM(tax_amount) AS total_tax,
        SUM(grand_total) AS total_sales,
        COUNT(*) FILTER (WHERE order_type='dine_in') AS dine_in_orders,
        COUNT(*) FILTER (WHERE order_type='take_away') AS takeaway_orders,
        COUNT(*) FILTER (WHERE order_type='delivery') AS delivery_orders
      FROM orders
      WHERE created_at BETWEEN $1 AND $2
        AND status != 'cancelled';
      `,
      [from, to]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error("WORK PERIOD ERROR:", err);
    res.status(500).json({ message: "Failed to fetch work period report" });
  }
});

router.get("/group-sales-amount", async (req, res) => {
  const range = validateDates(req, res);
  if (!range) return;
  const { from, to } = range;

  try {
    const result = await pool.query(
      `
      SELECT 
        mi.category AS category_name,
        SUM(oi.total_price) AS total_amount
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      JOIN menu_items mi ON mi.id = oi.menu_item_id
      WHERE o.created_at BETWEEN $1 AND $2
        AND o.status != 'cancelled'
      GROUP BY mi.category
      ORDER BY total_amount DESC;
      `,
      [from, to]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("GROUP SALES AMOUNT ERROR:", err);
    res.status(500).json({ message: "Failed to fetch Group Sales by Amount" });
  }
});

router.get("/group-sales-quantity", async (req, res) => {
  const range = validateDates(req, res);
  if (!range) return;
  const { from, to } = range;

  try {
    const result = await pool.query(
      `
      SELECT 
        mi.category AS category_name,
        SUM(oi.quantity) AS total_quantity
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      JOIN menu_items mi ON mi.id = oi.menu_item_id
      WHERE o.created_at BETWEEN $1 AND $2
        AND o.status != 'cancelled'
      GROUP BY mi.category
      ORDER BY total_quantity DESC;
      `,
      [from, to]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("GROUP SALES QTY ERROR:", err);
    res.status(500).json({ message: "Failed to fetch Group Sales by Quantity" });
  }
});


/* ---------------------------------------------------
   2) ITEM SALES REPORT
--------------------------------------------------- */
router.get("/item-sales", async (req, res) => {
  const range = validateDates(req, res);
  if (!range) return;
  const { from, to } = range;

  try {
    const result = await pool.query(
      `
      SELECT 
        mi.name AS item_name,
        oi.portion_name AS portion_name,
        SUM(oi.quantity) AS total_quantity,
        SUM(oi.total_price) AS total_sales
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      JOIN menu_items mi ON mi.id = oi.menu_item_id
      WHERE o.created_at BETWEEN $1 AND $2
        AND o.status != 'cancelled'
      GROUP BY mi.name, oi.portion_name
      ORDER BY mi.name, total_sales DESC;
      `,
      [from, to]
    );

    // Transform flat rows into grouped structure
    const grouped: Record<string, any> = {};

    for (const r of result.rows) {
      const name = r.item_name;
      if (!grouped[name]) {
        grouped[name] = {
          item_name: name,
          portions: []
        };
      }
      grouped[name].portions.push({
        portion_name: r.portion_name || null,
        total_quantity: Number(r.total_quantity),
        total_sales: Number(r.total_sales)
      });
    }

    res.json(Object.values(grouped));
  } catch (err) {
    console.error("ITEM SALES REPORT ERROR:", err);
    res.status(500).json({ message: "Failed to fetch Item Sales report" });
  }
});



/* ---------------------------------------------------
   3) CASH TRANSACTION REPORT (WITH CUSTOMER NAME JOIN)
--------------------------------------------------- */
router.get("/cash-transactions", async (req, res) => {
  const range = validateDates(req, res);
  if (!range) return;
  const { from, to } = range;

  try {
    const result = await pool.query(
      `
      SELECT 
        o.id,
        o.order_number,
        COALESCE(c.name, o.customer_name, 'Walk-in') AS customer_name,
        o.grand_total AS amount_paid,
        o.created_at
      FROM orders o
      LEFT JOIN customers c ON c.id = o.customer_id
      WHERE o.created_at BETWEEN $1 AND $2
        AND o.status = 'completed'
      ORDER BY o.created_at DESC;
      `,
      [from, to]
    );

    res.json(result.rows);
  } catch (err) {
    console.error("CASH ERROR:", err);
    res.status(500).json({ message: "Failed to fetch cash transactions" });
  }
});

/* ---------------------------------------------------
   4) INVENTORY TRANSACTION REPORT
   Shows how much inventory was used based on recipes × order quantities
--------------------------------------------------- */
router.get("/inventory-transactions", async (req, res) => {
  const range = validateDates(req, res);
  if (!range) return;
  const { from, to } = range;

  try {
    const result = await pool.query(
      `
      SELECT 
        i.item_name,
        mi.name AS menu_item,
        SUM(oi.quantity * r.quantity_used) AS total_used,
        o.order_number,
        o.created_at
      FROM recipes r
      JOIN inventory i ON i.id = r.inventory_item_id
      JOIN menu_items mi ON mi.id = r.menu_item_id
      JOIN order_items oi ON oi.menu_item_id = mi.id
      JOIN orders o ON o.id = oi.order_id
      WHERE o.created_at BETWEEN $1 AND $2
      GROUP BY i.item_name, mi.name, o.order_number, o.created_at
      ORDER BY o.created_at DESC;
      `,
      [from, to]
    );

    res.json(result.rows);
  } catch (err) {
    console.error("INV ERROR:", err);
    res.status(500).json({ message: "Failed to fetch inventory transactions" });
  }
});

/* ---------------------------------------------------
   5) COST REPORT (COGS)
--------------------------------------------------- */
router.get("/cost", async (req, res) => {
  const range = validateDates(req, res);
  if (!range) return;
  const { from, to } = range;

  try {
    const result = await pool.query(
      `
      SELECT 
        mi.name AS item_name,
        SUM(oi.quantity * r.quantity_used * COALESCE(inv.cost,0)) AS total_cost,
        SUM(oi.quantity) AS qty_sold
      FROM order_items oi
      JOIN menu_items mi ON mi.id = oi.menu_item_id
      JOIN recipes r ON r.menu_item_id = mi.id
      JOIN inventory inv ON inv.id = r.inventory_item_id
      JOIN orders o ON o.id = oi.order_id
      WHERE o.created_at BETWEEN $1 AND $2
      GROUP BY mi.name
      ORDER BY total_cost DESC;
      `,
      [from, to]
    );

    res.json(result.rows);
  } catch (err) {
    console.error("COST ERROR:", err);
    res.status(500).json({ message: "Failed to fetch cost report" });
  }
});

/* ---------------------------------------------------
   6) TALABAT REPORT (fallback: search address)
--------------------------------------------------- */
router.get("/talabat", async (req, res) => {
  const range = validateDates(req, res);
  if (!range) return;
  const { from, to } = range;

  try {
    const result = await pool.query(
      `
      SELECT *
      FROM orders
      WHERE created_at BETWEEN $1 AND $2
        AND order_type = 'delivery'
        AND delivery_address ILIKE '%talabat%';
      `,
      [from, to]
    );

    res.json(result.rows);
  } catch (err) {
    console.error("TALABAT ERROR:", err);
    res.status(500).json({ message: "Failed to fetch talabat report" });
  }
});

/* ---------------------------------------------------
   7) ONLINE DELIVERY REPORT (grouped by delivery partner)
--------------------------------------------------- */
router.get("/online_delivery", async (req, res) => {
  const range = validateDates(req, res);
  if (!range) return;
  const { from, to } = range;

  try {
    // Get summary per delivery partner
    const summaryResult = await pool.query(
      `
      SELECT 
        delivery_address AS partner_name,
        COUNT(*) AS order_count,
        SUM(subtotal) AS total_subtotal,
        SUM(tax_amount) AS total_tax,
        SUM(grand_total) AS total_sales,
        COUNT(*) FILTER (WHERE status = 'completed') AS completed_orders,
        COUNT(*) FILTER (WHERE status = 'cancelled') AS cancelled_orders
      FROM orders
      WHERE order_type = 'online_delivery'
        AND created_at BETWEEN $1 AND $2
      GROUP BY delivery_address
      ORDER BY total_sales DESC;
      `,
      [from, to]
    );

    // Get individual orders grouped by partner
    const ordersResult = await pool.query(
      `
      SELECT 
        id,
        order_number,
        delivery_address AS partner_name,
        customer_name,
        subtotal,
        tax_amount,
        grand_total,
        status,
        created_at
      FROM orders
      WHERE order_type = 'online_delivery'
        AND created_at BETWEEN $1 AND $2
      ORDER BY delivery_address, created_at DESC;
      `,
      [from, to]
    );

    // Group orders by partner
    const ordersByPartner: Record<string, any[]> = {};
    for (const order of ordersResult.rows) {
      const partner = order.partner_name || 'Unknown Partner';
      if (!ordersByPartner[partner]) {
        ordersByPartner[partner] = [];
      }
      ordersByPartner[partner].push(order);
    }

    // Combine summary with orders
    const result = summaryResult.rows.map((summary: any) => ({
      partner_name: summary.partner_name || 'Unknown Partner',
      order_count: Number(summary.order_count),
      total_subtotal: Number(summary.total_subtotal),
      total_tax: Number(summary.total_tax),
      total_sales: Number(summary.total_sales),
      completed_orders: Number(summary.completed_orders),
      cancelled_orders: Number(summary.cancelled_orders),
      orders: ordersByPartner[summary.partner_name || 'Unknown Partner'] || []
    }));

    res.json(result);
  } catch (err) {
    console.error("ONLINE DELIVERY ERROR:", err);
    res.status(500).json({ message: "Failed to fetch online delivery report" });
  }
});

/* ---------------------------------------------------
   8) DELIVERY REPORT (regular delivery orders)
--------------------------------------------------- */
router.get("/delivery", async (req, res) => {
  const range = validateDates(req, res);
  if (!range) return;
  const { from, to } = range;

  try {
    const result = await pool.query(
      `
      SELECT *
      FROM orders
      WHERE order_type = 'delivery'
        AND created_at BETWEEN $1 AND $2;
      `,
      [from, to]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("DELIVERY ERROR:", err);
    res.status(500).json({ message: "Failed to fetch delivery report" });
  }
});

/* ---------------------------------------------------
   8) TAKEAWAY REPORT  (CORRECT TYPE: take_away)
--------------------------------------------------- */
router.get("/takeaway", async (req, res) => {
  const range = validateDates(req, res);
  if (!range) return;
  const { from, to } = range;

  try {
    const result = await pool.query(
      `
      SELECT *
      FROM orders
      WHERE order_type = 'take_away'
        AND created_at BETWEEN $1 AND $2;
      `,
      [from, to]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("TAKEAWAY ERROR:", err);
    res.status(500).json({ message: "Failed to fetch takeaway report" });
  }
});

/* ---------------------------------------------------
   9) VAT DATEWISE REPORT
--------------------------------------------------- */
router.get("/vat/datewise", async (req, res) => {
  const range = validateDates(req, res);
  if (!range) return;
  const { from, to } = range;

  try {
    const result = await pool.query(
      `
      SELECT 
        DATE(created_at) AS date,
        SUM(subtotal) AS taxable_amount,
        SUM(tax_amount) AS vat_amount,
        SUM(grand_total) AS total
      FROM orders
      WHERE created_at BETWEEN $1 AND $2
        AND status != 'cancelled'
      GROUP BY DATE(created_at)
      ORDER BY DATE(created_at);
      `,
      [from, to]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("VAT DATE ERROR:", err);
    res.status(500).json({ message: "Failed to fetch VAT datewise report" });
  }
});

/* ---------------------------------------------------
   10) VAT ITEMWISE REPORT (correct formula)
--------------------------------------------------- */
router.get("/vat/itemwise", async (req, res) => {
  const range = validateDates(req, res);
  if (!range) return;
  const { from, to } = range;

  try {
    const result = await pool.query(
      `
      SELECT 
        mi.name AS item_name,
        SUM(oi.total_price) AS item_total,
        SUM((oi.total_price / NULLIF(o.subtotal,0)) * o.tax_amount) AS vat_amount
      FROM order_items oi
      JOIN menu_items mi ON mi.id = oi.menu_item_id
      JOIN orders o ON o.id = oi.order_id
      WHERE o.created_at BETWEEN $1 AND $2
      GROUP BY mi.name
      ORDER BY item_total DESC;
      `,
      [from, to]
    );

    res.json(result.rows);
  } catch (err) {
    console.error("VAT ITEM ERROR:", err);
    res.status(500).json({ message: "Failed to fetch VAT itemwise report" });
  }
});

/* ---------------------------------------------------
   11) VAT TICKETWISE REPORT
--------------------------------------------------- */
router.get("/vat/ticketwise", async (req, res) => {
  const range = validateDates(req, res);
  if (!range) return;
  const { from, to } = range;

  try {
    const result = await pool.query(
      `
      SELECT 
        order_number,
        subtotal,
        tax_amount,
        grand_total,
        created_at
      FROM orders
      WHERE created_at BETWEEN $1 AND $2
        AND status != 'cancelled'
      ORDER BY created_at DESC;
      `,
      [from, to]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("VAT TICKET ERROR:", err);
    res.status(500).json({ message: "Failed to fetch VAT ticketwise report" });
  }
});

/* ---------------------------------------------------
   12) GIFT REPORT (using loyalty transactions)
--------------------------------------------------- */
router.get("/gifts", async (req, res) => {
  const range = validateDates(req, res);
  if (!range) return;
  const { from, to } = range;

  try {
    const result = await pool.query(
      `
      SELECT *
      FROM loyalty_transactions
      WHERE created_at BETWEEN $1 AND $2
        AND (transaction_type = 'redeemed' OR description ILIKE '%gift%');
      `,
      [from, to]
    );

    res.json(result.rows);
  } catch (err) {
    console.error("GIFT ERROR:", err);
    res.status(500).json({ message: "Failed to fetch gift report" });
  }
});

export default router;
