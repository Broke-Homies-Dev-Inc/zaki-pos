// backend/src/routes/setting.ts
import { Router, Request, Response } from "express";
import { pool } from "../server";



const router = Router();

/* -------------------------
   Restaurant settings (existing)
---------------------------*/
router.get("/settings", async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    const result = await client.query(
      "SELECT id, restaurant_name, address, contact_number, registration_number, tax_rate, loyalty_points_enabled, loyalty_points_per_100, points_value, print_preview_enabled, min_points_to_redeem, currency, timer_green_threshold, timer_orange_threshold, order_expiry_time, table_cleaning_time, global_quick_notes FROM restaurant_settings LIMIT 1"
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
        timer_green_threshold: 10,
        timer_orange_threshold: 20,
        print_preview_enabled: true,
        min_points_to_redeem: 200,
        currency: "OMR",
        order_expiry_time: 60,
        global_quick_notes: ["Less Spicy", "More Spicy", "Extra Spicy", "No Spice", "More Gravy", "Less Gravy", "Well Done", "Medium Done", "Extra Salt", "Less Salt", "No Onion", "No Garlic", "Extra Cheese", "No Oil"],
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
      timer_green_threshold: 10,
      timer_orange_threshold: 20,
      print_preview_enabled: true,
      min_points_to_redeem: 200,
      currency: "OMR",
      order_expiry_time: 60,
      table_cleaning_time: 2,
      global_quick_notes: ["Less Spicy", "More Spicy", "Extra Spicy", "No Spice", "More Gravy", "Less Gravy", "Well Done", "Medium Done", "Extra Salt", "Less Salt", "No Onion", "No Garlic", "Extra Cheese", "No Oil"],
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
    timer_green_threshold,
    timer_orange_threshold,
    order_expiry_time,
    table_cleaning_time,
    global_quick_notes,
  } = req.body;
  const client = await pool.connect();
  try {
    const checkResult = await client.query("SELECT id FROM restaurant_settings LIMIT 1");
    let result;
    if (checkResult.rows.length === 0) {
      result = await client.query(
        `INSERT INTO restaurant_settings
         (restaurant_name, address, contact_number, registration_number, tax_rate, loyalty_points_enabled, loyalty_points_per_100, points_value, print_preview_enabled, min_points_to_redeem, currency, timer_green_threshold, timer_orange_threshold, order_expiry_time, table_cleaning_time, global_quick_notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING *`,
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
          timer_green_threshold || 10,
          timer_orange_threshold || 20,
          order_expiry_time || 60,
          table_cleaning_time || 2,
          global_quick_notes ? JSON.stringify(global_quick_notes) : null,
        ]
      );
    } else {
      result = await client.query(
        `UPDATE restaurant_settings SET
           restaurant_name=$1, address=$2, contact_number=$3, registration_number=$4, tax_rate=$5,
           loyalty_points_enabled=$6, loyalty_points_per_100=$7, points_value=$8, print_preview_enabled=$9, min_points_to_redeem=$10, currency=$11,
           timer_green_threshold=$12, timer_orange_threshold=$13, order_expiry_time=$14, table_cleaning_time=$15, global_quick_notes=$16
         WHERE id=$17 RETURNING *`,
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
          timer_green_threshold || 10,
          timer_orange_threshold || 20,
          order_expiry_time || 60,
          table_cleaning_time || 2,
          global_quick_notes ? JSON.stringify(global_quick_notes) : null,
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

// GET floors with sections for VAT settings
router.get("/sections-vat", async (req: Request, res: Response) => {
  try {
    // Get all floors with apply_vat status
    const floorsResult = await pool.query(
      "SELECT id, name, apply_vat FROM floors ORDER BY name ASC"
    );

    // Get all sections with their floor_id
    const sectionsResult = await pool.query(
      "SELECT id, name, floor_id, apply_vat FROM sections ORDER BY name ASC"
    );

    // Group sections by floor
    const floorsWithSections = floorsResult.rows.map((floor: any) => ({
      ...floor,
      sections: sectionsResult.rows.filter((s: any) => s.floor_id === floor.id)
    }));

    res.json(floorsWithSections);
  } catch (err) {
    console.error("Error fetching floors/sections VAT:", err);
    res.status(500).json({ message: "Failed to fetch floors/sections VAT" });
  }
});

// Toggle VAT flag for a floor (cascades to sections)
router.patch("/floors-vat/:id/toggle", async (req: Request, res: Response) => {
  const { id } = req.params;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Toggle floor's apply_vat
    const floorResult = await client.query(
      "UPDATE floors SET apply_vat = NOT apply_vat WHERE id = $1 RETURNING id, name, apply_vat;",
      [id]
    );

    if (floorResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Floor not found" });
    }

    const floor = floorResult.rows[0];

    // If floor is now disabled, disable all sections in this floor
    if (!floor.apply_vat) {
      await client.query(
        "UPDATE sections SET apply_vat = false, updated_at = NOW() WHERE floor_id = $1;",
        [id]
      );
    }

    // Get updated sections for this floor
    const sectionsResult = await client.query(
      "SELECT id, name, apply_vat FROM sections WHERE floor_id = $1 ORDER BY name ASC;",
      [id]
    );

    await client.query("COMMIT");
    res.json({
      ...floor,
      sections: sectionsResult.rows
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error toggling floor VAT:", err);
    res.status(500).json({ message: "Failed to toggle floor VAT" });
  } finally {
    client.release();
  }
});

// Toggle VAT flag for a section (auto-enables parent floor if needed)
router.patch("/sections-vat/:id/toggle", async (req: Request, res: Response) => {
  const { id } = req.params;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Get the section's current state and floor_id
    const sectionCheck = await client.query(
      "SELECT id, name, apply_vat, floor_id FROM sections WHERE id = $1;",
      [id]
    );

    if (sectionCheck.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Section not found" });
    }

    const currentSection = sectionCheck.rows[0];
    const newVatStatus = !currentSection.apply_vat;

    // Toggle the section's apply_vat
    const result = await client.query(
      "UPDATE sections SET apply_vat = $1, updated_at = NOW() WHERE id = $2 RETURNING id, name, apply_vat, floor_id;",
      [newVatStatus, id]
    );

    let floorUpdated = false;

    // If section is being enabled, auto-enable parent floor if it's disabled
    if (newVatStatus && currentSection.floor_id) {
      const floorCheck = await client.query(
        "SELECT apply_vat FROM floors WHERE id = $1;",
        [currentSection.floor_id]
      );

      if (floorCheck.rows.length > 0 && !floorCheck.rows[0].apply_vat) {
        await client.query(
          "UPDATE floors SET apply_vat = true WHERE id = $1;",
          [currentSection.floor_id]
        );
        floorUpdated = true;
      }
    }

    await client.query("COMMIT");
    res.json({
      ...result.rows[0],
      floor_updated: floorUpdated
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error toggling section VAT:", err);
    res.status(500).json({ message: "Failed to toggle section VAT" });
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
    const sectionsResult = await client.query("SELECT id as section_id, name as section_name, floor_id, apply_vat FROM sections ORDER BY name");
    const tablesResult = await client.query(`
      SELECT
        rt.id AS table_id, rt.section_id, rt.name AS table_name, rt.status AS table_status,
        rt.linked_order_id,
        o.id AS active_order_id, o.order_number AS active_order_number, o.grand_total AS active_order_grand_total,
        o.status AS active_order_status, o.order_type AS active_order_type, o.created_at AS active_order_created_at,
        c.id AS active_order_customer_id, c.mobile_number AS active_order_customer_mobile,
        w.id AS active_order_waiter_id, w.name AS active_order_waiter_name, w.employee_id AS active_order_waiter_employee_id
      FROM restaurant_tables rt
      LEFT JOIN (
        SELECT *, ROW_NUMBER() OVER(PARTITION BY restaurant_table_id ORDER BY orders.created_at DESC) as rn
        FROM orders WHERE status NOT IN ('completed', 'cancelled')
      ) o ON o.restaurant_table_id = rt.id AND o.rn = 1
      LEFT JOIN customers c ON o.customer_id = c.id
      LEFT JOIN waiters w ON o.waiter_id = w.id
      ORDER BY rt.name;
    `);

    // Build map of linked_order_id -> array of table names
    const orderTablesMap: Record<string, string[]> = {};

    for (const table of tablesResult.rows) {
      // Use linked_order_id if available, otherwise fall back to active_order_id
      const orderId = table.linked_order_id || table.active_order_id;
      if (orderId) {
        if (!orderTablesMap[orderId]) {
          orderTablesMap[orderId] = [];
        }
        orderTablesMap[orderId].push(table.table_name);
      }
    }

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

              // Check if this table is part of a combined group
              let combinedGroupId = null;
              let combinedWithTables = null;
              let isPartOfCombination = false;

              // Check for linked order combinations
              const linkedOrderId = table.linked_order_id || table.active_order_id;
              if (linkedOrderId) {
                const tablesForOrder = orderTablesMap[linkedOrderId];
                if (tablesForOrder && tablesForOrder.length > 1) {
                  combinedGroupId = linkedOrderId;
                  combinedWithTables = tablesForOrder.join(' + ');
                  isPartOfCombination = true;
                }
              }

              return {
                table_id: table.table_id,
                table_name: table.table_name,
                table_status: actualStatus,
                combined_group_id: combinedGroupId,
                combined_with_tables: combinedWithTables,
                is_part_of_combination: isPartOfCombination,
                active_order: table.active_order_id
                  ? {
                    order_id: table.active_order_id,
                    order_number: table.active_order_number,
                    grand_total: parseFloat(table.active_order_grand_total),
                    status: table.active_order_status,
                    order_type: table.active_order_type,
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
           VALUES ($1, $2, nextval('receipt_number_seq')::text, $3, $4, $5);`,
          [orderId, custId, payment.method, payment.amount, changeForThisPayment]
        );
      }
    }

    if (tableId && status === "completed") {
      // Get cleaning time from settings
      const settingsResult = await client.query(
        "SELECT table_cleaning_time FROM restaurant_settings LIMIT 1"
      );
      const cleaningTimeMinutes = settingsResult.rows[0]?.table_cleaning_time || 2;
      const cleaningTimeMs = cleaningTimeMinutes * 60 * 1000;

      // Get all tables linked to this order
      const linkedTablesResult = await client.query(
        "SELECT id FROM restaurant_tables WHERE linked_order_id = $1",
        [orderId]
      );

      const linkedTableIds = linkedTablesResult.rows.map(row => row.id);

      if (linkedTableIds.length > 0) {
        // Multiple tables were combined - clear linked_order_id and set all to cleaning
        await client.query(
          "UPDATE restaurant_tables SET status = 'cleaning', linked_order_id = NULL, updated_at = NOW() WHERE id = ANY($1::uuid[])",
          [linkedTableIds]
        );

        // Emit WebSocket event for cleaning status
        try {
          const { getIO } = await import('../websocket');
          getIO().emit('posTableStatusUpdate', {
            tableIds: linkedTableIds,
            newStatus: 'cleaning',
            source: 'pos-order-completion',
            timestamp: new Date().toISOString()
          });
          console.log(`📤 Table status update emitted for ${linkedTableIds.length} combined tables (cleaning)`);
        } catch (err) {
          console.warn('WebSocket not available:', err);
        }

        // Schedule all linked tables to become available
        setTimeout(async () => {
          const cleanupClient = await pool.connect();
          try {
            await cleanupClient.query(
              "UPDATE restaurant_tables SET status = 'available', updated_at = NOW() WHERE id = ANY($1::uuid[]) AND status = 'cleaning'",
              [linkedTableIds]
            );
            console.log(`✅ Combined tables (${linkedTableIds.length}) separated and reset to 'available' after ${cleaningTimeMinutes} min cleaning period`);

            // Emit WebSocket event for available status
            try {
              const { getIO } = await import('../websocket');
              getIO().emit('posTableStatusUpdate', {
                tableIds: linkedTableIds,
                newStatus: 'available',
                source: 'pos-auto-cleanup',
                timestamp: new Date().toISOString()
              });
              console.log(`📤 Table status update emitted for ${linkedTableIds.length} tables (available)`);
            } catch (err) {
              console.warn('WebSocket not available:', err);
            }
          } catch (error) {
            console.error(`❌ Error resetting combined tables:`, error);
          } finally {
            cleanupClient.release();
          }
        }, cleaningTimeMs);
      } else {
        // Single table - use existing logic
        await client.query("UPDATE restaurant_tables SET status = 'cleaning', linked_order_id = NULL, updated_at = NOW() WHERE id = $1;", [tableId]);

        // Emit WebSocket event for cleaning status
        try {
          const { getIO } = await import('../websocket');
          getIO().emit('posTableStatusUpdate', {
            tableIds: [tableId],
            newStatus: 'cleaning',
            source: 'pos-order-completion',
            timestamp: new Date().toISOString()
          });
          console.log(`📤 Table status update emitted for table ${tableId} (cleaning)`);
        } catch (err) {
          console.warn('WebSocket not available:', err);
        }

        setTimeout(async () => {
          const cleanupClient = await pool.connect();
          try {
            await cleanupClient.query("UPDATE restaurant_tables SET status = 'available', updated_at = NOW() WHERE id = $1 AND status = 'cleaning';", [tableId]);
            console.log(`✅ Table ${tableId} reset to 'available' after ${cleaningTimeMinutes} min cleaning period`);

            // Emit WebSocket event for available status
            try {
              const { getIO } = await import('../websocket');
              getIO().emit('posTableStatusUpdate', {
                tableIds: [tableId],
                newStatus: 'available',
                source: 'pos-auto-cleanup',
                timestamp: new Date().toISOString()
              });
              console.log(`📤 Table status update emitted for table ${tableId} (available)`);
            } catch (err) {
              console.warn('WebSocket not available:', err);
            }
          } catch (error) {
            console.error(`❌ Error resetting table ${tableId}:`, error);
          } finally {
            cleanupClient.release();
          }
        }, cleaningTimeMs);
      }
    }

    await client.query("COMMIT");
    const finalOrderResult = await client.query(
      `SELECT o.*, c.name as customer_name, c.mobile_number, b.bill_number,
         (SELECT json_agg(json_build_object('menu_item_name', mi.name, 'quantity', oi.quantity, 'id', oi.id, 'unit_price', oi.unit_price, 'total_price', oi.total_price, 'is_complimentary', COALESCE(oi.is_complimentary,false), 'complimentary_quantity', COALESCE(oi.complimentary_quantity, 0)))
           FROM order_items oi JOIN menu_items mi ON mi.id = oi.menu_item_id WHERE oi.order_id = o.id) as order_items
       FROM orders o 
       LEFT JOIN customers c ON o.customer_id = c.id 
       LEFT JOIN (SELECT order_id, bill_number FROM bills WHERE order_id = $1 ORDER BY created_at DESC LIMIT 1) b ON b.order_id = o.id
       WHERE o.id = $1;`,
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
        offer_type, discount_type, discount_value,
        priority, is_stackable, start_time, end_time,
        created_at, updated_at
      FROM offers
      ORDER BY priority ASC, created_at DESC
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
    apply_delivery = true,
    offer_type = 'item',
    discount_type = 'percent',
    discount_value,
    priority = 100,
    is_stackable = false,
    start_time,
    end_time
  } = req.body;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Ensure combos are never stackable
    const stackable = offer_type === 'combo' ? false : is_stackable;

    const result = await client.query(
      `INSERT INTO offers
       (name, discount_percent, active, apply_dine_in, apply_takeaway, apply_delivery,
        offer_type, discount_type, discount_value, priority, is_stackable, start_time, end_time)
       VALUES ($1,$2,true,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING *`,
      [name, discount_percent, apply_dine_in, apply_takeaway, apply_delivery,
        offer_type, discount_type, discount_value, priority, stackable, start_time, end_time]
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
    apply_delivery,
    offer_type,
    discount_type,
    discount_value,
    priority,
    is_stackable,
    start_time,
    end_time
  } = req.body;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Ensure combos are never stackable
    const stackable = offer_type === 'combo' ? false : is_stackable;

    const updated = await client.query(
      `UPDATE offers SET
        name=$1,
        discount_percent=$2,
        apply_dine_in=$3,
        apply_takeaway=$4,
        apply_delivery=$5,
        offer_type=$6,
        discount_type=$7,
        discount_value=$8,
        priority=$9,
        is_stackable=$10,
        start_time=$11,
        end_time=$12,
        updated_at=NOW()
       WHERE id=$13
       RETURNING *`,
      [name, discount_percent, apply_dine_in, apply_takeaway, apply_delivery,
        offer_type, discount_type, discount_value, priority, stackable,
        start_time, end_time, id]
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
   Combos Management
---------------------------*/

// GET /combos
router.get("/combos", async (req: Request, res: Response) => {
  try {
    const combos = await pool.query(`
      SELECT 
        c.id, c.offer_id, c.name, c.fixed_price, c.active, c.created_at,
        o.name as offer_name, o.active as offer_active
      FROM combos c
      LEFT JOIN offers o ON c.offer_id = o.id
      ORDER BY c.created_at DESC
    `);

    const ids = combos.rows.map((c: any) => c.id);
    const itemsMap: Record<string, any[]> = {};

    if (ids.length > 0) {
      const items = await pool.query(
        `SELECT ci.combo_id, ci.menu_item_id, ci.quantity, mi.name, mi.price
         FROM combo_items ci
         JOIN menu_items mi ON ci.menu_item_id = mi.id
         WHERE ci.combo_id = ANY($1::uuid[])`,
        [ids]
      );
      for (const row of items.rows) {
        itemsMap[row.combo_id] = itemsMap[row.combo_id] || [];
        itemsMap[row.combo_id].push({
          menu_item_id: row.menu_item_id,
          name: row.name,
          price: row.price,
          quantity: row.quantity
        });
      }
    }

    res.json(
      combos.rows.map((c: any) => ({
        ...c,
        items: itemsMap[c.id] || []
      }))
    );
  } catch (err) {
    console.error("GET /combos error:", err);
    res.status(500).json({ message: "Failed to fetch combos" });
  }
});

// POST /combos
router.post("/combos", async (req: Request, res: Response) => {
  const { offer_id, name, fixed_price, items = [], active = true } = req.body;

  if (!offer_id || !name || fixed_price === undefined || items.length === 0) {
    return res.status(400).json({ message: "offer_id, name, fixed_price, and items are required" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const result = await client.query(
      `INSERT INTO combos (offer_id, name, fixed_price, active)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [offer_id, name, fixed_price, active]
    );

    const comboId = result.rows[0].id;

    for (const item of items) {
      await client.query(
        `INSERT INTO combo_items (combo_id, menu_item_id, quantity)
         VALUES ($1, $2, $3)`,
        [comboId, item.menu_item_id, item.quantity]
      );
    }

    await client.query("COMMIT");
    res.status(201).json({ ...result.rows[0], items });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("POST /combos error:", err);
    res.status(500).json({ message: "Failed to create combo" });
  } finally {
    client.release();
  }
});

// PUT /combos/:id
router.put("/combos/:id", async (req: Request, res: Response) => {
  const { id } = req.params;
  const { offer_id, name, fixed_price, items = [], active } = req.body;

  if (!offer_id || !name || fixed_price === undefined) {
    return res.status(400).json({ message: "offer_id, name, and fixed_price are required" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const updated = await client.query(
      `UPDATE combos SET
        offer_id = $1,
        name = $2,
        fixed_price = $3,
        active = $4
       WHERE id = $5
       RETURNING *`,
      [offer_id, name, fixed_price, active, id]
    );

    if (updated.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Combo not found" });
    }

    await client.query(`DELETE FROM combo_items WHERE combo_id = $1`, [id]);
    for (const item of items) {
      await client.query(
        `INSERT INTO combo_items (combo_id, menu_item_id, quantity)
         VALUES ($1, $2, $3)`,
        [id, item.menu_item_id, item.quantity]
      );
    }

    await client.query("COMMIT");
    res.json({ ...updated.rows[0], items });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("PUT /combos/:id error:", err);
    res.status(500).json({ message: "Failed to update combo" });
  } finally {
    client.release();
  }
});

// PATCH /combos/:id/toggle
router.patch("/combos/:id/toggle", async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      `UPDATE combos SET active = NOT active WHERE id = $1 RETURNING *`,
      [id]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: "Combo not found" });
    res.json(result.rows[0]);
  } catch (err) {
    console.error("PATCH /combos/:id/toggle error:", err);
    res.status(500).json({ message: "Failed to toggle combo" });
  }
});

// DELETE /combos/:id
router.delete("/combos/:id", async (req: Request, res: Response) => {
  const { id } = req.params;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM combo_items WHERE combo_id = $1", [id]);
    await client.query("DELETE FROM combos WHERE id = $1", [id]);
    await client.query("COMMIT");
    res.status(204).send();
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("DELETE /combos/:id error:", err);
    res.status(500).json({ message: "Failed to delete combo" });
  } finally {
    client.release();
  }
});

/* -------------------------
   Delivery Partners CRUD
---------------------------*/

// GET /delivery-partners
router.get("/delivery-partners", async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      "SELECT id, name, active, created_at, updated_at FROM delivery_partners ORDER BY name ASC"
    );
    res.json(result.rows);
  } catch (err) {
    console.error("GET /delivery-partners error:", err);
    res.status(500).json({ message: "Failed to fetch delivery partners" });
  }
});

// POST /delivery-partners
router.post("/delivery-partners", async (req: Request, res: Response) => {
  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ message: "Partner name is required" });
  }
  try {
    const result = await pool.query(
      "INSERT INTO delivery_partners (name) VALUES ($1) RETURNING *",
      [name.trim()]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("POST /delivery-partners error:", err);
    res.status(500).json({ message: "Failed to create delivery partner" });
  }
});

