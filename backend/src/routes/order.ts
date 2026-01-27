// backend/src/routes/order.ts
import { Router, type Request, type Response } from "express"
import { pool } from "../server"
import * as htmlPdf from "html-pdf-node"
import * as fs from "fs"
import * as path from "path"
import axios from "axios"
import { routeToKitchenStations, routeDiffsToKitchenStations } from "../printer"

const router = Router()

// WhatsApp notification helper
const WHATSAPP_API_URL = process.env.WHATSAPP_API_URL || "https://bot.stevefez.com"

async function sendOrderStatusNotification(
  phone: string,
  orderNumber: string,
  status: string,
  orderType = "dine-in",
  estimatedTime?: string,
) {
  try {
    await axios.post(
      `${WHATSAPP_API_URL}/api/order-status-update`,
      {
        phone,
        orderNumber,
        status,
        orderType,
        estimatedTime,
      },
      {
        timeout: 5000, // Don't block order updates if WhatsApp is slow
      },
    )
    console.log(`✅ WhatsApp notification sent to ${phone} for order ${orderNumber} - ${status}`)
  } catch (error: any) {
    console.error(`❌ Failed to send WhatsApp notification:`, error.message)
    // Don't throw - notification failure shouldn't block order updates
  }
}

// GET all orders
router.get("/", async (req: Request, res: Response) => {
  const client = await pool.connect()
  try {
    const { date, orderType, search } = req.query
    let baseQuery = `
      SELECT o.*, 
             c.name AS customer_name, 
             c.mobile_number, 
             rt.name AS table_name, 
             s.name AS section_name, 
             f.name AS floor_name, 
             w.name AS waiter_name, 
             w.employee_id AS waiter_employee_id,
             dd.name AS delivery_driver_name,
             dd.employee_id AS delivery_driver_employee_id,
             dd.phone_number AS delivery_driver_phone,
             b.bill_number
      FROM orders o
      LEFT JOIN bills b ON o.id = b.order_id
      LEFT JOIN customers c ON o.customer_id = c.id
      LEFT JOIN restaurant_tables rt ON o.restaurant_table_id = rt.id
      LEFT JOIN sections s ON rt.section_id = s.id
      LEFT JOIN floors f ON s.floor_id = f.id
      LEFT JOIN waiters w ON o.waiter_id = w.id
      LEFT JOIN delivery_drivers dd ON o.delivery_driver_id = dd.id
    `
    const params: any[] = []
    const whereClauses: string[] = []

    // If search is provided, we skip the date filter (unless date is explicitly forced, but usually search is global)
    // Actually, let's allow combining them if needed, but usually search overrides date context in this UX.
    // However, if the user picks a date AND searches, maybe they want to search within that date?
    // The user requirement says "where can i check the previous order", implying looking up past history.
    // Let's say: If search is present, ignore date unless specifically requested?
    // Let's implement OR logic: If search is present, we filter by search.
    // BUT we must be careful not to return MILLIONS of rows. LIMIT is good practice.

    if (search && typeof search === "string" && search.trim().length > 0) {
      const searchTerm = `%${search.trim()}%`
      params.push(searchTerm)
      // Search in: order_number, receipt_number, bill_number (bills table), customer name, customer mobile
      // Note: we need to handle the params.length index carefully.
      const idx = params.length
      whereClauses.push(`(
        o.order_number ILIKE $${idx} OR 
        o.receipt_number ILIKE $${idx} OR
        b.bill_number ILIKE $${idx} OR 
        c.name ILIKE $${idx} OR 
        c.mobile_number ILIKE $${idx}
      )`)
    }

    // Expect date as "YYYY-MM-DD" (local calendar date from client)
    if (date && typeof date === "string") {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(400).json({ message: "Invalid date format. Expected YYYY-MM-DD" })
      }
      params.push(date)
      whereClauses.push(`(o.created_at AT TIME ZONE current_setting('TIMEZONE'))::date = $${params.length}::date`)
    }

    if (orderType && orderType !== "all" && typeof orderType === "string") {
      params.push(orderType)
      whereClauses.push(`o.order_type = $${params.length}`)
    }

    if (whereClauses.length > 0) {
      baseQuery += ` WHERE ${whereClauses.join(" AND ")}`
    }

    baseQuery += ` ORDER BY o.created_at DESC`
    // Add a limit if searching to prevent huge payload
    if (search) {
      baseQuery += ` LIMIT 50`
    }
    baseQuery += `;`
    console.log("Executing query for fetching orders:", baseQuery, params)
    const ordersResult = await client.query(baseQuery, params)
    const orders = ordersResult.rows

    if (orders.length > 0) {
      const orderIds = orders.map((o) => o.id)

      // Determine underlying id type for orders.id
      const typeRes = await client.query(
        "SELECT udt_name FROM information_schema.columns WHERE table_name='orders' AND column_name='id' AND table_schema='public' LIMIT 1",
      )
      const udt = typeRes.rows[0] ? typeRes.rows[0].udt_name : null

      let itemsResult
      if (udt === "int4" || udt === "int8") {
        const numericIds = orderIds.map((id) => Number(id))
        itemsResult = await client.query(
          `
          SELECT oi.order_id,
                 oi.id,
                 oi.quantity,
                 COALESCE(oi.unit_price, mi.price) AS unit_price,
                 oi.total_price,
                 oi.is_complimentary AS is_complimentary,
                 COALESCE(oi.complimentary_quantity, 0) AS complimentary_quantity,
                 oi.portion_name,
                 oi.notes,
                 mi.name as menu_item_name
          FROM order_items oi
          JOIN menu_items mi ON mi.id = oi.menu_item_id
          WHERE oi.order_id = ANY($1::int4[])
        `,
          [numericIds],
        )
      } else {
        itemsResult = await client.query(
          `
          SELECT oi.order_id,
                 oi.id,
                 oi.quantity,
                 COALESCE(oi.unit_price, mi.price) AS unit_price,
                 oi.total_price,
                 oi.is_complimentary AS is_complimentary,
                 COALESCE(oi.complimentary_quantity, 0) AS complimentary_quantity,
                 oi.portion_name,
                 oi.notes,
                 mi.name as menu_item_name
          FROM order_items oi
          JOIN menu_items mi ON mi.id = oi.menu_item_id
          WHERE oi.order_id = ANY($1::uuid[])
        `,
          [orderIds],
        )
      }

      orders.forEach((order) => {
        order.order_items = itemsResult.rows.filter((item) => item.order_id === order.id)
      })
    }

    res.json(orders)
  } catch (error) {
    console.error("Error fetching orders:", error)
    res.status(500).json({ message: "Internal Server Error" })
  } finally {
    client.release()
  }
})

