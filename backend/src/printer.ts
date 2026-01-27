// backend/src/printer.ts
// Kitchen Order Ticket (KOT) printing utility for routing orders to kitchen stations

import * as net from "net"
import type { Pool, PoolClient } from "pg"

interface OrderInfo {
    order_number: string
    table_name?: string | null
    order_type: string
    waiter_name?: string | null
    notes?: string | null
    kot_number?: string | number
    order_count?: number
    isUpdate?: boolean
}

interface KOTItem {
    name: string
    quantity: number
    unit_price?: number
    price?: number
    notes?: string | null
    portion_name?: string | null
    status?: string
    menu_item_id?: string
}

/**
 * Generate ESC/POS commands for KOT (Kitchen Order Ticket)
 * Format matches thermal printer layout
 */
function generateKOTCommands(orderInfo: OrderInfo, items: KOTItem[], stationName: string): string {
    const ESC = "\x1B"
    const GS = "\x1D"
    const LF = "\x0A"

    // ESC/POS commands
    const INIT = ESC + "@" // Initialize printer
    const ALIGN_CENTER = ESC + "a" + "\x01" // Center align
    const ALIGN_LEFT = ESC + "a" + "\x00" // Left align
    const BOLD_ON = ESC + "E" + "\x01" // Bold on
    const BOLD_OFF = ESC + "E" + "\x00" // Bold off
    const DOUBLE_SIZE = GS + "!" + "\x11" // Double width + double height
    const NORMAL_SIZE = GS + "!" + "\x00" // Normal size
    const CUT = GS + "V" + "\x00" // Full cut

    const now = new Date()
    // Format: M/DD/YYYY
    const dateStr = `${now.getMonth() + 1}/${now.getDate()}/${now.getFullYear()}`
    // Format: H:MM AM/PM
    const timeStr = now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })

    // Get order type display strings
    const orderTypeRaw = orderInfo.order_type || "dine_in"
    let orderTypeDisplay = ""
    let serviceTypeDisplay = ""

    switch (orderTypeRaw) {
        case "telephone":
        case "phone":
            orderTypeDisplay = "Telephone - PICKUP"
            serviceTypeDisplay = "PICKUP"
            break
        case "take_away":
        case "pickup":
            orderTypeDisplay = "TAKE AWAY"
            serviceTypeDisplay = "PICKUP"
            break
        case "delivery":
        case "online_delivery":
            orderTypeDisplay = "DELIVERY"
            serviceTypeDisplay = "DELIVERY"
            break
        case "dine_in":
        default:
            orderTypeDisplay = "DINE IN"
            serviceTypeDisplay = "DINE IN"
            break
    }

    // Extract order number (e.g., "ORD000079" -> "79")
    const orderNoMatch = (orderInfo.order_number || "").match(/(\d+)$/)
    const orderNoDisplay = orderNoMatch ? parseInt(orderNoMatch[1], 10) : orderInfo.order_number

    let commands = ""

    // Initialize
    commands += INIT

    // ======== HEADER ========
    commands += ALIGN_CENTER
    commands += (orderInfo.isUpdate ? "KOT UPDATE" : "KITCHEN ORDER TICKET") + LF
    commands += "KOT" + LF
    commands += "--------------------------------" + LF

    // ======== ORDER TYPE ========
    commands += BOLD_ON
    commands += DOUBLE_SIZE
    commands += orderTypeDisplay + LF
    commands += serviceTypeDisplay + LF
    commands += `ORDER No. ${orderNoDisplay}` + LF
    commands += NORMAL_SIZE
    commands += BOLD_OFF
    commands += "--------------------------------" + LF

    // ======== DATE/TIME | TABLE/KOT ========
    commands += ALIGN_LEFT
    commands += `Date:${dateStr} | Time:${timeStr}` + LF
    commands += `Table:<${orderInfo.table_name || "N/A"}> | KOT No:${orderInfo.kot_number || orderNoDisplay}` + LF
    commands += `Waiter: ${orderInfo.waiter_name || ""}` + LF

    // ======== STATION NAME (if applicable) ========
    if (stationName && stationName.toUpperCase() !== "KITCHEN") {
        commands += `Station: ${stationName.toUpperCase()}` + LF
    }
    commands += "--------------------------------" + LF

    // ======== ITEMS with columns: NAME | QTY | PRICE | TOTAL ========
    items.forEach((item) => {
        const name = (item.name || "").substring(0, 16).padEnd(16)
        const qty = String(item.quantity || 1).padStart(3)
        const price = (item.unit_price || item.price || 0).toFixed(3)
        const total = ((item.unit_price || item.price || 0) * (item.quantity || 1)).toFixed(3)

        commands += `${name} ${qty} ${price} ${total}` + LF

        // Portion if present
        if (item.portion_name) {
            commands += `  (${item.portion_name})` + LF
        }

        // Notes if present
        if (item.notes && item.notes.trim()) {
            commands += `  >> ${item.notes}` + LF
        }

        // Status for updates (NEW, UPDATED)
        if (item.status) {
            commands += `  [${item.status}]` + LF
        }
    })

    commands += "--------------------------------" + LF

    // ======== NOTES SECTION ========
    commands += BOLD_ON
    commands += "NOTES:" + LF
    commands += BOLD_OFF
    commands += (orderInfo.notes || "") + LF
    commands += "________________________________" + LF

    // ======== ORDER COUNT ========
    commands += `Order Count: ${orderInfo.order_count || items.length}` + LF
    commands += "--------------------------------" + LF

    // Feed paper and cut
    commands += LF + LF + LF
    commands += CUT

    return commands
}