// PUT /delivery-partners/:id
router.put("/delivery-partners/:id", async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ message: "Partner name is required" });
  }
  try {
    const result = await pool.query(
      "UPDATE delivery_partners SET name = $1, updated_at = NOW() WHERE id = $2 RETURNING *",
      [name.trim(), id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Delivery partner not found" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error("PUT /delivery-partners/:id error:", err);
    res.status(500).json({ message: "Failed to update delivery partner" });
  }
});

// PATCH /delivery-partners/:id/toggle
router.patch("/delivery-partners/:id/toggle", async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      "UPDATE delivery_partners SET active = NOT active, updated_at = NOW() WHERE id = $1 RETURNING *",
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Delivery partner not found" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error("PATCH /delivery-partners/:id/toggle error:", err);
    res.status(500).json({ message: "Failed to toggle delivery partner" });
  }
});

// DELETE /delivery-partners/:id
router.delete("/delivery-partners/:id", async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      "DELETE FROM delivery_partners WHERE id = $1 RETURNING id",
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Delivery partner not found" });
    }
    res.status(204).send();
  } catch (err) {
    console.error("DELETE /delivery-partners/:id error:", err);
    res.status(500).json({ message: "Failed to delete delivery partner" });
  }
});

/* -------------------------
   KOT Devices Management
---------------------------*/

