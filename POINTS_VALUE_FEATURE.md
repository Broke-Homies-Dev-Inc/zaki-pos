# Points Value Configuration Feature

## Overview

Added configurable loyalty points value setting, allowing administrators to define how much each loyalty point is worth in currency.

## What Changed

### Database

**New Column:** `restaurant_settings.points_value`

-   **Type:** `DECIMAL(10, 2)`
-   **Default:** `0.1` (meaning 10 points = ₹1)
-   **Description:** Defines the monetary value of 1 loyalty point

### Backend (`backend/src/routes/setting.ts`)

#### 1. GET /api/setting/settings

Added `points_value` to response:

```typescript
SELECT ... points_value FROM restaurant_settings
```

**Default value:** `0.1`

#### 2. POST /api/setting/settings

Added `points_value` parameter for saving:

```typescript
const { ...points_value } = req.body;
// INSERT/UPDATE with points_value
```

#### 3. Order Completion (Redemption Logic)

Changed from hardcoded to dynamic:

```typescript
// OLD:
const pointsValue = pointsRedeemed / 10; // Hardcoded

// NEW:
const pointsValueAmount = pointsRedeemed * (parseFloat(points_value) || 0.1);
// Uses value from settings
```

### Frontend

#### 1. Loyalty Settings UI (`frontend/src/pages/settings/LoyaltySettings.tsx`)

**New Field Added:**

-   **Label:** "Value per Point (₹)"
-   **Type:** Number input
-   **Min:** 0.01
-   **Max:** 10
-   **Step:** 0.01
-   **Default:** 0.1

**Features:**

-   Helper text showing conversion (e.g., "10 points = ₹1")
-   Real-time calculation display
-   Disabled when loyalty system is off
-   Validation (must be positive)

**New Example Section:**
Added "Points Redemption Examples" showing:

-   200 points → ₹X discount
-   500 points → ₹X discount
-   1,000 points → ₹X discount

#### 2. Billing Modal (`frontend/src/components/TableBillingModal.tsx`)

Changed calculation to use dynamic rate:

```typescript
// OLD:
const pointsValue = pointsToRedeem / 10;

// NEW:
const pointValueRate = settings?.points_value || 0.1;
const pointsValue = pointsToRedeem * pointValueRate;
```

#### 3. Database Types (`frontend/src/lib/database.types.ts`)

Added `points_value` to restaurant_settings types:

```typescript
restaurant_settings: {
  Row: {
    ...
    points_value?: number
  }
}
```

## Usage

### Setting Points Value

1. Go to **Settings** → **Loyalty Points**
2. Find "Value per Point (₹)" field
3. Enter desired value (e.g., `0.1`, `0.5`, `1.0`)
4. Click **Save Loyalty Settings**

### Common Configurations

| Points Value | Meaning        | Example        |
| ------------ | -------------- | -------------- |
| 0.1          | 10 points = ₹1 | 200 pts = ₹20  |
| 0.2          | 5 points = ₹1  | 200 pts = ₹40  |
| 0.5          | 2 points = ₹1  | 200 pts = ₹100 |
| 1.0          | 1 point = ₹1   | 200 pts = ₹200 |

### Example Scenarios

#### Scenario 1: Standard Value (Default)

**Settings:**

-   Points per ₹100: 10
-   Value per point: ₹0.1

**Customer spends ₹500:**

-   Earns: 50 points
-   Can redeem 200 points for: ₹20 discount

#### Scenario 2: Higher Value

**Settings:**

-   Points per ₹100: 10
-   Value per point: ₹0.5

**Customer spends ₹500:**

-   Earns: 50 points
-   Can redeem 200 points for: ₹100 discount

#### Scenario 3: 1:1 Ratio

**Settings:**

-   Points per ₹100: 10
-   Value per point: ₹1.0

**Customer spends ₹500:**

-   Earns: 50 points
-   Can redeem 200 points for: ₹200 discount

## UI Preview

### Loyalty Settings Page