// GET a single order by ID with all details
router.get("/:id", async (req: Request, res: Response) => {
  const { id } = req.params
  const client = await pool.connect()
  try {
    const orderResult = await client.query(
      `
      SELECT o.*, 
             c.name AS customer_name, 
             c.mobile_number, 
             c.loyalty_points,
             c.status as customer_status,
             rt.name AS table_name, 
             s.name AS section_name, 
             f.name AS floor_name,
             w.name AS waiter_name,
             w.employee_id AS waiter_employee_id,
             w.id AS waiter_id,
             dd.name AS delivery_driver_name,
             dd.employee_id AS delivery_driver_employee_id,
             dd.phone_number AS delivery_driver_phone
      FROM orders o
      LEFT JOIN customers c ON o.customer_id = c.id
      LEFT JOIN restaurant_tables rt ON o.restaurant_table_id = rt.id
      LEFT JOIN sections s ON rt.section_id = s.id
      LEFT JOIN floors f ON s.floor_id = f.id
      LEFT JOIN waiters w ON o.waiter_id = w.id
      LEFT JOIN delivery_drivers dd ON o.delivery_driver_id = dd.id
      WHERE o.id = $1
    `,
      [id],
    )

    if (orderResult.rows.length === 0) {
      return res.status(404).json({ message: "Order not found" })
    }

    const order = orderResult.rows[0]

    // LAZY INIT: Assign Persistent Receipt Number if missing
    if (!order.receipt_number) {
      const updateResult = await client.query(
        "UPDATE orders SET receipt_number = nextval('receipt_number_seq')::text WHERE id = $1 RETURNING receipt_number",
        [id]
      );
      order.receipt_number = updateResult.rows[0].receipt_number;
    }

    // Fetch order items with menu item details
    const itemsResult = await client.query(
      `
      SELECT oi.id,
             oi.menu_item_id,
             oi.quantity,
             COALESCE(oi.unit_price, mi.price) AS unit_price,
             oi.total_price,
             oi.is_complimentary AS is_complimentary,
             COALESCE(oi.complimentary_quantity, 0) AS complimentary_quantity,
             oi.portion_name,
             oi.notes,
             mi.name as menu_item_name,
             mi.name_ar as menu_item_name_ar
      FROM order_items oi 
      JOIN menu_items mi ON mi.id = oi.menu_item_id
      WHERE oi.order_id = $1
    `,
      [id],
    )

    order.order_items = itemsResult.rows

    // Calculate loyalty points that will be earned for this order (if customer is verified)
    if (order.customer_status === "verified" && order.mobile_number) {
      try {
        const settingsResult = await client.query(
          "SELECT loyalty_points_enabled, loyalty_points_per_100 FROM restaurant_settings LIMIT 1",
        )

        if (settingsResult.rows.length > 0) {
          const { loyalty_points_enabled, loyalty_points_per_100 } = settingsResult.rows[0]

          if (loyalty_points_enabled) {
            const pointsEarned = Math.floor((order.grand_total / 100) * loyalty_points_per_100)
            order.loyalty_points_earned = pointsEarned
            order.loyalty_points_rate = loyalty_points_per_100
          } else {
            order.loyalty_points_earned = 0
          }
        }
      } catch (err) {
        console.warn("Could not fetch loyalty settings:", err)
        order.loyalty_points_earned = 0
      }
    } else {
      order.loyalty_points_earned = 0
    }

    res.json(order)
  } catch (error) {
    console.error("Error fetching order:", error)
    res.status(500).json({ message: "Internal Server Error" })
  } finally {
    client.release()
  }
})

