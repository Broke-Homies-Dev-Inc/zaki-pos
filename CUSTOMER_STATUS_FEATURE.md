# Customer Status Feature Implementation

## Overview

Added a `status` field to the customers table to distinguish between verified and unverified customers. Only verified customers (those with phone numbers) are displayed in the Customers page.

## Changes Made

### 1. Database Migration ✅

**File:** `backend/scripts/add_customer_status.js`

-   Added `status` column to `customers` table (VARCHAR(20), default: 'unverified')
-   Automatically marked existing customers with phone numbers as 'verified'
-   Created index on `status` column for faster queries

**Migration Results:**

```
✅ Status Column Added
✅ 5 customers marked as 'verified' (have phone numbers)
✅ 4 customers remain 'unverified' (no phone numbers)
```

### 2. Backend Updates ✅

#### `backend/src/routes/customer.ts`

**GET `/api/customers`** - Now returns only verified customers:

```typescript
WHERE c.status = 'verified'
```

**Includes `status` field in responses:**

-   GET `/api/customers` - Returns all verified customers with status
-   GET `/api/customers/:customerId/loyalty` - Returns customer with status
-   GET `/api/customers/phone/:phone` - Returns customer with status

#### `backend/src/routes/order.ts`

**Order Creation Logic:**

```typescript
// With phone number → verified customer
if (order.mobile_number && order.mobile_number.trim()) {
  // Find existing customer or create new one
  // Mark as 'verified'
  INSERT INTO customers (name, mobile_number, status)
  VALUES (..., 'verified')

  // Update existing unverified customers to verified
  UPDATE customers SET status = 'verified' WHERE id = $1
}

// Without phone number → unverified customer (walk-in)
else {
  INSERT INTO customers (name, status)
  VALUES (..., 'unverified')
}
```

### 3. Frontend Updates ✅

#### `frontend/src/components/CreateOrderModal.tsx`

**Auto-fill Customer Name:**

-   Added `useEffect` hook that watches `mobileNumber` input
-   Debounced API call (400ms) to avoid excessive requests
-   Automatically fetches customer by phone: `GET /api/customers/phone/:phone`
-   If customer exists, auto-fills the `customerName` field

**User Experience:**

```
1. User types phone number: "9876543210"
2. After 400ms, system checks if customer exists
3. If found → Name auto-fills: "Priya Sharma"
4. User can proceed with order immediately
```

#### `frontend/src/pages/Customers.tsx`

**No changes needed** - Already uses `api.get('/customers')` which now returns only verified customers from backend.

## Customer Status Rules

### Verified Status

A customer is marked as **verified** when:

-   ✅ They provide a phone number during order creation
-   ✅ Their phone number is saved in the system
-   ✅ They can earn loyalty points (if enabled)
-   ✅ They appear in the Customers management page

### Unverified Status

A customer is marked as **unverified** when:

-   ❌ No phone number provided (walk-in customer)
-   ❌ Order created without contact information
-   ❌ Not eligible for loyalty points tracking
-   ❌ Hidden from Customers management page

## Database Schema

```sql
-- customers table
CREATE TABLE customers (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  mobile_number VARCHAR(20),
  loyalty_points INTEGER DEFAULT 0,
  status VARCHAR(20) DEFAULT 'unverified',  -- NEW FIELD
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_customers_status ON customers(status);
```

## Current Database State

**Customer Status Summary:**

-   **Verified:** 5 customers

    -   John Doe (9998887771)
    -   Priya Sharma (9876543210)
    -   Arjun Mehta (9823456789)
    -   Sangeeth R (7829978000)
    -   Test Customer Yesterday (1234567890)

-   **Unverified:** 4 customers
    -   SOMAN PP (no phone)
    -   Soman pp (no phone)
    -   Sangeeth R (no phone) - duplicates
    -   Walk-in customers

## Testing Checklist

### ✅ Backend Tests

-   [x] Migration script runs successfully
-   [x] Status column exists with correct default
-   [x] Existing customers with phones marked as verified
-   [x] API returns only verified customers
-   [x] Order creation marks customers correctly

