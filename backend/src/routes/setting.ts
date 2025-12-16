// backend/src/routes/setting.ts
import { Router, Request, Response } from "express";
import { pool } from "../server";

function generateBillNumber(): string {
  const timestamp = Date.now().toString().slice(-6);
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, "0");
  return `BILL-${timestamp}${random}`;
}

const router = Router();

/* -------------------------
   Restaurant settings (existing)
---------------------------*/
router.get("/settings", async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    const result = await client.query(
      "SELECT id, restaurant_name, address, contact_number, registration_number, tax_rate, loyalty_points_enabled, loyalty_points_per_100, points_value, print_preview_enabled, min_points_to_redeem, currency FROM restaurant_settings LIMIT 1"
    );
    if (result.rows.length === 0) {
      return res.json({
        restaurant_name: "Restaurant Name",
        address: "Restaurant Address",
        contact_number: "Phone Number",
        registration_number: "",
        tax_rate: 0,
        loyalty_points_enabled: true,
        loyalty_points_per_100: 10,
        points_value: 0.1,
        print_preview_enabled: true,
        min_points_to_redeem: 200,
        currency: "OMR",
      });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error("Error fetching restaurant settings:", error);
    res.json({
      restaurant_name: "Restaurant Name",
      address: "Restaurant Address",
      contact_number: "Phone Number",
      registration_number: "",
      tax_rate: 0,
      loyalty_points_enabled: true,
      loyalty_points_per_100: 10,
      points_value: 0.1,
      print_preview_enabled: true,
      min_points_to_redeem: 200,
      currency: "OMR",
    });
  } finally {
    client.release();
  }
});