/**
 * Print formatted KOT to console (for debugging/no-printer mode)
 */
function printKOTToConsole(orderInfo: OrderInfo, items: KOTItem[], stationName: string): void {
    const now = new Date()
    const dateStr = `${now.getMonth() + 1}/${now.getDate()}/${now.getFullYear()}`
    const timeStr = now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })

    const orderTypeRaw = orderInfo.order_type || "dine_in"
    let orderTypeDisplay = ""
    let serviceTypeDisplay = ""

    switch (orderTypeRaw) {
        case "telephone":
        case "phone":
            orderTypeDisplay = "Telephone - PICKUP"
            serviceTypeDisplay = "PICKUP"
            break
        case "take_away":
        case "pickup":
            orderTypeDisplay = "TAKE AWAY"
            serviceTypeDisplay = "PICKUP"
            break
        case "delivery":
        case "online_delivery":
            orderTypeDisplay = "DELIVERY"
            serviceTypeDisplay = "DELIVERY"
            break
        case "dine_in":
        default:
            orderTypeDisplay = "DINE IN"
            serviceTypeDisplay = "DINE IN"
            break
    }

    const orderNoMatch = (orderInfo.order_number || "").match(/(\d+)$/)
    const orderNoDisplay = orderNoMatch ? parseInt(orderNoMatch[1], 10) : orderInfo.order_number

    console.log("")
    console.log("┌────────────────────────────────────────┐")
    console.log(`│       ${orderInfo.isUpdate ? "KOT UPDATE" : "KITCHEN ORDER TICKET"}             │`)
    console.log("│               KOT                      │")
    console.log("├────────────────────────────────────────┤")
    console.log(`│  ${orderTypeDisplay.padEnd(36)}│`)
    console.log(`│  ${serviceTypeDisplay.padEnd(36)}│`)
    console.log(`│  ORDER No. ${String(orderNoDisplay).padEnd(26)}│`)
    console.log("├────────────────────────────────────────┤")
    console.log(`│  Date:${dateStr} | Time:${timeStr}`.padEnd(40) + "│")
    console.log(`│  Table:<${orderInfo.table_name || "N/A"}> | KOT No:${orderInfo.kot_number || orderNoDisplay}`.padEnd(40) + "│")
    console.log(`│  Waiter: ${(orderInfo.waiter_name || "").padEnd(28)}│`)
    if (stationName && stationName.toUpperCase() !== "KITCHEN") {
        console.log(`│  Station: ${stationName.toUpperCase().padEnd(27)}│`)
    }
    console.log("├────────────────────────────────────────┤")
    console.log("│  ITEM              QTY   PRICE   TOTAL │")
    console.log("├────────────────────────────────────────┤")
    items.forEach((item) => {
        const name = (item.name || "").substring(0, 16).padEnd(16)
        const qty = String(item.quantity || 1).padStart(3)
        const price = (item.unit_price || item.price || 0).toFixed(3)
        const total = ((item.unit_price || item.price || 0) * (item.quantity || 1)).toFixed(3)
        console.log(`│  ${name} ${qty} ${price} ${total} │`)
        if (item.portion_name) {
            console.log(`│    (${item.portion_name})`.padEnd(40) + "│")
        }
        if (item.notes && item.notes.trim()) {
            console.log(`│    >> ${item.notes.substring(0, 30)}`.padEnd(40) + "│")
        }
        if (item.status) {
            console.log(`│    [${item.status}]`.padEnd(40) + "│")
        }
    })
    console.log("├────────────────────────────────────────┤")
    console.log("│  NOTES:                                │")
    console.log(`│  ${(orderInfo.notes || "").substring(0, 36).padEnd(36)}│`)
    console.log("│  ____________________________________  │")
    console.log(`│  Order Count: ${String(orderInfo.order_count || items.length).padEnd(23)}│`)
    console.log("└────────────────────────────────────────┘")
    console.log("")
}