// GET /kot-devices - List all KOT devices
router.get("/kot-devices", async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      "SELECT * FROM kot_devices ORDER BY name ASC"
    );
    res.json(result.rows);
  } catch (err) {
    console.error("GET /kot-devices error:", err);
    res.status(500).json({ message: "Failed to fetch KOT devices" });
  }
});

// POST /kot-devices - Create a new KOT device
router.post("/kot-devices", async (req: Request, res: Response) => {
  const { name, ip_address, port, device_type } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ message: "Device name is required" });
  }
  try {
    const result = await pool.query(
      `INSERT INTO kot_devices (name, ip_address, port, device_type, active)
       VALUES ($1, $2, $3, $4, true) RETURNING *`,
      [name.trim(), ip_address || null, port || 9100, device_type || 'thermal_printer']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("POST /kot-devices error:", err);
    res.status(500).json({ message: "Failed to create KOT device" });
  }
});

// PUT /kot-devices/:id - Update a KOT device
router.put("/kot-devices/:id", async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, ip_address, port, device_type } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ message: "Device name is required" });
  }
  try {
    const result = await pool.query(
      `UPDATE kot_devices 
       SET name = $1, ip_address = $2, port = $3, device_type = $4, updated_at = NOW()
       WHERE id = $5 RETURNING *`,
      [name.trim(), ip_address || null, port || 9100, device_type || 'thermal_printer', id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "KOT device not found" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error("PUT /kot-devices/:id error:", err);
    res.status(500).json({ message: "Failed to update KOT device" });
  }
});