router.post("/settings", async (req: Request, res: Response) => {
  const {
    restaurant_name,
    address,
    contact_number,
    registration_number,
    tax_rate,
    loyalty_points_enabled,
    loyalty_points_per_100,
    points_value,
    print_preview_enabled,
    min_points_to_redeem,
    currency,
  } = req.body;
  const client = await pool.connect();
  try {
    const checkResult = await client.query("SELECT id FROM restaurant_settings LIMIT 1");
    let result;
    if (checkResult.rows.length === 0) {
      result = await client.query(
        `INSERT INTO restaurant_settings
         (restaurant_name, address, contact_number, registration_number, tax_rate, loyalty_points_enabled, loyalty_points_per_100, points_value, print_preview_enabled, min_points_to_redeem, currency)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
        [
          restaurant_name,
          address,
          contact_number,
          registration_number || "",
          tax_rate || 0,
          loyalty_points_enabled !== undefined ? loyalty_points_enabled : true,
          loyalty_points_per_100 || 10,
          points_value || 0.1,
          print_preview_enabled !== undefined ? print_preview_enabled : true,
          min_points_to_redeem || 200,
          currency || "OMR",
        ]
      );
    } else {
      result = await client.query(
        `UPDATE restaurant_settings SET
           restaurant_name=$1, address=$2, contact_number=$3, registration_number=$4, tax_rate=$5,
           loyalty_points_enabled=$6, loyalty_points_per_100=$7, points_value=$8, print_preview_enabled=$9, min_points_to_redeem=$10, currency=$11
         WHERE id=$12 RETURNING *`,
        [
          restaurant_name,
          address,
          contact_number,
          registration_number || "",
          tax_rate || 0,
          loyalty_points_enabled !== undefined ? loyalty_points_enabled : true,
          loyalty_points_per_100 || 10,
          points_value || 0.1,
          print_preview_enabled !== undefined ? print_preview_enabled : true,
          min_points_to_redeem || 200,
          currency || "OMR",
          checkResult.rows[0].id,
        ]
      );
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error("Error updating restaurant settings:", error);
    res.status(500).json({ message: "Failed to update restaurant settings" });
  } finally {
    client.release();
  }
});

/* -------------------------
   Layout & Tables (existing)
---------------------------*/
router.get("/layout", async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    const floorsResult = await client.query("SELECT id as floor_id, name as floor_name FROM floors ORDER BY name");
    const sectionsResult = await client.query("SELECT id as section_id, name as section_name, floor_id FROM sections ORDER BY name");
    const tablesResult = await client.query(`
      SELECT
        rt.id AS table_id, rt.section_id, rt.name AS table_name, rt.status AS table_status,
        o.id AS active_order_id, o.order_number AS active_order_number, o.grand_total AS active_order_grand_total,
        o.status AS active_order_status, o.created_at AS active_order_created_at,
        c.id AS active_order_customer_id, c.mobile_number AS active_order_customer_mobile,
        w.id AS active_order_waiter_id, w.name AS active_order_waiter_name, w.employee_id AS active_order_waiter_employee_id
      FROM restaurant_tables rt
      LEFT JOIN (
        SELECT *, ROW_NUMBER() OVER(PARTITION BY restaurant_table_id ORDER BY orders.created_at DESC) as rn
        FROM orders WHERE status = 'pending'
      ) o ON o.restaurant_table_id = rt.id AND o.rn = 1
      LEFT JOIN customers c ON o.customer_id = c.id
      LEFT JOIN waiters w ON o.waiter_id = w.id
      ORDER BY rt.name;
    `);

    const layout = floorsResult.rows.map((floor) => ({
      ...floor,
      sections: sectionsResult.rows
        .filter((s) => s.floor_id === floor.floor_id)
        .map((section) => ({
          ...section,
          tables: tablesResult.rows
            .filter((t) => t.section_id === section.section_id)
            .map((table) => {
              let actualStatus = table.table_status || "available";
              if (!table.active_order_id && (actualStatus === "occupied" || actualStatus === "bill_printed")) {
                actualStatus = "available";
              }
              return {
                table_id: table.table_id,
                table_name: table.table_name,
                table_status: actualStatus,
                active_order: table.active_order_id
                  ? {
                      order_id: table.active_order_id,
                      order_number: table.active_order_number,
                      grand_total: parseFloat(table.active_order_grand_total),
                      status: table.active_order_status,
                      created_at: table.active_order_created_at,
                      customer_id: table.active_order_customer_id,
                      customer_mobile: table.active_order_customer_mobile,
                      waiter_id: table.active_order_waiter_id,
                      waiter_name: table.active_order_waiter_name,
                      waiter_employee_id: table.active_order_waiter_employee_id,
                    }
                  : null,
              };
            }),
        })),
    }));

    res.json(layout);
  } catch (error) {
    console.error("---!!! ERROR Fetching Layout !!!---:", error);
    res.status(500).json({ message: "Internal Server Error" });
  } finally {
    client.release();
  }
});

/* -------------------------
   Floor/Section/Table CRUD
---------------------------*/
router.post("/floors", async (req: Request, res: Response) => {
  const { name } = req.body;
  await pool.query("INSERT INTO floors (name) VALUES ($1)", [name]);
  res.status(201).send();
});
router.post("/sections", async (req: Request, res: Response) => {
  const { name, floor_id } = req.body;
  await pool.query("INSERT INTO sections (name, floor_id) VALUES ($1, $2)", [name, floor_id]);
  res.status(201).send();
});
router.post("/tables", async (req: Request, res: Response) => {
  const { name, section_id } = req.body;
  await pool.query("INSERT INTO restaurant_tables (name, section_id) VALUES ($1, $2)", [name, section_id]);
  res.status(201).send();
});
router.delete("/floors/:id", async (req: Request, res: Response) => {
  const { id } = req.params;
  await pool.query("DELETE FROM floors WHERE id = $1", [id]);
  res.status(204).send();
});
router.delete("/sections/:id", async (req: Request, res: Response) => {
  const { id } = req.params;
  await pool.query("DELETE FROM sections WHERE id = $1", [id]);
  res.status(204).send();
});
router.delete("/tables/:id", async (req: Request, res: Response) => {
  const { id } = req.params;
  await pool.query("DELETE FROM restaurant_tables WHERE id = $1", [id]);
  res.status(204).send();
});
router.put("/tables/:id/status", async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status } = req.body;
  const client = await pool.connect();
  try {
    const result = await client.query("UPDATE restaurant_tables SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *;", [status, id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Table not found" });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error("Error updating table status:", error);
    res.status(500).json({ message: "Failed to update table status" });
  } finally {
    client.release();
  }
});

/* -------------------------
   Orders: complete (existing advanced route)
   (unchanged - kept intact)
---------------------------*/
type Payment = {
  method: "cash" | "card" | "due" | "other";
  amount: number;
};

router.put("/orders/:orderId/complete", async (req: Request, res: Response) => {
  const { orderId } = req.params;
  const {
    tableId,
    status,
    pointsRedeemed = 0,
    finalAmount,
    customerId,
    payments,
  } = req.body as {
    tableId: string;
    status: string;
    pointsRedeemed: number;
    finalAmount: number;
    customerId: string | null;
    payments: Payment[];
  };

  if (status === "completed" && (!payments || payments.length === 0)) {
    return res.status(400).json({ message: "Payment information is required to complete an order." });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const orderUpdateResult = await client.query(
      "UPDATE orders SET status = $1, updated_at = NOW(), points_redeemed = $2 WHERE id = $3 RETURNING *;",
      [status, pointsRedeemed, orderId]
    );
    if (orderUpdateResult.rows.length === 0) throw new Error("Order not found");
    const order = orderUpdateResult.rows[0];

    if (status === "completed") {
      // inventory deduction
      const orderItemsResult = await client.query("SELECT * FROM order_items WHERE order_id = $1", [orderId]);
      for (const item of orderItemsResult.rows) {
        const recipeResult = await client.query("SELECT * FROM recipes WHERE menu_item_id = $1", [item.menu_item_id]);
        for (const ingredient of recipeResult.rows) {
          const quantityToDeduct = Number(item.quantity) * Number(ingredient.quantity_used);
          await client.query("UPDATE inventory SET quantity = quantity - $1 WHERE id = $2", [quantityToDeduct, ingredient.inventory_item_id]);
        }
      }

      // loyalty logic
      const custId = customerId || order.customer_id;
      if (custId) {
        const settingsResult = await client.query("SELECT loyalty_points_enabled, loyalty_points_per_100, points_value, min_points_to_redeem FROM restaurant_settings LIMIT 1");
        if (settingsResult.rows.length > 0) {
          const { loyalty_points_enabled, loyalty_points_per_100, points_value } = settingsResult.rows[0];
          if (loyalty_points_enabled) {
            if (pointsRedeemed > 0) {
              await client.query("UPDATE customers SET loyalty_points = loyalty_points - $1 WHERE id = $2", [pointsRedeemed, custId]);
              const pointsValueAmount = pointsRedeemed * (parseFloat(points_value) || 0.1);
              await client.query(
                "INSERT INTO loyalty_transactions (customer_id, order_id, points_redeemed, transaction_type, description, order_amount) VALUES ($1, $2, $3, $4, $5, $6)",
                [custId, orderId, pointsRedeemed, "redeemed", `Redeemed ${pointsRedeemed} points (OMR${pointsValueAmount.toFixed(2)}) for order`, order.grand_total]
              );
            }
            const amountForPoints = finalAmount !== undefined ? parseFloat(finalAmount.toString()) : parseFloat(order.grand_total);
            if (amountForPoints > 0) {
              const pointsEarned = Math.floor((amountForPoints / 100) * (loyalty_points_per_100 || 10));
              if (pointsEarned > 0) {
                await client.query("UPDATE customers SET loyalty_points = loyalty_points + $1 WHERE id = $2", [pointsEarned, custId]);
                await client.query(
                  "INSERT INTO loyalty_transactions (customer_id, order_id, points_earned, transaction_type, description, order_amount) VALUES ($1, $2, $3, $4, $5, $6)",
                  [custId, orderId, pointsEarned, "earned", `Earned ${pointsEarned} points from order (paid: OMR${amountForPoints.toFixed(2)})`, amountForPoints]
                );
              }
            }
          }
        }
      }

      // bills
      const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount), 0);
      let totalChangeDue = Math.max(0, totalPaid - Number(finalAmount));

      for (const payment of payments) {
        let changeForThisPayment = 0;
        if (payment.method === "cash" && totalChangeDue > 0) {
          changeForThisPayment = totalChangeDue;
          totalChangeDue = 0;
        }

        await client.query(
          `INSERT INTO bills (order_id, customer_id, bill_number, payment_method, amount_paid, change_due)
           VALUES ($1, $2, $3, $4, $5, $6);`,
          [orderId, custId, generateBillNumber(), payment.method, payment.amount, changeForThisPayment]
        );
      }
    }

    if (tableId && status === "completed") {
      await client.query("UPDATE restaurant_tables SET status = 'cleaning', updated_at = NOW() WHERE id = $1;", [tableId]);
      setTimeout(async () => {
        const cleanupClient = await pool.connect();
        try {
          await cleanupClient.query("UPDATE restaurant_tables SET status = 'available', updated_at = NOW() WHERE id = $1 AND status = 'cleaning';", [tableId]);
          console.log(`✅ Table ${tableId} reset to 'available' after cleaning period`);
        } catch (error) {
          console.error(`❌ Error resetting table ${tableId}:`, error);
        } finally {
          cleanupClient.release();
        }
      }, 120000);
    }

    await client.query("COMMIT");
    const finalOrderResult = await client.query(
      `SELECT o.*, c.name as customer_name, c.mobile_number,
         (SELECT json_agg(json_build_object('menu_item_name', mi.name, 'quantity', oi.quantity, 'id', oi.id, 'unit_price', oi.unit_price, 'total_price', oi.total_price, 'is_complimentary', COALESCE(oi.is_complimentary,false)))
           FROM order_items oi JOIN menu_items mi ON mi.id = oi.menu_item_id WHERE oi.order_id = o.id) as order_items
       FROM orders o LEFT JOIN customers c ON o.customer_id = c.id WHERE o.id = $1;`,
      [orderId]
    );
    res.json({ ...finalOrderResult.rows[0], order_items: finalOrderResult.rows[0].order_items || [] });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error completing order:", error);
    res.status(500).json({ message: "Failed to complete order" });
  } finally {
    client.release();
  }
});

/* --------------------------------------------------
   OFFERS (group offers) and ITEM-LEVEL OFFERS
   Added here to keep single router file for Settings
---------------------------------------------------*/

// GET /offers
router.get("/offers", async (req: Request, res: Response) => {
  try {
    const offers = await pool.query(`
      SELECT 
        id, name, discount_percent, active,
        apply_dine_in, apply_takeaway, apply_delivery,
        created_at, updated_at
      FROM offers
      ORDER BY created_at DESC
    `);

    const ids = offers.rows.map((o: any) => o.id);
    const menuMap: Record<number, string[]> = {};

    if (ids.length > 0) {
      const items = await pool.query(
        `SELECT offer_id, menu_item_id FROM offer_menu_items WHERE offer_id = ANY($1::int[])`,
        [ids]
      );
      for (const row of items.rows) {
        menuMap[row.offer_id] = menuMap[row.offer_id] || [];
        menuMap[row.offer_id].push(row.menu_item_id);
      }
    }

    res.json(
      offers.rows.map((o: any) => ({
        ...o,
        menu_item_ids: menuMap[o.id] || [],
      }))
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch offers" });
  }
});

// POST /offers
router.post("/offers", async (req: Request, res: Response) => {
  const {
    name,
    discount_percent,
    menu_item_ids = [],
    apply_dine_in = true,
    apply_takeaway = true,
    apply_delivery = true
  } = req.body;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const result = await client.query(
      `INSERT INTO offers
       (name, discount_percent, active, apply_dine_in, apply_takeaway, apply_delivery)
       VALUES ($1,$2,true,$3,$4,$5)
       RETURNING *`,
      [name, discount_percent, apply_dine_in, apply_takeaway, apply_delivery]
    );

    const offerId = result.rows[0].id;

    for (const mid of menu_item_ids) {
      await client.query(
        `INSERT INTO offer_menu_items (offer_id, menu_item_id) VALUES ($1,$2)`,
        [offerId, mid]
      );
    }

    await client.query("COMMIT");
    res.status(201).json({ ...result.rows[0], menu_item_ids });
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).json({ message: "Failed to create offer" });
  } finally {
    client.release();
  }
});

// PUT /offers/:id
router.put("/offers/:id", async (req: Request, res: Response) => {
  const { id } = req.params;
  const {
    name,
    discount_percent,
    menu_item_ids = [],
    apply_dine_in,
    apply_takeaway,
    apply_delivery
  } = req.body;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const updated = await client.query(
      `UPDATE offers SET
        name=$1,
        discount_percent=$2,
        apply_dine_in=$3,
        apply_takeaway=$4,
        apply_delivery=$5,
        updated_at=NOW()
       WHERE id=$6
       RETURNING *`,
      [name, discount_percent, apply_dine_in, apply_takeaway, apply_delivery, id]
    );

    await client.query(`DELETE FROM offer_menu_items WHERE offer_id=$1`, [id]);
    for (const mid of menu_item_ids) {
      await client.query(
        `INSERT INTO offer_menu_items (offer_id, menu_item_id) VALUES ($1,$2)`,
        [id, mid]
      );
    }

    await client.query("COMMIT");
    res.json({ ...updated.rows[0], menu_item_ids });
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).json({ message: "Failed to update offer" });
  } finally {
    client.release();
  }
});

// PATCH /offers/:id/toggle
router.patch("/offers/:id/toggle", async (req: Request, res: Response) => {
  try {
    const result = await pool.query(`UPDATE offers SET active = NOT active, updated_at=NOW() WHERE id=$1 RETURNING *`, [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ message: "Offer not found" });
    res.json(result.rows[0]);
  } catch (err) {
    console.error("TOGGLE /offers/:id error:", err);
    res.status(500).json({ message: "Failed to toggle offer" });
  }
});

// DELETE /offers/:id
router.delete("/offers/:id", async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM offer_menu_items WHERE offer_id=$1", [req.params.id]);
    await client.query("DELETE FROM offers WHERE id=$1", [req.params.id]);
    await client.query("COMMIT");
    res.status(204).send();
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("DELETE /offers error:", err);
    res.status(500).json({ message: "Failed to delete offer" });
  } finally {
    client.release();
  }
});

/* -------------------------
   Item-level Offers
---------------------------*/

// GET /item-offers
router.get("/item-offers", async (req: Request, res: Response) => {
  try {
    const result = await pool.query(`SELECT id, menu_item_id, discount_percent, active, created_at, updated_at FROM item_offers ORDER BY created_at DESC`);
    res.json(result.rows);
  } catch (err) {
    console.error("GET /item-offers error:", err);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// POST /item-offers
router.post("/item-offers", async (req: Request, res: Response) => {
  const { menu_item_id, discount_percent, active = true } = req.body;
  if (!menu_item_id || discount_percent === undefined) {
    return res.status(400).json({ message: "menu_item_id and discount_percent required" });
  }
  try {
    const result = await pool.query(`INSERT INTO item_offers (menu_item_id, discount_percent, active) VALUES ($1, $2, $3) RETURNING *`, [menu_item_id, discount_percent, active]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("POST /item-offers error:", err);
    res.status(500).json({ message: "Failed to create item offer" });
  }
});

// PUT /item-offers/:id
router.put("/item-offers/:id", async (req: Request, res: Response) => {
  const { id } = req.params;
  const { menu_item_id, discount_percent, active = true } = req.body;
  if (!menu_item_id || discount_percent === undefined) {
    return res.status(400).json({ message: "menu_item_id and discount_percent required" });
  }
  try {
    const result = await pool.query(
      `UPDATE item_offers SET menu_item_id = $1, discount_percent = $2, active = $3, updated_at = NOW() WHERE id = $4 RETURNING *`,
      [menu_item_id, discount_percent, active, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: "Not found" });
    res.json(result.rows[0]);
  } catch (err) {
    console.error("PUT /item-offers/:id error:", err);
    res.status(500).json({ message: "Failed to update item offer" });
  }
});

// PATCH /item-offers/:id/toggle
router.patch("/item-offers/:id/toggle", async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const result = await pool.query(`UPDATE item_offers SET active = NOT active, updated_at = NOW() WHERE id = $1 RETURNING *`, [id]);
    if (result.rows.length === 0) return res.status(404).json({ message: "Not found" });
    res.json(result.rows[0]);
  } catch (err) {
    console.error("PATCH /item-offers/:id/toggle error:", err);
    res.status(500).json({ message: "Failed to toggle item-offer" });
  }
});

// DELETE /item-offers/:id
router.delete("/item-offers/:id", async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    await pool.query("DELETE FROM item_offers WHERE id = $1", [id]);
    res.status(204).send();
  } catch (err) {
    console.error("DELETE /item-offers/:id", err);
    res.status(500).json({ message: "Failed to delete item-offer" });
  }
});

export default router;