/**
 * Print KOT to a network thermal printer
 */
function printKitchenOrder(
    ip: string | null,
    port: number | null,
    orderInfo: OrderInfo,
    items: KOTItem[],
    stationName: string,
): Promise<{ success?: boolean; mock?: boolean; station: string }> {
    return new Promise((resolve, reject) => {
        // Always show formatted console output for debugging/visibility
        printKOTToConsole(orderInfo, items, stationName)

        // If no printer configured, we're done (mock mode)
        if (!ip || !port) {
            console.log(`[KOT] ℹ️  No printer configured for ${stationName} - console output only`)
            return resolve({ mock: true, station: stationName })
        }

        // Try to send to network printer
        const commands = generateKOTCommands(orderInfo, items, stationName)
        const client = new net.Socket()
        const timeout = 5000 // 5 second timeout

        const timer = setTimeout(() => {
            client.destroy()
            reject(new Error(`Connection timeout to printer ${ip}:${port}`))
        }, timeout)

        client.connect(port, ip, () => {
            console.log(`[KOT] ✅ Connected to printer ${stationName} (${ip}:${port})`)
            client.write(commands, () => {
                clearTimeout(timer)
                client.end()
                console.log(`[KOT] 🖨️ KOT sent to ${stationName}`)
                resolve({ success: true, station: stationName })
            })
        })

        client.on("error", (err) => {
            clearTimeout(timer)
            console.error(`[KOT] ❌ Printer error (${stationName}):`, err.message)
            reject(err)
        })

        client.on("close", () => {
            clearTimeout(timer)
        })
    })
}

/**
 * Route order items to their respective kitchen station printers
 */