// POST generate PDF bill for an order
router.post("/:id/generate-pdf", async (req: Request, res: Response) => {
  const { id } = req.params
  const { tableName } = req.body

  const client = await pool.connect()
  try {
    // Fetch order details
    const orderResult = await client.query(
      `
      SELECT o.*, 
             c.name AS customer_name, 
             c.mobile_number, 
             c.loyalty_points,
             c.status as customer_status,
             rt.name AS table_name, 
             s.name AS section_name, 
             f.name AS floor_name,
             w.name AS waiter_name,
             w.employee_id AS waiter_employee_id
      FROM orders o
      LEFT JOIN customers c ON o.customer_id = c.id
      LEFT JOIN restaurant_tables rt ON o.restaurant_table_id = rt.id
      LEFT JOIN sections s ON rt.section_id = s.id
      LEFT JOIN floors f ON s.floor_id = f.id
      LEFT JOIN waiters w ON o.waiter_id = w.id
      WHERE o.id = $1
    `,
      [id],
    )

    if (orderResult.rows.length === 0) {
      return res.status(404).json({ message: "Order not found" })
    }

    const order = orderResult.rows[0]

    // Fetch order items
    const itemsResult = await client.query(
      `
      SELECT oi.id,
             oi.quantity,
             COALESCE(oi.unit_price, mi.price) AS unit_price,
             oi.total_price,
             oi.is_complimentary AS is_complimentary,
             COALESCE(oi.complimentary_quantity, 0) AS complimentary_quantity,
             oi.portion_name,
             oi.notes,
             mi.name as menu_item_name,
             mi.name_ar as menu_item_name_ar
      FROM order_items oi 
      JOIN menu_items mi ON mi.id = oi.menu_item_id
      WHERE oi.order_id = $1
    `,
      [id],
    )

    order.order_items = itemsResult.rows

    // Calculate loyalty points
    if (order.customer_status === "verified" && order.mobile_number) {
      const settingsResult = await client.query(
        "SELECT loyalty_points_enabled, loyalty_points_per_100 FROM restaurant_settings LIMIT 1",
      )

      if (settingsResult.rows.length > 0) {
        const { loyalty_points_enabled, loyalty_points_per_100 } = settingsResult.rows[0]

        if (loyalty_points_enabled) {
          const pointsEarned = Math.floor((order.grand_total / 100) * loyalty_points_per_100)
          order.loyalty_points_earned = pointsEarned
          order.loyalty_points_rate = loyalty_points_per_100
        } else {
          order.loyalty_points_earned = 0
        }
      }
    } else {
      order.loyalty_points_earned = 0
    }

    // Fetch restaurant settings
    const restaurantSettings = await client.query("SELECT * FROM restaurant_settings LIMIT 1")
    const settings = restaurantSettings.rows[0] || {
      restaurant_name: "Restaurant POS",
      address: "",
      contact_number: "",
      registration_number: "",
    }

    // Generate HTML for the bill
    const currency = settings && settings.currency ? settings.currency : "OMR"
    const locale = currency === "OMR" ? "en-OM" : "en-IN"
    const formatCurrencyLocal = (amount: number | string) => {
      const numAmount = typeof amount === "string" ? Number.parseFloat(amount) : amount
      try {
        return new Intl.NumberFormat(locale, { style: "currency", currency }).format(numAmount as number)
      } catch (err) {
        // Fallback: prefix currency code
        return `${currency}${(numAmount as number).toFixed(2)}`
      }
    }
    const formatDateTime = (date: string) => {
      const d = new Date(date)
      return d.toLocaleString("en-IN", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    }

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
          ${settings.address ? `<div class="center">${settings.address}</div>` : ""}
          ${settings.contact_number ? `<div class="center">Tel: ${settings.contact_number}</div>` : ""}
          ${settings.registration_number ? `<div class="center" style="font-size: 10px;">Reg: ${settings.registration_number}</div>` : ""}
        </div>

        <div class="row">
          <span>Table:</span>
          <span class="bold">${tableName || order.table_name || "N/A"}</span>
        </div>
        <div class="row">
          <span>Order #:</span>
          <span>${order.order_number}</span>
        </div>
        <div class="row">
          <span>Date:</span>
          <span>${formatDateTime(order.created_at)}</span>
        </div>
        ${order.customer_name
        ? `
        <div class="row">
          <span>Customer:</span>
          <span>${order.customer_name}</span>
        </div>
        `
        : ""
      }
        ${order.waiter_name
        ? `
        <div class="row">
          <span>Served by:</span>
          <span>${order.waiter_name} (${order.waiter_employee_id})</span>
        </div>
        `
        : ""
      }

        <div class="line"></div>

        <div style="margin: 15px 0;">
          ${order.order_items && order.order_items.length > 0
        ? order.order_items
          .map((item: any) => {
            const nameWithPortion = item.portion_name
              ? `${item.menu_item_name} (${item.portion_name})`
              : item.menu_item_name
            return `
              <div class="item-row">
                <div class="item-name">${nameWithPortion}</div>
                <div class="item-details">
                  <span>${item.quantity} x ${formatCurrencyLocal(item.unit_price)}</span>
                  <span>${formatCurrencyLocal(item.total_price)}</span>
                </div>
              </div>
            `
          })
          .join("")
        : '<div class="center">No items</div>'
      }
        </div>

        <div class="total-section">
          <div class="row">
            <span>Subtotal:</span>
            <span>${formatCurrencyLocal(order.subtotal)}</span>
          </div>
          <div class="row">
            <span>Tax:</span>
            <span>${formatCurrencyLocal(order.tax_amount)}</span>
          </div>
          <div class="row total-row">
            <span>TOTAL:</span>
            <span>${formatCurrencyLocal(order.grand_total)}</span>
          </div>
        </div>

        ${order.customer_status === "verified" && order.mobile_number
        ? `
        <div class="line"></div>
        <div class="loyalty-box">
          <div class="center bold" style="font-size: 14px; margin-bottom: 8px;">🎉 Loyalty Rewards 🎉</div>
          ${order.loyalty_points_earned > 0
          ? `
            <div class="row" style="color: #fff; margin: 6px 0; font-size: 13px;">
              <span>Points Earned:</span>
              <span class="bold" style="font-size: 16px;">+${order.loyalty_points_earned} pts</span>
            </div>
          `
          : `
            <div class="center" style="font-size: 12px; opacity: 0.9;">
              Loyalty points not earned for this transaction
            </div>
          `
        }
          <div class="row" style="color: #fff; margin: 8px 0 4px 0; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.3);">
            <span>Total Points Balance:</span>
            <span class="bold" style="font-size: 16px;">${(order.loyalty_points || 0) + (order.loyalty_points_earned || 0)} pts</span>
          </div>
        </div>
        `
        : ""
      }

        <div class="footer">
          <div class="center bold" style="margin-bottom: 5px;">Thank you for dining with us!</div>
          <div class="center">Please visit again</div>
        </div>
      </body>
      </html>
    `

    // Generate PDF
    const file = { content: billHTML }
    const options = {
      format: "A4",
      margin: { top: "10mm", right: "10mm", bottom: "10mm", left: "10mm" },
      path: "",
    }

    // Save PDF to bill_output folder
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, -5)
    const filename = `Bill-${order.order_number}-${timestamp}.pdf`

    const billOutputDir = path.join(__dirname, "../../bill_output")
    if (!fs.existsSync(billOutputDir)) {
      fs.mkdirSync(billOutputDir, { recursive: true })
    }

    const outputPath = path.join(billOutputDir, filename)
      ; (options as any).path = outputPath

    try {
      const pdfResult: any = await (htmlPdf as any).generatePdf(file, options)
      if (pdfResult && Buffer.isBuffer(pdfResult)) {
        fs.writeFileSync(outputPath, pdfResult)
      }
    } catch (pdfError) {
      console.error("PDF generation error:", pdfError)
      throw pdfError
    }

    res.json({
      success: true,
      message: "Bill generated successfully",
      filename,
      path: outputPath,
    })
  } catch (error) {
    console.error("Error generating PDF bill:", error)
    res.status(500).json({ message: "Failed to generate PDF bill" })
  } finally {
    client.release()
  }
})

// POST a new order
router.post("/", async (req: Request, res: Response) => {
  const { order, items } = req.body
  const client = await pool.connect()
  try {
    await client.query("BEGIN")

    // VALIDATION: Check if System is Online (Admin/Manager logged in)
    const sessionCheck = await client.query("SELECT 1 FROM pos_sessions WHERE status = 'active' LIMIT 1");
    if (sessionCheck.rows.length === 0) {
      return res.status(403).json({ message: "System Offline. Manager must login to place orders." });
    }

    // VALIDATION 1: Dine-in orders must have a table assigned
    if (order.order_type === "dine_in" && !order.restaurant_table_id) {
      return res.status(400).json({ message: "Table selection is required for dine-in orders." })
    }

    // Get tax rate from settings
    const settingsResult = await client.query("SELECT tax_rate FROM restaurant_settings LIMIT 1")
    // tax_rate is stored as percentage (e.g. 5 for 5%), so we divide by 100
    const taxRatePercent = settingsResult.rows.length > 0 ? Number(settingsResult.rows[0].tax_rate) : 5
    const taxRate = taxRatePercent / 100

    // Get section apply_vat if dine-in order
    let sectionApplyVat = true // Default to true for non-dine-in orders
    if (order.order_type === "dine_in" && order.restaurant_table_id) {
      const tableResult = await client.query(
        `SELECT s.apply_vat 
         FROM restaurant_tables rt
         JOIN sections s ON rt.section_id = s.id
         WHERE rt.id = $1`,
        [order.restaurant_table_id]
      )
      if (tableResult.rows.length > 0) {
        sectionApplyVat = tableResult.rows[0].apply_vat
      }
    }

    // VALIDATION 2: Check if the selected table is available (for dine-in orders)
    if (order.order_type === "dine_in" && order.restaurant_table_id) {
      const tableCheck = await client.query("SELECT status, linked_order_id FROM restaurant_tables WHERE id = $1", [
        order.restaurant_table_id,
      ])

      if (tableCheck.rows.length === 0) {
        return res.status(404).json({ message: "Selected table not found." })
      }

      const table = tableCheck.rows[0]

      // Check if table is linked to an existing order (part of a combination)
      if (table.linked_order_id) {
        return res.status(400).json({
          message:
            "This table is part of a combined group with an active order. Please add items to the existing order or wait until it is completed.",
        })
      }

      // Check if table is occupied with a pending order
      if (table.status === "occupied") {
        const existingOrder = await client.query(
          "SELECT id FROM orders WHERE restaurant_table_id = $1 AND status = 'pending'",
          [order.restaurant_table_id],
        )

        if (existingOrder.rows.length > 0) {
          return res.status(400).json({
            message: "This table already has an active order. Please add items to the existing order.",
          })
        }
      }

      if (table.status !== "available" && table.status !== "occupied") {
        return res.status(400).json({
          message: `Table is not available. Current status: ${table.status}. Please select a different table.`,
        })
      }
    }

    // WAITER ASSIGNMENT LOGIC
    let assignedWaiterId = order.waiter_id || null

    // Check if this table already has a pending order with a waiter assigned
    if (order.order_type === "dine_in" && order.restaurant_table_id) {
      const existingOrderResult = await client.query(
        `SELECT waiter_id FROM orders 
         WHERE restaurant_table_id = $1 
         AND status IN ('pending') 
         AND waiter_id IS NOT NULL
         ORDER BY created_at DESC 
         LIMIT 1`,
        [order.restaurant_table_id],
      )

      if (existingOrderResult.rows.length > 0 && existingOrderResult.rows[0].waiter_id) {
        assignedWaiterId = existingOrderResult.rows[0].waiter_id
        console.log(`Table already has orders - assigning same waiter: ${assignedWaiterId}`)
      }
    }

    // CUSTOMER HANDLING ...
    let customerId = null
    if (order.mobile_number && order.mobile_number.trim()) {
      const customerResult = await client.query("SELECT id, status FROM customers WHERE mobile_number = $1", [
        order.mobile_number,
      ])
      if (customerResult.rows.length > 0) {
        customerId = customerResult.rows[0].id
        if (customerResult.rows[0].status !== "verified") {
          await client.query("UPDATE customers SET status = 'verified' WHERE id = $1", [customerId])
        }
      } else {
        const newCustomerResult = await client.query(
          "INSERT INTO customers (name, mobile_number, status) VALUES ($1, $2, $3) RETURNING id",
          [order.customer_name || "Unknown", order.mobile_number, "verified"],
        )
        customerId = newCustomerResult.rows[0].id
      }
    } else {
      const walkInCustomerResult = await client.query(
        "INSERT INTO customers (name, status) VALUES ($1, $2) RETURNING id",
        [order.customer_name || "Walk-in", "unverified"],
      )
      customerId = walkInCustomerResult.rows[0].id
    }

    // Recalculate VAT based on individual items and section settings
    let calculatedSubtotal = 0
    let calculatedVAT = 0

    // Get menu items with their apply_vat flag
    const menuItemIds = items.map((item: any) => item.menu_item_id)
    const menuItemsResult = await client.query(
      `SELECT id, apply_vat FROM menu_items WHERE id = ANY($1::uuid[])`,
      [menuItemIds]
    )
    const menuItemsMap = new Map(menuItemsResult.rows.map(row => [row.id, row.apply_vat]))

    for (const item of items) {
      const itemTotal = Number(item.total_price)
      calculatedSubtotal += itemTotal

      // Only apply VAT if both section and item have VAT enabled
      const itemApplyVat = menuItemsMap.get(item.menu_item_id) || false
      if (sectionApplyVat && itemApplyVat) {
        calculatedVAT += itemTotal * taxRate
      }
    }

    // Round VAT to 2 decimal places
    calculatedVAT = Math.round(calculatedVAT * 100) / 100
    const calculatedGrandTotal = calculatedSubtotal + calculatedVAT

    // Generate daily order number using atomic database function (thread-safe, auto-resets daily)
    // This ensures unified order numbers across all UIs (POS, waiter tablets, etc.)
    const orderNumberResult = await client.query(`SELECT get_next_daily_order_number() as order_number`)
    const dailyOrderNumber = String(orderNumberResult.rows[0].order_number)

    // Generate sequential receipt number using database sequence (1, 2, 3, ...)
    const receiptNumberResult = await client.query(`SELECT nextval('receipt_number_seq') as receipt_number`)
    const receiptNumber = String(receiptNumberResult.rows[0].receipt_number)

    const newOrderQuery = `
      INSERT INTO orders (order_number, receipt_number, customer_id, order_type, subtotal, tax_amount, grand_total, status, notes, restaurant_table_id, waiter_id, take_away_method, car_make, car_license_plate, delivery_address)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) RETURNING *;`
    // Takeaway and delivery orders require confirmation before preparation
    // Dine-in orders are auto-confirmed
    const orderStatus = (order.order_type === "delivery" || order.order_type === "take_away" || order.order_type === "online_delivery")
      ? "awaiting_confirmation"
      : "confirmed"

    const orderParams = [
      dailyOrderNumber,
      receiptNumber,
      customerId,
      order.order_type,
      calculatedSubtotal,
      calculatedVAT,
      calculatedGrandTotal,
      orderStatus,
      order.notes || null,
      order.restaurant_table_id || null,
      assignedWaiterId,
      order.take_away_method || null,
      order.car_make || null,
      order.car_license_plate || null,
      order.delivery_address || null,
    ]
    const orderResult = await client.query(newOrderQuery, orderParams)
    const newOrder = orderResult.rows[0]

    if (order.order_type === "dine_in" && order.restaurant_table_id) {
      await client.query(
        "UPDATE restaurant_tables SET status = 'occupied', linked_order_id = $1, updated_at = NOW() WHERE id = $2",
        [newOrder.id, order.restaurant_table_id],
      )
    }

    for (const item of items) {
      await client.query(
        "INSERT INTO order_items (order_id, menu_item_id, quantity, unit_price, total_price, is_complimentary, complimentary_quantity, portion_name, notes) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9);",
        [
          newOrder.id,
          item.menu_item_id,
          item.quantity,
          item.unit_price,
          item.total_price,
          item.is_complimentary === true,
          item.complimentary_quantity || 0,
          item.portion_name || null,
          item.notes || null,
        ],
      )

      if (!item.is_complimentary && item.quantity > 0) {
        await client.query("UPDATE menu_items SET stock = stock - $1, updated_at = NOW() WHERE id = $2", [
          item.quantity,
          item.menu_item_id,
        ])
      }
    }

    await client.query("COMMIT")

    const finalOrderResult = await client.query(
      `
      SELECT o.*, 
              c.name as customer_name, 
              c.mobile_number, 
              w.name as waiter_name, 
              w.employee_id as waiter_employee_id,
              -- b.bill_number, -- Removed join to bills table
              (SELECT json_agg(
                 json_build_object(
                   'menu_item_name', mi.name, 
                   'quantity', oi.quantity, 
                   'id', oi.id, 
                   'unit_price', COALESCE(oi.unit_price, mi.price), 
                   'total_price', oi.total_price, 
                   'is_complimentary', COALESCE(oi.is_complimentary,false), 
                   'complimentary_quantity', COALESCE(oi.complimentary_quantity, 0), 
                   'portion_name', oi.portion_name,
                   'notes', oi.notes
                 )
               ) 
               FROM order_items oi 
               JOIN menu_items mi ON mi.id = oi.menu_item_id 
               WHERE oi.order_id = o.id) as order_items
       FROM orders o 
       LEFT JOIN customers c ON o.customer_id = c.id
       LEFT JOIN waiters w ON o.waiter_id = w.id
       -- LEFT JOIN (SELECT order_id, bill_number FROM bills WHERE order_id = $1 ORDER BY created_at DESC LIMIT 1) b ON b.order_id = o.id -- Removed join to bills table
       WHERE o.id = $1;
    `,
      [newOrder.id],
    )

    // Emit WebSocket event for new order
    try {
      const { getIO } = await import("../websocket")
      getIO().emit("order:created", {
        orderId: newOrder.id,
        orderType: newOrder.order_type,
        orderNumber: newOrder.order_number,
        customerName: finalOrderResult.rows[0].customer_name || null,
        deliveryAddress: newOrder.delivery_address || null,
      })
    } catch (err) {
      console.warn("WebSocket not available:", err)
    }

    // Route order to kitchen station printers
    try {
      const orderData = finalOrderResult.rows[0]
      await routeToKitchenStations(pool, newOrder.id, {
        order_number: newOrder.order_number,
        table_name: orderData.table_name || null,
        order_type: newOrder.order_type,
        waiter_name: orderData.waiter_name || null,
        notes: newOrder.notes || null,
      })
    } catch (err) {
      console.warn("Kitchen routing error (non-blocking):", err)
    }

    res.status(201).json({ ...finalOrderResult.rows[0], order_items: finalOrderResult.rows[0].order_items || [] })
  } catch (error) {
    await client.query("ROLLBACK")
    console.error("Error creating order:", error)
    res.status(500).json({ message: "Failed to create order" })
  } finally {
    client.release()
  }
})

// PUT update an order's items, totals, and notes
router.put("/:id", async (req: Request, res: Response) => {
  const { id } = req.params
  const { items, subtotal, tax_amount, grand_total, notes } = req.body
  const client = await pool.connect()
  try {
    await client.query("BEGIN")

    // Get order details to check table/section VAT
    const orderResult = await client.query(
      "SELECT order_type, restaurant_table_id FROM orders WHERE id = $1",
      [id]
    )
    if (orderResult.rows.length === 0) {
      return res.status(404).json({ message: "Order not found" })
    }
    const order = orderResult.rows[0]

    // Get tax rate from settings
    const settingsResult = await client.query("SELECT tax_rate FROM restaurant_settings LIMIT 1")
    const taxRate = settingsResult.rows.length > 0 ? Number(settingsResult.rows[0].tax_rate) : 0.05

    // Get section apply_vat if dine-in order
    let sectionApplyVat = true
    if (order.order_type === "dine_in" && order.restaurant_table_id) {
      const tableResult = await client.query(
        `SELECT s.apply_vat 
         FROM restaurant_tables rt
         JOIN sections s ON rt.section_id = s.id
         WHERE rt.id = $1`,
        [order.restaurant_table_id]
      )
      if (tableResult.rows.length > 0) {
        sectionApplyVat = tableResult.rows[0].apply_vat
      }
    }

    // Get menu items with their apply_vat flag
    const menuItemIds = items.map((item: any) => item.menu_item_id)
    const menuItemsResult = await client.query(
      `SELECT id, apply_vat FROM menu_items WHERE id = ANY($1::uuid[])`,
      [menuItemIds]
    )
    const menuItemsMap = new Map(menuItemsResult.rows.map(row => [row.id, row.apply_vat]))

    // Recalculate VAT based on individual items
    let calculatedSubtotal = 0
    let calculatedVAT = 0

    for (const item of items) {
      const itemTotal = Number(item.total_price)
      calculatedSubtotal += itemTotal

      // Only apply VAT if both section and item have VAT enabled
      const itemApplyVat = menuItemsMap.get(item.menu_item_id) || false
      if (sectionApplyVat && itemApplyVat) {
        calculatedVAT += itemTotal * taxRate
      }
    }

    // Round VAT to 2 decimal places
    calculatedVAT = Math.round(calculatedVAT * 100) / 100
    const calculatedGrandTotal = calculatedSubtotal + calculatedVAT

    const existingItems = await client.query(
      "SELECT menu_item_id, quantity, is_complimentary FROM order_items WHERE order_id = $1",
      [id],
    )

    for (const existingItem of existingItems.rows) {
      if (!existingItem.is_complimentary && existingItem.quantity > 0) {
        await client.query("UPDATE menu_items SET stock = stock + $1, updated_at = NOW() WHERE id = $2", [
          existingItem.quantity,
          existingItem.menu_item_id,
        ])
      }
    }

    const updatedOrderResult = await client.query(
      `UPDATE orders 
       SET subtotal = $1, tax_amount = $2, grand_total = $3, notes = $4, updated_at = NOW() 
       WHERE id = $5 RETURNING *`,
      [calculatedSubtotal, calculatedVAT, calculatedGrandTotal, notes, id],
    )
    if (updatedOrderResult.rows.length === 0) throw new Error("Order not found")

    await client.query("DELETE FROM order_items WHERE order_id = $1", [id])

    for (const item of items) {
      await client.query(
        "INSERT INTO order_items (order_id, menu_item_id, quantity, unit_price, total_price, is_complimentary, complimentary_quantity, portion_name, notes) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)",
        [
          id,
          item.menu_item_id,
          item.quantity,
          item.unit_price,
          item.total_price,
          item.is_complimentary === true,
          item.complimentary_quantity || 0,
          item.portion_name || null,
          item.notes || null,
        ],
      )

      if (!item.is_complimentary && item.quantity > 0) {
        await client.query("UPDATE menu_items SET stock = stock - $1, updated_at = NOW() WHERE id = $2", [
          item.quantity,
          item.menu_item_id,
        ])
      }
    }

    await client.query("COMMIT")

    // Calculate diffs for kitchen routing (new or updated items)
    const existingItemsMap = new Map<string, number>()
    existingItems.rows.forEach((item: any) => {
      existingItemsMap.set(item.menu_item_id, item.quantity)
    })

    // Get menu item names for the diff items
    const menuItemNamesResult = await client.query(
      `SELECT id, name FROM menu_items WHERE id = ANY($1::uuid[])`,
      [items.map((i: any) => i.menu_item_id)]
    )
    const menuItemNames = new Map<string, string>()
    menuItemNamesResult.rows.forEach((row: any) => {
      menuItemNames.set(row.id, row.name)
    })

    const diffs: any[] = []
    for (const item of items) {
      const existingQty = existingItemsMap.get(item.menu_item_id) || 0
      if (existingQty === 0) {
        // New item
        diffs.push({
          menu_item_id: item.menu_item_id,
          name: menuItemNames.get(item.menu_item_id) || "Unknown",
          quantity: item.quantity,
          unit_price: item.unit_price,
          notes: item.notes || null,
          portion_name: item.portion_name || null,
          status: "NEW",
        })
      } else if (item.quantity > existingQty) {
        // Quantity increased - only send the additional quantity
        diffs.push({
          menu_item_id: item.menu_item_id,
          name: menuItemNames.get(item.menu_item_id) || "Unknown",
          quantity: item.quantity - existingQty,
          unit_price: item.unit_price,
          notes: item.notes || null,
          portion_name: item.portion_name || null,
          status: "UPDATED",
        })
      }
    }

    const finalOrderResult = await client.query(
      `
      SELECT o.*, c.name as customer_name, c.mobile_number, w.name as waiter_name, w.employee_id as waiter_employee_id,
           b.bill_number,
           rt.name as table_name,
           (SELECT json_agg(
              json_build_object(
                'menu_item_id',      oi.menu_item_id,
                'menu_item_name',    mi.name,
                'quantity',          oi.quantity,
                'id',                oi.id,
                'unit_price',        oi.unit_price,
                'total_price',       oi.total_price,
                'is_complimentary',  COALESCE(oi.is_complimentary,false),
                'complimentary_quantity', COALESCE(oi.complimentary_quantity, 0),
                'portion_name',      oi.portion_name,
                'notes',             oi.notes
              )
            ) 
          FROM order_items oi
          JOIN menu_items mi ON mi.id = oi.menu_item_id
          WHERE oi.order_id = o.id) as order_items
      FROM orders o 
      LEFT JOIN customers c ON o.customer_id = c.id
      LEFT JOIN waiters w ON o.waiter_id = w.id
      LEFT JOIN restaurant_tables rt ON o.restaurant_table_id = rt.id
      LEFT JOIN (SELECT order_id, bill_number FROM bills WHERE order_id = $1 ORDER BY created_at DESC LIMIT 1) b ON b.order_id = o.id
      WHERE o.id = $1;
    `,
      [id],
    )

    // Route diffs to kitchen stations if there are any
    if (diffs.length > 0) {
      try {
        const orderData = finalOrderResult.rows[0]
        await routeDiffsToKitchenStations(pool, diffs, {
          order_number: orderData.order_number,
          table_name: orderData.table_name || null,
          order_type: orderData.order_type,
          waiter_name: orderData.waiter_name || null,
          notes: orderData.notes || null,
        })
      } catch (err) {
        console.warn("Kitchen diff routing error (non-blocking):", err)
      }
    }

    res.json({
      ...finalOrderResult.rows[0],
      order_items: finalOrderResult.rows[0].order_items || [],
    })
  } catch (error) {
    await client.query("ROLLBACK")
    console.error("Error updating order:", error)
    res.status(500).json({ message: "Failed to update order" })
  } finally {
    client.release()
  }
})

// PUT update an order's status
router.put("/:id/status", async (req: Request, res: Response) => {
  const { id } = req.params
  const { status } = req.body
  if (!["completed", "cancelled", "pending", "confirmed", "preparing", "ready", "awaiting_confirmation", "ready_for_pickup", "out_for_delivery"].includes(status)) {
    return res.status(400).json({ message: "Invalid status provided." })
  }
  const client = await pool.connect()
  try {
    await client.query("BEGIN")

    // Fetch order details before update for notification
    const orderBeforeUpdate = await client.query(
      `SELECT o.*, 
              c.mobile_number,
              dd.name AS delivery_driver_name,
              dd.employee_id AS delivery_driver_employee_id,
              dd.phone_number AS delivery_driver_phone
       FROM orders o 
       LEFT JOIN customers c ON o.customer_id = c.id 
       LEFT JOIN delivery_drivers dd ON o.delivery_driver_id = dd.id
       WHERE o.id = $1`,
      [id],
    )

    const updatedOrderResult = await client.query(
      "UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *",
      [status, id],
    )
    if (updatedOrderResult.rows.length === 0) throw new Error("Order not found.")

    if (status === "completed") {
      const orderItemsResult = await client.query("SELECT * FROM order_items WHERE order_id = $1", [id])
      for (const item of orderItemsResult.rows) {
        const recipeResult = await client.query("SELECT * FROM recipes WHERE menu_item_id = $1", [item.menu_item_id])
        for (const ingredient of recipeResult.rows) {
          const quantityToDeduct = Number(item.quantity) * Number(ingredient.quantity_used)
          await client.query("UPDATE inventory SET quantity = quantity - $1 WHERE id = $2", [
            quantityToDeduct,
            ingredient.inventory_item_id,
          ])
        }
      }
    }

    await client.query("COMMIT")

    // Emit WebSocket event for order status update
    try {
      const { getIO } = await import('../websocket');
      const io = getIO();
      const updatedOrder = updatedOrderResult.rows[0];
      io.emit('orderStatusUpdated', {
        orderId: updatedOrder.id,
        orderNumber: updatedOrder.order_number,
        newStatus: status,
        orderType: updatedOrder.order_type,
        timestamp: new Date().toISOString(),
      });
      console.log(`📤 WebSocket: Order ${updatedOrder.order_number} status updated to ${status}`);
    } catch (err) {
      console.error('Failed to emit WebSocket event:', err);
    }

    // Send WhatsApp notification for key status transitions
    const order = orderBeforeUpdate.rows[0]
    if (order && order.mobile_number) {
      const previousStatus = order.status
      const orderType = order.order_type

      // Only send notifications for takeaway and delivery orders at key transitions
      if (orderType === 'take_away' || orderType === 'delivery') {
        const shouldNotify =
          // 1. Order accepted (awaiting_confirmation → preparing)
          (previousStatus === 'awaiting_confirmation' && status === 'preparing') ||
          // 2. Ready for pickup (takeaway: preparing → ready_for_pickup)
          (orderType === 'take_away' && previousStatus === 'preparing' && status === 'ready_for_pickup') ||
          // 3. Out for delivery (delivery: preparing → out_for_delivery)
          (orderType === 'delivery' && previousStatus === 'preparing' && status === 'out_for_delivery') ||
          // 4. Completed (final status - picked up or delivered)
          (status === 'completed')

        if (shouldNotify) {
          sendOrderStatusNotification(
            order.mobile_number,
            order.order_number,
            status,
            orderType
          ).catch((err) => console.error('WhatsApp notification error:', err))
        }
      }
    }

    res.json(updatedOrderResult.rows[0])
  } catch (error) {
    await client.query("ROLLBACK")
    console.error("Error updating order status:", error)
    res.status(500).json({ message: "Failed to update order status" })
  } finally {
    client.release()
  }
})

// POST /api/orders/combine - Combine two orders
router.post("/combine", async (req: Request, res: Response) => {
  const { source_order_id, target_order_id, source_table_id } = req.body

  console.log("=== COMBINE ORDERS REQUEST ===")
  console.log("Source Order ID:", source_order_id)
  console.log("Target Order ID:", target_order_id)
  console.log("Source Table ID:", source_table_id)

  if (!source_order_id || !target_order_id || !source_table_id) {
    const error = "Missing required fields: source_order_id, target_order_id, source_table_id"
    console.error("VALIDATION ERROR:", error)
    return res.status(400).json({ message: error })
  }

  const client = await pool.connect()
  try {
    console.log("Starting transaction...")
    await client.query("BEGIN")

    // 1. Verify both orders exist and are active
    console.log("Step 1: Verifying orders exist...")
    const sourceOrderResult = await client.query("SELECT * FROM orders WHERE id = $1 AND status != $2", [
      source_order_id,
      "completed",
    ])
    console.log("Source order query result:", sourceOrderResult.rows.length, "rows")

    const targetOrderResult = await client.query("SELECT * FROM orders WHERE id = $1 AND status != $2", [
      target_order_id,
      "completed",
    ])
    console.log("Target order query result:", targetOrderResult.rows.length, "rows")

    if (sourceOrderResult.rows.length === 0) {
      throw new Error(`Source order not found or already completed. Order ID: ${source_order_id}`)
    }
    if (targetOrderResult.rows.length === 0) {
      throw new Error(`Target order not found or already completed. Order ID: ${target_order_id}`)
    }

    console.log("Source Order:", JSON.stringify(sourceOrderResult.rows[0], null, 2))
    console.log("Target Order:", JSON.stringify(targetOrderResult.rows[0], null, 2))

    console.log("Source Order:", JSON.stringify(sourceOrderResult.rows[0], null, 2))
    console.log("Target Order:", JSON.stringify(targetOrderResult.rows[0], null, 2))

    // 2. Get all items from source order
    console.log("Step 2: Fetching source order items...")
    const sourceItemsResult = await client.query("SELECT * FROM order_items WHERE order_id = $1", [source_order_id])
    console.log(`Found ${sourceItemsResult.rows.length} items in source order`)
    console.log("Source Items:", JSON.stringify(sourceItemsResult.rows, null, 2))

    // 3. Move all items from source order to target order
    console.log("Step 3: Merging items...")
    for (let i = 0; i < sourceItemsResult.rows.length; i++) {
      const item = sourceItemsResult.rows[i]
      console.log(`Processing item ${i + 1}/${sourceItemsResult.rows.length}:`, {
        menu_item_id: item.menu_item_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        portion_name: item.portion_name,
      })

      // Check if the same menu item already exists in target order
      const existingItemResult = await client.query(
        "SELECT * FROM order_items WHERE order_id = $1 AND menu_item_id = $2 AND COALESCE(portion_name, '') = COALESCE($3, '')",
        [target_order_id, item.menu_item_id, item.portion_name],
      )
      console.log(`  Existing items in target: ${existingItemResult.rows.length}`)

      if (existingItemResult.rows.length > 0) {
        // Item exists, update quantity
        const existingItem = existingItemResult.rows[0]
        const newQuantity = Number(existingItem.quantity) + Number(item.quantity)
        const newTotalPrice = Number(existingItem.unit_price) * newQuantity

        console.log(`  Updating existing item: ${existingItem.quantity} + ${item.quantity} = ${newQuantity}`)
        await client.query("UPDATE order_items SET quantity = $1, total_price = $2 WHERE id = $3", [
          newQuantity,
          newTotalPrice,
          existingItem.id,
        ])
        console.log(`  ✓ Updated item ID ${existingItem.id}`)
      } else {
        // Item doesn't exist, insert new item
        console.log(`  Inserting new item into target order`)
        await client.query(
          `INSERT INTO order_items (order_id, menu_item_id, quantity, unit_price, total_price, is_complimentary, complimentary_quantity, portion_name, notes)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            target_order_id,
            item.menu_item_id,
            item.quantity,
            item.unit_price,
            item.total_price,
            item.is_complimentary || false,
            item.complimentary_quantity || 0,
            item.portion_name,
            item.notes || null,
          ],
        )
        console.log(`  ✓ Inserted new item`)
      }
    }

    // 4. Recalculate target order totals
    console.log("Step 4: Recalculating totals...")
    const targetItemsResult = await client.query("SELECT * FROM order_items WHERE order_id = $1", [target_order_id])
    console.log(`Target order now has ${targetItemsResult.rows.length} items`)

    let subtotal = 0
    for (const item of targetItemsResult.rows) {
      if (!item.is_complimentary) {
        subtotal += Number(item.total_price)
        console.log(`  Item: ${item.total_price} (complimentary: ${item.is_complimentary})`)
      }
    }
    console.log(`Subtotal: ${subtotal}`)

    // Get tax rate from restaurant settings
    console.log("Fetching tax rate from restaurant_settings...")
    const settingsResult = await client.query("SELECT tax_rate FROM restaurant_settings LIMIT 1")
    console.log("Settings query result:", settingsResult.rows)

    const taxRate =
      settingsResult.rows.length > 0 && settingsResult.rows[0].tax_rate
        ? Number(settingsResult.rows[0].tax_rate) / 100
        : 0.05
    console.log(`Tax rate: ${taxRate} (${taxRate * 100}%)`)

    const taxAmount = subtotal * taxRate
    const grandTotal = subtotal + taxAmount
    console.log(`Tax amount: ${taxAmount}`)
    console.log(`Grand total: ${grandTotal}`)

    console.log("Updating target order with new totals...")
    await client.query(
      "UPDATE orders SET subtotal = $1, tax_amount = $2, grand_total = $3, updated_at = NOW() WHERE id = $4",
      [subtotal, taxAmount, grandTotal, target_order_id],
    )
    console.log("✓ Target order updated")

    // 5. Cancel the source order
    console.log("Step 5: Cancelling source order...")
    await client.query("UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2", [
      "cancelled",
      source_order_id,
    ])
    console.log("✓ Source order cancelled")

    // 6. Free up the source table
    console.log("Step 6: Freeing up source table...")
    await client.query("UPDATE restaurant_tables SET status = 'available', updated_at = NOW() WHERE id = $1", [
      source_table_id,
    ])
    console.log("✓ Source table freed")

    console.log("Committing transaction...")
    await client.query("COMMIT")
    console.log("✓ Transaction committed successfully")

    res.status(200).json({
      success: true,
      message: "Orders combined successfully",
      target_order_id,
      details: {
        items_merged: sourceItemsResult.rows.length,
        new_subtotal: subtotal,
        new_tax: taxAmount,
        new_total: grandTotal,
      },
    })
    console.log("=== COMBINE ORDERS COMPLETED ===")
  } catch (error) {
    await client.query("ROLLBACK")
    console.error("=== COMBINE ORDERS FAILED ===")
    console.error("Error type:", error instanceof Error ? error.constructor.name : typeof error)
    console.error("Error message:", error instanceof Error ? error.message : String(error))
    console.error("Error stack:", error instanceof Error ? error.stack : "No stack trace")

    res.status(500).json({
      message: error instanceof Error ? error.message : "Failed to combine orders",
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    })
  } finally {
    client.release()
  }
})