// PATCH /kot-devices/:id/toggle - Toggle device active status
router.patch("/kot-devices/:id/toggle", async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      "UPDATE kot_devices SET active = NOT active, updated_at = NOW() WHERE id = $1 RETURNING *",
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "KOT device not found" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error("PATCH /kot-devices/:id/toggle error:", err);
    res.status(500).json({ message: "Failed to toggle KOT device" });
  }
});

// DELETE /kot-devices/:id - Delete a KOT device
router.delete("/kot-devices/:id", async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      "DELETE FROM kot_devices WHERE id = $1 RETURNING id",
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "KOT device not found" });
    }
    res.status(204).send();
  } catch (err) {
    console.error("DELETE /kot-devices/:id error:", err);
    res.status(500).json({ message: "Failed to delete KOT device" });
  }
});

/* -------------------------
   Kitchen Stations Management
---------------------------*/

// GET /kitchen-stations - List all kitchen stations with their linked devices
router.get("/kitchen-stations", async (req: Request, res: Response) => {
  try {
    const stations = await pool.query(
      "SELECT * FROM kitchen_stations ORDER BY name ASC"
    );

    // Get device mappings for all stations
    const stationIds = stations.rows.map((s: any) => s.id);
    const deviceMappings: Record<string, any[]> = {};

    if (stationIds.length > 0) {
      const mappings = await pool.query(
        `SELECT ksd.station_id, ksd.device_id, kd.name as device_name, kd.ip_address, kd.active as device_active
         FROM kitchen_station_devices ksd
         JOIN kot_devices kd ON ksd.device_id = kd.id
         WHERE ksd.station_id = ANY($1::uuid[])`,
        [stationIds]
      );

      for (const row of mappings.rows) {
        deviceMappings[row.station_id] = deviceMappings[row.station_id] || [];
        deviceMappings[row.station_id].push({
          device_id: row.device_id,
          device_name: row.device_name,
          ip_address: row.ip_address,
          device_active: row.device_active
        });
      }
    }

    res.json(
      stations.rows.map((s: any) => ({
        ...s,
        devices: deviceMappings[s.id] || []
      }))
    );
  } catch (err) {
    console.error("GET /kitchen-stations error:", err);
    res.status(500).json({ message: "Failed to fetch kitchen stations" });
  }
});

