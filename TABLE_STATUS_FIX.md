# Table Status Reset Fix

## Issue Description

**Problem:** After completing and paying for an order, tables were stuck in `'paid'` status and couldn't be used for new orders.

**Error Message:**

```
Failed to create order: Table is not available. Current status: paid. Please select a different table.
```

## Root Cause

In the order completion endpoint (`PUT /orders/:orderId/complete`), when an order was marked as completed, the table status was being set to `'paid'` instead of `'available'`. This left tables in an unusable state.

### Incorrect Code (Line 309):

```typescript
if (tableId) {
    await client.query(
        "UPDATE restaurant_tables SET status = 'paid', updated_at = NOW() WHERE id = $1;",
        [tableId]
    );
}
```

## Solution

### 1. Code Fix

Updated the order completion logic to reset tables to `'available'` status:

**Fixed Code:**

```typescript
// Reset table to 'available' when order is completed
if (tableId && status === "completed") {
    await client.query(
        "UPDATE restaurant_tables SET status = 'available', updated_at = NOW() WHERE id = $1;",
        [tableId]
    );
}
```

**Key Changes:**

-   ✅ Only updates table when order status is `'completed'`
-   ✅ Sets status to `'available'` instead of `'paid'`
-   ✅ Tables are immediately ready for new orders

### 2. Database Fix

Fixed existing tables stuck in `'paid'` status:

**Fix Script:** `backend/fix_tables.js`

```javascript
const result = await pool.query(
    "UPDATE restaurant_tables SET status = 'available', updated_at = NOW() WHERE status = 'paid' RETURNING id, name, status"
);
```

**Result:**

-   ✅ Fixed 3 tables (T2, Table 1, Table 2)
-   ✅ All tables now available for new orders

## Table Status Flow (Corrected)

### Before Fix (Broken):

```
available → occupied → paid ❌ (stuck here)
```

### After Fix (Working):

```
available → occupied → available ✅ (ready for reuse)
    ↑                        ↓
    └────────────────────────┘
```

## Detailed Flow

### Creating Order

1. Customer arrives
2. Staff selects **available** table
3. Creates order
4. Table status → **occupied**

### Completing Order

1. Order items served
2. Bill generated
3. Payment received
4. Order marked as **completed**
5. Table status → **available** ✅ (fixed)

### New Order on Same Table

1. Previous order completed
2. Table now **available**
3. New customer can be assigned
4. Cycle repeats

## Testing

### Test Case 1: Complete Order and Verify Table Reset

1. Create dine-in order for Table 1
2. Complete the order (status = 'completed')
3. Check table status in database:
    ```sql
    SELECT id, name, status FROM restaurant_tables WHERE id = 1;
    ```
4. ✅ Expected: status = 'available'

### Test Case 2: Create New Order on Previously Used Table

1. Complete an order on Table 2
2. Try to create new order on Table 2
3. ✅ Expected: Order created successfully
4. ❌ Before fix: "Table is not available. Current status: paid"

### Test Case 3: Multiple Orders Same Day

1. Table 3: Morning customer (7am-8am)
2. Complete order → Table available
3. Table 3: Lunch customer (12pm-1pm)
4. Complete order → Table available
5. Table 3: Evening customer (7pm-8pm)
6. ✅ Expected: All orders created successfully

## Database Schema

### restaurant_tables.status Values

**Valid Statuses:**

-   `'available'` - Table is free and ready for new orders ✅
-   `'occupied'` - Table has an active order in progress
-   `'bill_printed'` - Bill generated, awaiting payment (if used)
-   ~~`'paid'`~~ - **REMOVED** (was causing the bug)

**Status Transitions:**

```
available
   ↓ (create order)
occupied
   ↓ (complete order)
available (cycle repeats)
```

## Files Modified

### 1. backend/src/routes/setting.ts (Line 309)

**Changed:**

```diff
- if (tableId) {
-   await client.query("UPDATE restaurant_tables SET status = 'paid', updated_at = NOW() WHERE id = $1;", [tableId]);
- }
+ // Reset table to 'available' when order is completed
+ if (tableId && status === 'completed') {
+   await client.query("UPDATE restaurant_tables SET status = 'available', updated_at = NOW() WHERE id = $1;", [tableId]);
+ }
```

### 2. backend/fix_tables.js (New File)

**Purpose:** One-time script to fix existing stuck tables

**Usage:**

```bash
cd backend
node fix_tables.js
```

**Output:**

```
✅ Fixed 3 tables:
  - Table T2 (ID: 2) → available
  - Table Table 1 (ID: 5) → available
  - Table Table 2 (ID: 6) → available
```

### 3. backend/fix_table_status.sql (New File)

**Purpose:** SQL version of the fix script (manual execution)

## Prevention

### Backend Validation

The existing validation in `backend/src/routes/order.ts` prevents orders on non-available tables:

```typescript
// Check if table is available
if (tableCheck.rows[0].status !== "available") {
    return res.status(400).json({
        message: `Table is not available. Current status: ${tableCheck.rows[0].status}. Please select a different table.`,
    });
}
```

This validation will now work correctly since tables are properly reset to `'available'` after order completion.

## Impact

### Before Fix

-   ❌ Tables stuck in 'paid' status
-   ❌ Cannot create new orders
-   ❌ Manual database intervention required
-   ❌ Poor user experience

### After Fix

-   ✅ Tables automatically reset to 'available'
-   ✅ Ready for new orders immediately
-   ✅ No manual intervention needed
-   ✅ Smooth order flow
-   ✅ Better table utilization

## Monitoring

To check for any stuck tables in the future:

```sql
-- Check table status distribution
SELECT status, COUNT(*) as count
FROM restaurant_tables
GROUP BY status;

-- Find tables that might be stuck
SELECT id, name, status, updated_at
FROM restaurant_tables
WHERE status NOT IN ('available', 'occupied')
ORDER BY updated_at DESC;
```

## Related Features

This fix works together with:

-   **Table Validation** (dine-in orders require available tables)
-   **Order Creation** (sets table to 'occupied')
-   **Order Completion** (resets table to 'available')
-   **Loyalty Points System** (processes during order completion)
-   **Inventory Deduction** (happens during order completion)

---

**Fixed:** October 18, 2025  
**Status:** ✅ Resolved  
**Impact:** Critical - Blocks all new dine-in orders  
**Resolution Time:** Immediate (code fix + database cleanup)