export async function routeToKitchenStations(
    pool: Pool,
    orderId: string,
    orderInfo: OrderInfo,
): Promise<{ success: boolean; stationsPrinted?: number; results?: any[]; error?: string }> {
    let client: PoolClient | null = null
    try {
        console.log(`[KOT] 🔄 Routing order ${orderId} to kitchen stations...`)
        client = await pool.connect()

        // Get items grouped by station
        const itemsByStationQuery = `
      SELECT 
        mi.station_id,
        ks.name as station_name,
        json_agg(json_build_object(
          'name', mi.name,
          'quantity', oi.quantity,
          'unit_price', oi.unit_price,
          'notes', oi.notes,
          'portion_name', oi.portion_name
        )) as items
      FROM order_items oi
      JOIN menu_items mi ON mi.id = oi.menu_item_id
      LEFT JOIN kitchen_stations ks ON ks.id = mi.station_id
      WHERE oi.order_id = $1 AND mi.station_id IS NOT NULL
      GROUP BY mi.station_id, ks.name
    `

        const itemsResult = await client.query(itemsByStationQuery, [orderId])

        if (itemsResult.rows.length === 0) {
            console.log("[KOT] ⚠️ No items with station_id found, skipping kitchen print")
            console.log("[KOT] ℹ️  Tip: Assign station_id to menu items to enable kitchen routing")
            return { success: true, stationsPrinted: 0 }
        }

        // Display station split summary
        console.log("")
        console.log("╔══════════════════════════════════════════════════════════════╗")
        console.log("║  🍽️  KITCHEN STATION ROUTING SUMMARY                          ║")
        console.log(`║  Order: ${orderInfo.order_number}  |  Table: ${orderInfo.table_name || "N/A"}`.padEnd(65) + "║")
        console.log("╠══════════════════════════════════════════════════════════════╣")
        console.log(`║  📊 Splitting order into ${itemsResult.rows.length} station(s):`.padEnd(65) + "║")
        console.log("╠══════════════════════════════════════════════════════════════╣")

        itemsResult.rows.forEach((station: any, idx: number) => {
            console.log(`║  Station ${idx + 1}: ${(station.station_name || "UNASSIGNED").toUpperCase()}`.padEnd(65) + "║")
            console.log(`║  ├─ Items: ${station.items.length}`.padEnd(65) + "║")
            station.items.forEach((item: any) => {
                console.log(`║  │   • ${item.quantity}x ${item.name}`.substring(0, 64).padEnd(65) + "║")
            })
        })
        console.log("╚══════════════════════════════════════════════════════════════╝")
        console.log("")

        const printResults: any[] = []

        // For each station, get printers and send KOT
        for (const stationGroup of itemsResult.rows) {
            const { station_id, station_name, items } = stationGroup

            // Get printers for this station
            const printersQuery = `
        SELECT kd.ip_address, kd.port, kd.name as printer_name
        FROM kitchen_station_devices ksd
        JOIN kot_devices kd ON kd.id = ksd.device_id
        WHERE ksd.station_id = $1 AND kd.active = true
      `

            const printersResult = await client.query(printersQuery, [station_id])

            if (printersResult.rows.length === 0) {
                console.log(`[KOT] ⚠️ No active printers for station ${station_name}, using console`)
                // Print to console as fallback
                await printKitchenOrder(null, null, orderInfo, items, station_name)
                printResults.push({ station: station_name, printed: false, reason: "no_printer" })
                continue
            }

            // Print to all printers for this station
            for (const printer of printersResult.rows) {
                try {
                    await printKitchenOrder(printer.ip_address, printer.port, orderInfo, items, station_name)
                    printResults.push({ station: station_name, printer: printer.printer_name, printed: true })
                } catch (printErr: any) {
                    console.error(`[KOT] ❌ Failed to print to ${printer.printer_name}:`, printErr.message)
                    printResults.push({
                        station: station_name,
                        printer: printer.printer_name,
                        printed: false,
                        error: printErr.message,
                    })
                }
            }
        }

        console.log(`[KOT] ✅ Kitchen routing complete:`, JSON.stringify(printResults))
        return { success: true, results: printResults }
    } catch (err: any) {
        console.error("[KOT] ❌ Error routing to kitchen stations:", err.message)
        return { success: false, error: err.message }
    } finally {
        if (client) client.release()
    }
}

/**
 * Route order update diffs (new/changed items) to kitchen stations
 * Used when an order is updated with new items
 */