// POST /kitchen-stations - Create a new kitchen station
router.post("/kitchen-stations", async (req: Request, res: Response) => {
  const { name, description, device_ids = [] } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ message: "Station name is required" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const result = await client.query(
      `INSERT INTO kitchen_stations (name, description, active)
       VALUES ($1, $2, true) RETURNING *`,
      [name.trim(), description || null]
    );

    const stationId = result.rows[0].id;

    // Link devices to station
    for (const deviceId of device_ids) {
      await client.query(
        "INSERT INTO kitchen_station_devices (station_id, device_id) VALUES ($1, $2)",
        [stationId, deviceId]
      );
    }

    await client.query("COMMIT");
    res.status(201).json({ ...result.rows[0], device_ids });
  } catch (err: any) {
    await client.query("ROLLBACK");
    console.error("POST /kitchen-stations error:", err);
    if (err.code === '23505') {
      return res.status(400).json({ message: "A station with this name already exists" });
    }
    res.status(500).json({ message: "Failed to create kitchen station" });
  } finally {
    client.release();
  }
});

// PUT /kitchen-stations/:id - Update a kitchen station
router.put("/kitchen-stations/:id", async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, description, device_ids = [] } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ message: "Station name is required" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const result = await client.query(
      `UPDATE kitchen_stations 
       SET name = $1, description = $2, updated_at = NOW()
       WHERE id = $3 RETURNING *`,
      [name.trim(), description || null, id]
    );

    if (result.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Kitchen station not found" });
    }

    // Clear existing device mappings and re-add
    await client.query("DELETE FROM kitchen_station_devices WHERE station_id = $1", [id]);

    for (const deviceId of device_ids) {
      await client.query(
        "INSERT INTO kitchen_station_devices (station_id, device_id) VALUES ($1, $2)",
        [id, deviceId]
      );
    }

    await client.query("COMMIT");
    res.json({ ...result.rows[0], device_ids });
  } catch (err: any) {
    await client.query("ROLLBACK");
    console.error("PUT /kitchen-stations/:id error:", err);
    if (err.code === '23505') {
      return res.status(400).json({ message: "A station with this name already exists" });
    }
    res.status(500).json({ message: "Failed to update kitchen station" });
  } finally {
    client.release();
  }
});

