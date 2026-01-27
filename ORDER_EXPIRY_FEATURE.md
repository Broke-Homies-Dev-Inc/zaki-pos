# Order Expiry Settings - Implementation Summary

## Overview
Created a new settings component similar to TimerSettings that allows configuring an automatic order expiry time for testing purposes. When orders exceed this time limit, they are automatically expired, tables are freed, and any table combinations are removed.

## Changes Made

### 1. Database Schema
**File:** `/srv/zaki/workspace/backend/migrations/add_order_expiry_setting.sql`
- Added `order_expiry_time` column to `restaurant_settings` table
- Default value: 60 minutes
- Type: INTEGER (stores time in minutes)

**To apply migration:**
```bash
cd /srv/zaki/workspace/backend
psql postgresql://postgres:1234@localhost:5432/restaurant_db -f migrations/add_order_expiry_setting.sql
```

### 2. Frontend Components

#### OrderExpirySettings Component
**File:** `/srv/zaki/workspace/frontend/src/pages/settings/OrderExpirySettings.tsx`
- New settings page for managing order expiry time
- Features:
  - Input field for expiry time (in minutes)
  - Warning notice indicating it's for testing purposes
  - Visual timeline preview showing order lifecycle
  - Explanation of what happens when orders expire
  - Validation (minimum 1 minute)

#### Settings Page Integration
**File:** `/srv/zaki/workspace/frontend/src/pages/settings/Settings.tsx`
- Added "Order Expiry Settings" option to the main settings menu
- Integrated routing for the new component
- Positioned between "Table Timer Settings" and "Delivery Partners"

#### TypeScript Types Update
**File:** `/srv/zaki/workspace/frontend/src/hooks/useRestaurantSettings.ts`
- Added `order_expiry_time: number` to `RestaurantSettings` interface
- Updated default settings to include `order_expiry_time: 60`

### 3. Backend Implementation

#### Settings Routes Update
**File:** `/srv/zaki/workspace/backend/src/routes/setting.ts`
- Updated GET `/api/setting/settings` to include `order_expiry_time`
- Updated POST `/api/setting/settings` to save `order_expiry_time`
- Added field to INSERT and UPDATE queries
- Added to default settings responses

#### Order Expiry Routes (NEW)
**File:** `/srv/zaki/workspace/backend/src/routes/orderExpiry.ts`

**Endpoints:**

1. **POST `/api/order-expiry/check-and-expire`**
   - Checks for orders older than the configured expiry time
   - Automatically expires orders with status 'pending' or 'confirmed'
   - Frees associated tables
   - Removes table combinations
   - Emits WebSocket event for real-time updates
   - Returns count of expired orders

2. **GET `/api/order-expiry/status`**
   - Returns information about active orders
   - Shows age of each order
   - Calculates time until expiry
   - Identifies already expired orders
   - Useful for monitoring and testing

3. **POST `/api/order-expiry/clear-all-pending`** ⚠️ **DANGER**
   - Immediately expires ALL pending and confirmed orders
   - Frees ALL tables across the entire restaurant
   - Removes ALL table combinations
   - Resets the entire dining area
   - Requires double confirmation in the UI
   - Returns count of orders cleared, tables freed, and combinations removed

#### Routes Registration
**File:** `/srv/zaki/workspace/backend/src/routes/Index.ts`
- Registered new `/api/order-expiry` route endpoint

## How It Works

### Order Expiry Flow

1. **Configuration**
   - Admin sets expiry time in Settings → Order Expiry Settings
   - Time is stored in minutes (e.g., 60 = 1 hour)

2. **Checking for Expired Orders**
   - Call POST `/api/order-expiry/check-and-expire` (can be automated with cron job or scheduler)
   - System queries orders with status 'pending' or 'confirmed'
   - Compares order creation time with current time

3. **When an Order Expires**
   - Order status is changed to 'expired'
   - If dine-in order:
     - Checks if table is part of a combination
     - If combined: Frees ALL linked tables and removes combination
     - If single table: Marks table as 'available'
   - WebSocket event is emitted to update all connected clients
   - Transaction is committed

4. **Visual Feedback**
   - OrderExpirySettings page shows example timeline
   - Status endpoint shows real-time order ages

## Usage

### For Testing