// POST /api/orders/combine-tables - Combine multiple tables (with or without orders)
router.post("/combine-tables", async (req: Request, res: Response) => {
  const { table_ids, order_ids } = req.body

  console.log("=== COMBINE TABLES REQUEST ===")
  console.log("Table IDs:", table_ids)
  console.log("Order IDs:", order_ids)

  if (!table_ids || !Array.isArray(table_ids) || table_ids.length < 2) {
    const error = "Must provide at least 2 table IDs to combine"
    console.error("VALIDATION ERROR:", error)
    return res.status(400).json({ message: error })
  }

  const client = await pool.connect()
  try {
    console.log("Starting transaction...")
    await client.query("BEGIN")

    // 1. Verify all tables exist and are not in paid/bill_printed status
    console.log("Step 1: Verifying tables...")
    const placeholders = table_ids.map((_: any, i: number) => `$${i + 1}`).join(",")
    const tablesResult = await client.query(`SELECT * FROM restaurant_tables WHERE id IN (${placeholders})`, table_ids)
    console.log(`Found ${tablesResult.rows.length} tables`)

    if (tablesResult.rows.length !== table_ids.length) {
      throw new Error("Some tables were not found")
    }

    // Check if any table has bill_printed or paid status
    const invalidTables = tablesResult.rows.filter((t) => t.status === "bill_printed" || t.status === "paid")
    if (invalidTables.length > 0) {
      throw new Error(
        `Cannot combine tables with printed bills or paid orders: ${invalidTables.map((t) => t.name).join(", ")}`,
      )
    }

    // Check if any tables are already linked to an order (existing combination)
    const alreadyLinkedTables = tablesResult.rows.filter((t) => t.linked_order_id)
    console.log(`Found ${alreadyLinkedTables.length} tables already linked to orders`)

    // Validate: Either at least one table must have an order, OR we're adding to existing combination
    const hasNewOrders = order_ids && Array.isArray(order_ids) && order_ids.filter((id) => id).length > 0
    if (!hasNewOrders && alreadyLinkedTables.length === 0) {
      throw new Error("Table combination requires at least one table with an existing order")
    }

    // 2. Handle orders - merge all orders into one
    let targetOrderId = null

    // Priority 1: If any table is already part of a linked group, use that order
    if (alreadyLinkedTables.length > 0) {
      targetOrderId = alreadyLinkedTables[0].linked_order_id
      console.log(`Using existing linked order as target: ${targetOrderId}`)

      // Get all tables currently linked to this order (to show in response)
      const existingLinkedTablesResult = await client.query(
        "SELECT name FROM restaurant_tables WHERE linked_order_id = $1",
        [targetOrderId]
      )
      console.log(`Order ${targetOrderId} currently has ${existingLinkedTablesResult.rows.length} linked tables: ${existingLinkedTablesResult.rows.map(t => t.name).join(', ')}`)
    }

    // Priority 2: If no existing linked order, use orders from the new tables
    if (!targetOrderId && order_ids && order_ids.length > 0) {
      console.log("Step 2: Merging orders...")

      // Get all orders
      const orderPlaceholders = order_ids.map((_: any, i: number) => `$${i + 1}`).join(",")
      const ordersResult = await client.query(
        `SELECT * FROM orders WHERE id IN (${orderPlaceholders}) AND status != 'completed'`,
        order_ids,
      )
      console.log(`Found ${ordersResult.rows.length} active orders`)

      if (ordersResult.rows.length > 0) {
        // If we don't have a target order yet (no existing links), use the first order as the target
        if (!targetOrderId) {
          targetOrderId = ordersResult.rows[0].id
          console.log(`Using first order as target: ${targetOrderId}`)
        }

        // Merge all OTHER orders into the target (skip if order is already the target)
        for (let i = 0; i < ordersResult.rows.length; i++) {
          const currentOrderId = ordersResult.rows[i].id

          // Skip if this is already the target order
          if (currentOrderId === targetOrderId) {
            console.log(`Skipping merge of target order ${currentOrderId}`)
            continue
          }

          console.log(`Merging order ${currentOrderId} into ${targetOrderId}`)

          // Get all items from source order
          const sourceItemsResult = await client.query("SELECT * FROM order_items WHERE order_id = $1", [currentOrderId])

          // Move items to target order
          for (const item of sourceItemsResult.rows) {
            const existingItemResult = await client.query(
              "SELECT * FROM order_items WHERE order_id = $1 AND menu_item_id = $2 AND COALESCE(portion_name, '') = COALESCE($3, '')",
              [targetOrderId, item.menu_item_id, item.portion_name],
            )

            if (existingItemResult.rows.length > 0) {
              const existingItem = existingItemResult.rows[0]
              const newQuantity = Number(existingItem.quantity) + Number(item.quantity)
              const newTotalPrice = Number(existingItem.unit_price) * newQuantity

              await client.query("UPDATE order_items SET quantity = $1, total_price = $2 WHERE id = $3", [
                newQuantity,
                newTotalPrice,
                existingItem.id,
              ])
            } else {
              await client.query(
                `INSERT INTO order_items (order_id, menu_item_id, quantity, unit_price, total_price, is_complimentary, complimentary_quantity, portion_name, notes)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
                [
                  targetOrderId,
                  item.menu_item_id,
                  item.quantity,
                  item.unit_price,
                  item.total_price,
                  item.is_complimentary || false,
                  item.complimentary_quantity || 0,
                  item.portion_name,
                  item.notes || null,
                ],
              )
            }
          }

          // Cancel the source order
          await client.query("UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2", [
            "cancelled",
            currentOrderId,
          ])
        }

        // Recalculate target order totals
        const targetItemsResult = await client.query("SELECT * FROM order_items WHERE order_id = $1", [targetOrderId])

        let subtotal = 0
        for (const item of targetItemsResult.rows) {
          if (!item.is_complimentary) {
            subtotal += Number(item.total_price)
          }
        }

        const settingsResult = await client.query("SELECT tax_rate FROM restaurant_settings LIMIT 1")
        const taxRate =
          settingsResult.rows.length > 0 && settingsResult.rows[0].tax_rate
            ? Number(settingsResult.rows[0].tax_rate) / 100
            : 0.05

        const taxAmount = subtotal * taxRate
        const grandTotal = subtotal + taxAmount

        await client.query(
          "UPDATE orders SET subtotal = $1, tax_amount = $2, grand_total = $3, updated_at = NOW() WHERE id = $4",
          [subtotal, taxAmount, grandTotal, targetOrderId],
        )
        console.log(`Updated target order totals: ${grandTotal}`)
      }
    }

    // 3. Link all tables to the target order
    console.log("Step 3: Linking all tables to the order...")

    const tableNames = tablesResult.rows.map((t) => t.name).join(" + ")
    console.log(`Combined tables: ${tableNames}`)

    // Link all tables to the target order
    for (const tableId of table_ids) {
      await client.query(
        `UPDATE restaurant_tables 
         SET status = 'occupied', 
             linked_order_id = $1,
             updated_at = NOW() 
         WHERE id = $2`,
        [targetOrderId, tableId]
      )
    }

    console.log("Committing transaction...")
    await client.query("COMMIT")
    console.log("✓ Transaction committed successfully")

    // Get final list of all tables linked to this order
    const allLinkedTablesResult = await client.query(
      "SELECT name FROM restaurant_tables WHERE linked_order_id = $1 ORDER BY name",
      [targetOrderId]
    )
    const allLinkedTableNames = allLinkedTablesResult.rows.map(t => t.name).join(" + ")

    res.status(200).json({
      success: true,
      message: alreadyLinkedTables.length > 0
        ? "New table(s) added to existing combination successfully"
        : "Tables combined successfully",
      combined_tables: allLinkedTableNames,
      order_id: targetOrderId,
      total_tables: allLinkedTablesResult.rows.length
    })
    console.log("=== COMBINE TABLES COMPLETED ===")
  } catch (error) {
    await client.query("ROLLBACK")
    console.error("=== COMBINE TABLES FAILED ===")
    console.error("Error type:", error instanceof Error ? error.constructor.name : typeof error)
    console.error("Error message:", error instanceof Error ? error.message : String(error))
    console.error("Error stack:", error instanceof Error ? error.stack : "No stack trace")

    res.status(500).json({
      message: error instanceof Error ? error.message : "Failed to combine tables",
      error: error instanceof Error ? error.message : String(error),
    })
  } finally {
    client.release()
  }
})

export default router