// PATCH /kitchen-stations/:id/toggle - Toggle station active status
router.patch("/kitchen-stations/:id/toggle", async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      "UPDATE kitchen_stations SET active = NOT active, updated_at = NOW() WHERE id = $1 RETURNING *",
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Kitchen station not found" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error("PATCH /kitchen-stations/:id/toggle error:", err);
    res.status(500).json({ message: "Failed to toggle kitchen station" });
  }
});

// DELETE /kitchen-stations/:id - Delete a kitchen station
router.delete("/kitchen-stations/:id", async (req: Request, res: Response) => {
  const { id } = req.params;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Clear menu items referencing this station (set to null)
    await client.query("UPDATE menu_items SET station_id = NULL WHERE station_id = $1", [id]);

    // Delete device mappings (cascade should handle this, but being explicit)
    await client.query("DELETE FROM kitchen_station_devices WHERE station_id = $1", [id]);

    // Delete the station
    const result = await client.query(
      "DELETE FROM kitchen_stations WHERE id = $1 RETURNING id",
      [id]
    );

    if (result.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Kitchen station not found" });
    }

    await client.query("COMMIT");
    res.status(204).send();
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("DELETE /kitchen-stations/:id error:", err);
    res.status(500).json({ message: "Failed to delete kitchen station" });
  } finally {
    client.release();
  }
});

export default router;