export async function routeDiffsToKitchenStations(
    pool: Pool,
    diffs: KOTItem[],
    orderInfo: OrderInfo,
): Promise<{ success: boolean; stationsPrinted?: number; fallback?: boolean; results?: any[]; error?: string }> {
    let client: PoolClient | null = null
    try {
        // Filter only NEW and UPDATED items (not CANCELLED)
        const itemsToRoute = diffs.filter((d) => d.status === "NEW" || d.status === "UPDATED")

        if (itemsToRoute.length === 0) {
            console.log("[KOT] No new/updated items to route to kitchen")
            return { success: true, stationsPrinted: 0 }
        }

        console.log(`[KOT] 🔄 Routing ${itemsToRoute.length} changed items to kitchen stations...`)
        client = await pool.connect()

        // Get station info for each item's menu_item_id
        const menuItemIds = itemsToRoute.filter((item) => item.menu_item_id).map((item) => item.menu_item_id)

        if (menuItemIds.length === 0) {
            console.log("[KOT] ⚠️ No menu_item_ids in diffs, cannot route to stations")
            // Fallback: print to console
            console.log("============ KOT UPDATE ==============")
            console.log(`Order: ${orderInfo.order_number}`)
            console.log("Changed Items:")
            itemsToRoute.forEach((item) => {
                console.log(`  [${item.status}] ${item.quantity}x ${item.name}`)
            })
            console.log("=====================================")
            return { success: true, fallback: true }
        }

        // Get station assignments for these menu items
        const stationQuery = `
      SELECT 
        mi.id as menu_item_id,
        mi.name,
        mi.station_id,
        ks.name as station_name
      FROM menu_items mi
      LEFT JOIN kitchen_stations ks ON ks.id = mi.station_id
      WHERE mi.id = ANY($1::uuid[])
    `
        const stationResult = await client.query(stationQuery, [menuItemIds])

        // Create a map of menu_item_id -> station info
        const stationMap = new Map<string, { station_id: string | null; station_name: string }>()
        stationResult.rows.forEach((row: any) => {
            stationMap.set(row.menu_item_id, {
                station_id: row.station_id,
                station_name: row.station_name || "UNASSIGNED",
            })
        })

        // Group items by station
        const itemsByStation = new Map<string, { station_name: string; items: KOTItem[] }>()
        itemsToRoute.forEach((item) => {
            const stationInfo = stationMap.get(item.menu_item_id!)
            const stationKey = stationInfo?.station_id || "unassigned"
            const stationName = stationInfo?.station_name || "UNASSIGNED"

            if (!itemsByStation.has(stationKey)) {
                itemsByStation.set(stationKey, { station_name: stationName, items: [] })
            }
            itemsByStation.get(stationKey)!.items.push({
                name: item.name,
                quantity: item.quantity,
                notes: item.notes,
                portion_name: item.portion_name,
                status: item.status,
            })
        })

        const printResults: any[] = []

        // For each station, get printers and send KOT
        for (const [stationId, stationData] of itemsByStation) {
            const { station_name, items } = stationData

            if (stationId === "unassigned") {
                console.log(`[KOT] ⚠️ Items without station assignment, logging to console`)
                await printKitchenOrder(null, null, { ...orderInfo, isUpdate: true }, items, "UNASSIGNED")
                printResults.push({ station: "UNASSIGNED", printed: false, reason: "no_station" })
                continue
            }

            // Get printers for this station
            const printersQuery = `
        SELECT kd.ip_address, kd.port, kd.name as printer_name
        FROM kitchen_station_devices ksd
        JOIN kot_devices kd ON kd.id = ksd.device_id
        WHERE ksd.station_id = $1 AND kd.active = true
      `
            const printersResult = await client.query(printersQuery, [stationId])

            if (printersResult.rows.length === 0) {
                console.log(`[KOT] ⚠️ No active printers for station ${station_name}, using console`)
                await printKitchenOrder(null, null, { ...orderInfo, isUpdate: true }, items, station_name)
                printResults.push({ station: station_name, printed: false, reason: "no_printer" })
                continue
            }

            // Print to all printers for this station
            for (const printer of printersResult.rows) {
                try {
                    await printKitchenOrder(printer.ip_address, printer.port, { ...orderInfo, isUpdate: true }, items, station_name)
                    printResults.push({ station: station_name, printer: printer.printer_name, printed: true })
                } catch (printErr: any) {
                    console.error(`[KOT] ❌ Failed to print to ${printer.printer_name}:`, printErr.message)
                    printResults.push({
                        station: station_name,
                        printer: printer.printer_name,
                        printed: false,
                        error: printErr.message,
                    })
                }
            }
        }

        console.log(`[KOT] ✅ Kitchen diff routing complete:`, JSON.stringify(printResults))
        return { success: true, results: printResults }
    } catch (err: any) {
        console.error("[KOT] ❌ Error routing diffs to kitchen stations:", err.message)
        return { success: false, error: err.message }
    } finally {
        if (client) client.release()
    }
}