```
┌────────────────────────────────────────────┐
│ Loyalty Points Settings                    │
├────────────────────────────────────────────┤
│ ✅ Enable Loyalty Points                   │
├────────────────────────────────────────────┤
│ Points per ₹100 Spent *                    │
│ [ 10                                    ]  │
│ Customers will earn 10 points for every   │
│ ₹100 they spend                            │
├────────────────────────────────────────────┤
│ Value per Point (₹) *              [NEW]   │
│ [ 0.10                                  ]  │
│ Each loyalty point is worth ₹0.10         │
│ (10 points = ₹1)                           │
├────────────────────────────────────────────┤
│ Points Earning Examples                    │
│ Order Total: ₹250    → 25 points earned   │
│ Order Total: ₹500    → 50 points earned   │
│ Order Total: ₹1,000  → 100 points earned  │
├────────────────────────────────────────────┤
│ Points Redemption Examples         [NEW]   │
│ 200 points redeemed  → ₹20.00 discount    │
│ 500 points redeemed  → ₹50.00 discount    │
│ 1,000 points redeemed → ₹100.00 discount  │
└────────────────────────────────────────────┘
```

## Migration

### Running the Migration

```bash
cd backend
node run_migration_points_value.js
```

**Output:**

```
Running migration: add_points_value...
✅ Migration completed successfully!
   - Added column: points_value (default: 0.1)
   - Default means: 10 points = ₹1
```

### What It Does

1. Adds `points_value` column to `restaurant_settings` table
2. Sets default value to `0.1`
3. Updates any existing rows with NULL to `0.1`

### Rollback (if needed)

```sql
ALTER TABLE restaurant_settings DROP COLUMN IF EXISTS points_value;
```

## Impact on Existing Features

### Order Completion

✅ Now uses dynamic points_value from settings
✅ Backward compatible (defaults to 0.1 if not set)
✅ Existing transaction records remain unchanged

### Customer Billing

✅ Calculates discount using dynamic rate
✅ Shows correct discount amount in UI
✅ Maximum redemption calculated correctly

### Reports & Analytics

⚠️ Historical transactions used old rate (0.1)
⚠️ New transactions use current settings rate
📊 Consider this when analyzing redemption data over time

## Testing

### Test 1: Change Points Value

1. Go to Loyalty Settings
2. Change "Value per Point" to `0.5`
3. Save settings
4. Complete an order with 200 points redemption
5. Verify discount = ₹100 (was ₹20 before)

### Test 2: Verify Calculations

With `points_value = 0.2`:

-   200 points → ₹40 discount ✅
-   500 points → ₹100 discount ✅
-   Max points for ₹500 bill → 2,500 points ✅

### Test 3: Default Value

1. Create new restaurant_settings row
2. Check default value
3. Should be `0.1` ✅

## Files Modified

### Backend

-   ✅ `backend/src/routes/setting.ts` - Added points_value to GET/POST
-   ✅ `backend/src/routes/setting.ts` - Updated order completion logic
-   ✅ `backend/migrations/add_points_value.sql` - Database migration
-   ✅ `backend/run_migration_points_value.js` - Migration runner

### Frontend

-   ✅ `frontend/src/pages/settings/LoyaltySettings.tsx` - Added UI field
-   ✅ `frontend/src/components/TableBillingModal.tsx` - Dynamic calculation
-   ✅ `frontend/src/lib/database.types.ts` - Added type definition

### Documentation

-   ✅ `POINTS_VALUE_FEATURE.md` - This file

## Backward Compatibility

✅ **Fully backward compatible**

-   Default value `0.1` maintains existing behavior
-   Existing code works without changes
-   Historical data remains valid

## Future Enhancements

### Possible Improvements

1. **Per-customer tier pricing** - Different rates for VIP customers
2. **Time-based promotions** - Double points value on weekends
3. **Category multipliers** - Higher value for specific items
4. **Point expiration** - Points expire after X months
5. **Transaction history** - Show rate used for each transaction

---

**Implementation Date:** October 18, 2025  
**Status:** ✅ Complete and Ready for Production  
**Default Value:** 0.1 (10 points = ₹1)  
**Backward Compatible:** Yes