1. **Set a Short Expiry Time**
   - Go to Settings → Order Expiry Settings
   - Set expiry time to 5 minutes (or desired test duration)
   - Save settings

2. **Create Test Orders**
   - Create one or more orders
   - Wait for the expiry time to pass

3. **Trigger Expiry Check**
   - Make a POST request to `/api/order-expiry/check-and-expire`
   - Or use the status endpoint to monitor: `/api/order-expiry/status`

### API Examples

**Check Order Expiry Status:**
```bash
curl http://localhost:4000/api/order-expiry/status
```

**Manually Trigger Expiry Check:**
```bash
curl -X POST http://localhost:4000/api/order-expiry/check-and-expire
```

**Clear All Pending Orders (DANGER):**
```bash
curl -X POST http://localhost:4000/api/order-expiry/clear-all-pending
```
⚠️ **Warning:** This will immediately expire all pending/confirmed orders and free all tables!

### Automation (Optional)

To automatically check for expired orders, you could:

1. **Add a cron job** (Linux/Mac):
```bash
*/5 * * * * curl -X POST http://localhost:4000/api/order-expiry/check-and-expire
```

2. **Use node-cron** in the backend:
```typescript
import cron from 'node-cron';

// Run every 5 minutes
cron.schedule('*/5 * * * *', async () => {
  console.log('Checking for expired orders...');
  // Call the expiry logic
});
```

## What Gets Cleaned Up

When an order expires:

✅ Order status → 'expired'
✅ Associated table(s) → status 'available'
✅ Table combinations → removed (linked_order_id set to NULL)
✅ All linked tables → separated and freed
✅ Order history → preserved (not deleted)

## Testing Checklist

- [ ] Apply database migration
- [ ] Restart backend server
- [ ] Navigate to Settings → Order Expiry Settings
- [ ] Set expiry time to 2 minutes
- [ ] Create a test order (dine-in)
- [ ] Wait 2 minutes
- [ ] Call POST `/api/order-expiry/check-and-expire`
- [ ] Verify order status changed to 'expired'
- [ ] Verify table is now 'available'
- [ ] Test with combined tables
- [ ] Verify all tables in combination are freed
- [ ] **Test Clear All Feature:**
  - [ ] Create multiple test orders (mix of dine-in, combined tables)
  - [ ] Click "Clear All Pending Orders" button
  - [ ] Confirm both warning dialogs
  - [ ] Verify all orders are expired
  - [ ] Verify all tables are freed
  - [ ] Verify all combinations are removed

## Important Notes

⚠️ **This is a testing feature**
- Designed for development and testing environments
- Not recommended for production use without additional safeguards
- Consider adding confirmation dialogs or admin-only access

⚠️ **Order Preservation**
- Expired orders are NOT deleted
- They remain in the database with status 'expired'
- Order history is preserved for auditing

⚠️ **WebSocket Events**
- The system emits 'orders:expired' event when orders expire
- The system emits 'orders:all-cleared' event when all orders are cleared
- Frontend clients can listen to this event for real-time updates
- Requires WebSocket connection to be active

## UI Features

### Order Expiry Settings Page

The settings page includes two main sections:

1. **Order Expiry Time Configuration**
   - Set the time (in minutes) after which orders automatically expire
   - Visual timeline showing the lifecycle
   - Validation to ensure minimum 1 minute

2. **Danger Zone - Clear All Pending Orders** 🔴
   - Red-highlighted section at the bottom
   - Button to immediately clear ALL pending orders
   - Double confirmation dialogs to prevent accidents
   - Shows statistics after clearing:
     - Number of orders expired
     - Number of tables freed
     - Number of combinations removed
   - Useful for resetting the system during testing

### Safety Features

- **Double Confirmation:** Requires two separate confirmations before clearing
- **Clear Warnings:** Explicit messaging about what will happen
- **Transaction Safety:** All database operations in a transaction (rollback on error)
- **Real-time Updates:** WebSocket events notify connected clients immediately

## Future Enhancements

Potential improvements:
- [ ] Add automatic scheduler to check expiry every N minutes
- [ ] Send notifications before order expires (warning)
- [ ] Add expiry history/logs
- [ ] Per-order-type expiry times (different for dine-in vs takeaway)
- [ ] Admin dashboard to view recently expired orders
- [ ] Option to "revive" expired orders
