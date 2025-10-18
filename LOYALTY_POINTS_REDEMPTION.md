# Loyalty Points Redemption System

## Overview

Implemented a comprehensive loyalty points redemption system that allows customers with 200+ loyalty points to redeem them during payment, reducing their bill amount.

## Features Implemented

### 1. **Frontend - TableBillingModal.tsx**

#### Redemption Rules:

-   **Minimum Points:** 200 points required to redeem
-   **Conversion Rate:** 10 points = ₹1
-   **Maximum Redemption:** Cannot redeem more than the bill amount

#### UI Components:

✅ **Loyalty Points Display**

-   Shows customer's current loyalty points balance
-   Beautiful gradient card with purple/pink theme
-   Gift icon indicator

✅ **Redemption Controls**

-   Checkbox to enable/disable points redemption
-   Slider control to select points amount (200 to max available)
-   Number input for precise point selection
-   Real-time calculation display

✅ **Visual Feedback**

-   Shows points being redeemed
-   Displays monetary value (₹)
-   Shows remaining points after redemption
-   Green discount badge
-   Updated "Amount to Pay" with final amount

✅ **Payment Button**

-   Dynamically shows final amount if using points
-   Loading state during processing
-   Disabled when already paid

### 2. **Backend - setting.ts**

#### Order Completion Logic:

```typescript
PUT /setting/orders/:orderId/complete
```

**Request Body:**

```json
{
    "tableId": "string",
    "status": "completed",
    "pointsRedeemed": 0,
    "finalAmount": 535.5
}
```

**Processing Flow:**

1. **Redemption Phase:**

    - Validates customer has sufficient points (≥ pointsRedeemed)
    - Validates minimum redemption (≥ 200 points)
    - Deducts redeemed points from customer balance
    - Records redemption transaction in loyalty_transactions table
    - Calculates discount: pointsRedeemed / 10 = ₹discount

2. **Earning Phase:**

    - Calculates points earned based on **final amount paid** (not original bill)
    - Formula: `(finalAmount / 100) * loyalty_points_per_100`
    - Adds earned points to customer balance
    - Records earning transaction in loyalty_transactions table

3. **Table Status:**
    - Updates restaurant table status to 'paid'
    - Clears active order from table

## Usage Example

### Scenario:

-   **Bill Amount:** ₹535.50
-   **Customer Points:** 450
-   **Customer Redeems:** 300 points

### Calculation:

```
Points Redeemed: 300 points
Discount: 300 ÷ 10 = ₹30.00
Amount to Pay: ₹535.50 - ₹30.00 = ₹505.50

Points Earned: (505.50 ÷ 100) × 10 = 50 points (assuming 10 pts per ₹100)

Final Customer Balance:
  Starting: 450 points
  - Redeemed: 300 points
  + Earned: 50 points
  = Final: 200 points
```

## Database Transactions

### loyalty_transactions Table

Records both redemption and earning:

**Redemption Record:**

```sql
INSERT INTO loyalty_transactions (
  customer_id,
  order_id,
  points_redeemed,
  transaction_type,
  description,
  order_amount
)
VALUES (
  'customer_123',
  'order_456',
  300,
  'redeemed',
  'Redeemed 300 points (₹30.00) for order',
  535.50
)
```

**Earning Record:**

```sql
INSERT INTO loyalty_transactions (
  customer_id,
  order_id,
  points_earned,
  transaction_type,
  description,
  order_amount
)
VALUES (
  'customer_123',
  'order_456',
  50,
  'earned',
  'Earned 50 points from order (paid: ₹505.50)',
  505.50
)
```

## User Flow

### Step 1: Open Billing Modal

-   Navigate to **Billing** page
-   Click on occupied table

### Step 2: View Loyalty Points

-   If customer has an order with phone number
-   Loyalty points section appears automatically
-   Shows current points balance

### Step 3: Redeem Points (if eligible)

-   Customer must have ≥ 200 points
-   Check "Redeem Points" checkbox
-   Adjust slider or enter exact points amount
-   See real-time discount calculation

### Step 4: Complete Payment

-   Review final amount to pay
-   Click "Complete Payment"
-   Confirm in dialog (shows redemption details)
-   Success message displays:
    -   Points redeemed
    -   Amount paid
    -   Remaining points balance

## Validation & Security

✅ **Frontend Validation:**

-   Minimum 200 points to enable redemption
-   Maximum redemption = min(customer points, bill amount × 10)
-   Real-time calculation updates

✅ **Backend Validation:**

-   Verifies customer has sufficient points
-   Enforces minimum redemption (200 points)
-   Transaction rollback on any error
-   Atomic operations with BEGIN/COMMIT

## Benefits

### For Customers:

-   **Immediate Savings:** Reduce bill amount with loyalty points
-   **Flexible Redemption:** Choose how many points to use
-   **Continued Earning:** Earn points on the amount paid
-   **Transparency:** Clear breakdown of redemption and earnings

### For Business:

-   **Customer Retention:** Incentivizes repeat visits
-   **Data Tracking:** Complete transaction history
-   **Customizable Rates:** Adjust earning rates in settings
-   **Fair System:** Prevents over-redemption

## Configuration

### Settings Location:

**Settings → Loyalty Settings**

-   Enable/Disable loyalty points system
-   Set earning rate (points per ₹100)
-   Redemption rate is fixed: 10 points = ₹1

## Testing Checklist

-   [ ] Customer with < 200 points sees message (can't redeem)
-   [ ] Customer with ≥ 200 points can enable redemption
-   [ ] Slider range: 200 to max available
-   [ ] Discount calculation is correct (points ÷ 10)
-   [ ] Final amount = bill - discount
-   [ ] Payment confirmation shows correct details
-   [ ] Points deducted from customer balance
-   [ ] New points earned based on final amount
-   [ ] Loyalty transactions recorded correctly
-   [ ] Table status updated to 'paid'

## Future Enhancements

-   [ ] Loyalty points history view for customers
-   [ ] Email/SMS receipt with redemption details
-   [ ] Points expiration policy
-   [ ] Tiered rewards (Bronze, Silver, Gold)
-   [ ] Special redemption offers
-   [ ] Points gifting between customers

---

**Implementation Date:** October 18, 2025
**Status:** ✅ Complete and Ready for Testing