### 🔄 Frontend Tests (Manual)

1. **Customers Page:**

    - [ ] Navigate to Customers page
    - [ ] Verify only 5 verified customers shown
    - [ ] No unverified customers displayed

2. **Create Order - Existing Customer:**

    - [ ] Click "Create Order"
    - [ ] Enter existing phone: `9876543210`
    - [ ] Name should auto-fill: "Priya Sharma"
    - [ ] Complete order
    - [ ] Customer remains verified

3. **Create Order - New Customer:**

    - [ ] Click "Create Order"
    - [ ] Enter new phone: `9999999999`
    - [ ] Enter name: "New Customer"
    - [ ] Complete order
    - [ ] Check Customers page - new customer appears (verified)

4. **Create Order - Walk-in:**
    - [ ] Click "Create Order"
    - [ ] Leave phone blank
    - [ ] Enter name: "Walk-in Guest"
    - [ ] Complete order
    - [ ] Check Customers page - customer NOT shown (unverified)

## API Endpoints

### GET `/api/customers`

Returns only verified customers.

**Response:**

```json
[
    {
        "id": 2,
        "name": "Priya Sharma",
        "mobile_number": "9876543210",
        "status": "verified",
        "loyalty_points": 0,
        "total_orders": "0",
        "total_spent": "0"
    }
]
```

### GET `/api/customers/phone/:phone`

Lookup customer by phone (used for auto-fill).

**Request:** `GET /api/customers/phone/9876543210`

**Response:**

```json
{
    "id": 2,
    "name": "Priya Sharma",
    "mobile_number": "9876543210",
    "status": "verified",
    "loyalty_points": 0,
    "created_at": "2025-10-15T09:00:00.000Z"
}
```

## How to Run Migration

If you need to run the migration again or on another environment:

```powershell
# From backend directory
cd D:\download\POS-demo1\POS-demo1\backend
node scripts/add_customer_status.js
```

**Expected Output:**

```
Adding customers.status column (if missing) and migrating values...
- Ensured customers.status column exists
- Marked customers with mobile_number as 'verified'
- Ensured index on customers.status
Customer status migration complete.
```

## Verification Script

Check current status distribution:

```powershell
node scripts/check_status_column.js
```

**Output:**

```
✅ Status Column Info:
[
  {
    column_name: 'status',
    data_type: 'character varying',
    column_default: "'unverified'::character varying"
  }
]

📊 Sample Customers:
  ID: 8, Name: Sangeeth R, Phone: 7829978000, Status: verified, Points: 51
  ID: 2, Name: Priya Sharma, Phone: 9876543210, Status: verified, Points: 0
  ...

📈 Customer Status Summary:
  verified: 5 customers
  unverified: 4 customers
```

## Next Steps

1. **Restart Backend Server:**

    ```powershell
    cd backend
    npm run dev
    ```

2. **Test Frontend:**

    - Open Customers page
    - Should now show 5 verified customers
    - Test auto-fill by creating order with existing phone

3. **Optional Enhancements:**
    - Add phone number normalization (strip spaces, country codes)
    - Add UI indicator when customer is auto-filled
    - Add admin panel to manually verify/unverify customers
    - Add customer search/filter by status

## Troubleshooting

**Issue: "column status does not exist"**

-   Solution: Run migration script `node scripts/add_customer_status.js`
-   Restart backend server

**Issue: No customers showing**

-   Check: Run `node scripts/check_status_column.js`
-   Verify customers have `status = 'verified'`
-   Check backend filter: `WHERE c.status = 'verified'`

**Issue: Auto-fill not working**

-   Check: Network tab in browser DevTools
-   Verify API call to `/api/customers/phone/:phone`
-   Check 400ms debounce timer
-   Ensure backend is running on port 4000

## Summary

✅ **Database:** Status column added and indexed  
✅ **Backend:** Only verified customers returned  
✅ **Frontend:** Auto-fill name when phone entered  
✅ **Migration:** Existing customers properly classified  
✅ **Testing:** 5 verified, 4 unverified customers

The system now properly tracks customer verification status and displays only verified customers (those with phone numbers) in the Customers management page!
