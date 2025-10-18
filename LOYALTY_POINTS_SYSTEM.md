# Loyalty Points System

## Overview

A complete loyalty points system where customers with phone numbers automatically earn points when they complete orders. The points rate is fully configurable through the Settings page.

## Features

✅ **Automatic Points Award**: Points awarded when orders are completed  
✅ **Configurable Rates**: Set how many points per ₹100 spent  
✅ **Enable/Disable**: Turn the system on or off  
✅ **Customer Tracking**: Points linked to customer phone numbers  
✅ **Transaction History**: Full audit trail of points earned  
✅ **Real-time Updates**: Instant point calculation and awarding

## Database Schema

### New Tables

#### `loyalty_transactions`

```sql
CREATE TABLE loyalty_transactions (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER REFERENCES customers(id),
  order_id INTEGER REFERENCES orders(id),
  points_earned INTEGER DEFAULT 0,
  points_redeemed INTEGER DEFAULT 0,
  transaction_type VARCHAR(20), -- 'earned', 'redeemed', 'adjustment'
  description TEXT,
  order_amount DECIMAL(10, 2),
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Modified Tables

#### `customers` table

-   Added: `loyalty_points INTEGER DEFAULT 0`

#### `restaurant_settings` table

-   Added: `loyalty_points_enabled BOOLEAN DEFAULT true`
-   Added: `loyalty_points_per_100 INTEGER DEFAULT 10`

## How It Works

### Points Calculation

```typescript
// Formula:
pointsEarned = Math.floor((orderTotal / 100) * pointsPerHundred)

// Examples (with default 10 points per ₹100):
₹250 order  → 25 points  (250 / 100 * 10 = 25)
₹500 order  → 50 points  (500 / 100 * 10 = 50)
₹1,000 order → 100 points (1000 / 100 * 10 = 100)
```

### Flow Diagram

```
1. Customer Orders Food
   ↓
2. Customer Provides Phone Number
   ↓
3. Order Created (status: pending)
   ↓
4. Order Completed (Payment Received)
   ↓
5. System Checks:
   - Is loyalty enabled? ✓
   - Does customer have phone? ✓
   - Is order total > 0? ✓
   ↓
6. Calculate Points
   points = (grand_total / 100) * points_per_100
   ↓
7. Update Customer Points
   customer.loyalty_points += pointsEarned
   ↓
8. Record Transaction
   INSERT INTO loyalty_transactions
   ↓
9. Customer Notified ✨
```

## Backend Implementation

### Files Created/Modified

1. **`backend/scripts/setup_loyalty_system.js`** (NEW)

    - Database setup script
    - Creates tables and columns
    - Adds indexes

2. **`backend/src/routes/setting.ts`** (UPDATED)

    - GET `/api/setting/settings` - Includes loyalty settings
    - POST `/api/setting/settings` - Saves loyalty settings
    - PUT `/api/setting/orders/:id/complete` - Awards points on completion

3. **`backend/src/routes/customer.ts`** (NEW)

    - GET `/api/customers/:id/loyalty` - Get customer points and history
    - GET `/api/customers/phone/:phone` - Get customer by phone

4. **`backend/src/routes/Index.ts`** (UPDATED)
    - Registered customer routes

### Key Backend Logic

**Order Completion with Points Award:**

```typescript
if (status === "completed" && order.customer_id) {
    const { loyalty_points_enabled, loyalty_points_per_100 } =
        await getSettings();

    if (loyalty_points_enabled) {
        const pointsEarned = Math.floor(
            (order.grand_total / 100) * loyalty_points_per_100
        );

        // Update customer
        await client.query(
            "UPDATE customers SET loyalty_points = loyalty_points + $1 WHERE id = $2",
            [pointsEarned, order.customer_id]
        );

        // Record transaction
        await client.query(
            "INSERT INTO loyalty_transactions (...) VALUES (...)",
            [
                customer_id,
                order_id,
                pointsEarned,
                "earned",
                description,
                order_amount,
            ]
        );
    }
}
```

## Frontend Implementation

### Files Created/Modified

1. **`frontend/src/pages/settings/LoyaltySettings.tsx`** (NEW)

    - UI for configuring loyalty points
    - Enable/disable toggle
    - Points per ₹100 configuration
    - Example calculations
    - Save functionality

2. **`frontend/src/pages/Settings.tsx`** (UPDATED)
    - Added "Loyalty Points" menu option
    - Route to LoyaltySettings component

### Settings UI

```
┌─────────────────────────────────────────────────────┐
│  🎁 Loyalty Points Settings                         │
├─────────────────────────────────────────────────────┤
│                                                      │
│  ℹ️ How Loyalty Points Work                         │
│  Customers with phone numbers automatically earn    │
│  loyalty points when they complete orders.          │
│                                                      │
│  ┌─────────────────────────────────────────────┐  │
│  │  Enable Loyalty Points              [ON ✓]  │  │
│  │  Turn on/off the loyalty system             │  │
│  └─────────────────────────────────────────────┘  │
│                                                      │
│  Points per ₹100 Spent *                            │
│  ┌─────────────────────────────────────────────┐  │
│  │  10                                          │  │
│  └─────────────────────────────────────────────┘  │
│  Customers earn 10 points for every ₹100 spent     │
│                                                      │
│  📊 Example Calculations                            │
│  Order Total: ₹250    → 25 points                  │
│  Order Total: ₹500    → 50 points                  │
│  Order Total: ₹1,000  → 100 points                 │
│                                                      │
│  [💾 Save Loyalty Settings]                         │
└─────────────────────────────────────────────────────┘
```

## API Endpoints

### Loyalty Settings

**GET** `/api/setting/settings`

```json
{
  "restaurant_name": "Zaki",
  "loyalty_points_enabled": true,
  "loyalty_points_per_100": 10,
  ...
}
```

**POST** `/api/setting/settings`

```json
{
  "loyalty_points_enabled": true,
  "loyalty_points_per_100": 15,
  ...
}
```

### Customer Loyalty

**GET** `/api/customers/:customerId/loyalty`

```json
{
    "customer": {
        "id": 1,
        "name": "John Doe",
        "mobile_number": "1234567890",
        "loyalty_points": 150
    },
    "transactions": [
        {
            "id": 1,
            "points_earned": 50,
            "transaction_type": "earned",
            "description": "Earned 50 points from order",
            "order_amount": "500.00",
            "created_at": "2025-10-18T10:30:00"
        }
    ]
}
```

**GET** `/api/customers/phone/:phone`

```json
{
    "id": 1,
    "name": "John Doe",
    "mobile_number": "1234567890",
    "loyalty_points": 150,
    "created_at": "2025-10-15T09:00:00"
}
```

## Usage Guide

### For Restaurant Owners

1. **Configure Loyalty System**:

    ```
    Settings → Loyalty Points
    - Enable: ✓ On
    - Points per ₹100: 10 (adjustable)
    - Click "Save Loyalty Settings"
    ```

2. **How Customers Earn Points**:

    - Customer places order with phone number
    - Order is completed (payment received)
    - Points automatically calculated and added
    - Customer can track their points

3. **Adjust Points Rate**:
    - Want more generous rewards? Set 15 or 20 points per ₹100
    - Want less rewards? Set 5 points per ₹100
    - Changes apply to future orders immediately

### For Staff

1. **Taking Orders with Loyalty**:

    - Ask customer for phone number
    - Enter phone number in order form
    - System automatically links to existing customer or creates new one
    - Complete order as normal
    - Points automatically awarded on payment

2. **Checking Customer Points**:
    - Use GET `/api/customers/phone/:phone` endpoint
    - Shows total points balance
    - Shows transaction history

## Database Setup

**Run the setup script:**

```bash
cd backend
node scripts/setup_loyalty_system.js
```

**Output:**

```
🎁 Setting up Loyalty Points System...

✅ Added loyalty_points to customers
✅ Added loyalty settings to restaurant_settings
✅ Created loyalty_transactions table
✅ Created indexes

📊 Current Configuration:
   Loyalty System: Enabled ✅
   Points per ₹100: 10
```

## Testing

### Test Scenario 1: Award Points

1. **Create Order with Customer**:

    ```
    - Customer: John (Phone: 1234567890)
    - Order Total: ₹500
    - Complete payment
    ```

2. **Check Points**:

    ```sql
    SELECT loyalty_points FROM customers WHERE mobile_number = '1234567890';
    -- Result: 50 points (500/100 * 10)
    ```

3. **Verify Transaction**:
    ```sql
    SELECT * FROM loyalty_transactions WHERE customer_id = 1;
    -- Shows: 50 points earned, order amount ₹500
    ```

### Test Scenario 2: Change Points Rate

1. **Go to Settings → Loyalty Points**
2. **Change**: Points per ₹100 from 10 to 20
3. **Save Settings**
4. **Create New Order**: ₹500
5. **Result**: Customer earns 100 points (500/100 \* 20)

### Test Scenario 3: Disable Loyalty

1. **Go to Settings → Loyalty Points**
2. **Toggle Off**: Enable Loyalty Points
3. **Save Settings**
4. **Create Order**: ₹500
5. **Result**: No points awarded

## Current Configuration

From your database:

```
Loyalty System: Enabled ✅
Points per ₹100: 10
Total Customers: 9
Customers with Points: 0 (no orders completed yet)
```

## Future Enhancements

Potential features to add:

-   ✨ Points redemption system
-   🎁 Rewards catalog (redeem X points for Y discount)
-   📱 Customer-facing points display
-   📊 Loyalty analytics dashboard
-   🏆 Tier system (bronze/silver/gold members)
-   📧 Points expiry system
-   💳 Points redemption at checkout
-   📈 Points multiplier promotions

## Technical Notes

-   Points are calculated using `Math.floor()` to avoid decimals
-   Minimum spend for points: ₹100 (below that, no points awarded)
-   Points only awarded on 'completed' orders
-   Orders with status 'cancelled' don't earn points
-   Points persist even if order is later modified
-   Transaction history provides complete audit trail
-   System is disabled-by-default safe (won't error if disabled)

## Support

If you encounter issues:

1. Check database logs
2. Verify settings are saved correctly
3. Ensure customer has valid phone number
4. Confirm order status is 'completed'
5. Check loyalty_transactions table for history
