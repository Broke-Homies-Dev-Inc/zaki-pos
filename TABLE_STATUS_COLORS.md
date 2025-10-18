# Table Status Color Scheme

## Color Coding

The POS system uses a color-coded system for table statuses:

| Status           | Color                    | Description           | When Applied                              |
| ---------------- | ------------------------ | --------------------- | ----------------------------------------- |
| **Available**    | Gray (`bg-gray-200`)     | No active order       | When table has no linked order            |
| **Occupied**     | Yellow (`bg-yellow-300`) | Order created         | When order is created and linked to table |
| **Bill Printed** | Blue (`bg-blue-300`)     | Bill has been printed | When "Print Bill" button is clicked       |
| **Paid**         | Green (`bg-green-300`)   | Payment completed     | When "Complete Payment" is confirmed      |

## Status Flow

```
┌─────────────┐
│  AVAILABLE  │ (Gray)
│  No Order   │
└──────┬──────┘
       │
       │ Create Order (Dine-In)
       │
       ▼
┌─────────────┐
│  OCCUPIED   │ (Yellow)
│ Order Active│
└──────┬──────┘
       │
       │ Print Bill
       │
       ▼
┌──────────────┐
│ BILL PRINTED │ (Blue)
│   Awaiting   │
│   Payment    │
└──────┬───────┘
       │
       │ Complete Payment
       │
       ▼
┌─────────────┐
│    PAID     │ (Green)
│  Completed  │
└─────────────┘
       │
       │ Reset Table
       │
       ▼
┌─────────────┐
│  AVAILABLE  │ (Gray)
└─────────────┘
```

## Implementation Details

### Backend Status Updates

1. **Create Order** (`POST /api/orders`)

    ```typescript
    // Sets table status to 'occupied'
    UPDATE restaurant_tables SET status = 'occupied' WHERE id = $1
    ```

2. **Print Bill** (`PUT /api/setting/tables/:id/status`)

    ```typescript
    // Sets table status to 'bill_printed'
    UPDATE restaurant_tables SET status = 'bill_printed', updated_at = NOW()
    ```

3. **Complete Payment** (`PUT /api/setting/orders/:orderId/complete`)
    ```typescript
    // Sets order status to 'completed' and table status to 'paid'
    UPDATE orders SET status = 'completed'
    UPDATE restaurant_tables SET status = 'paid'
    ```

### Frontend Display

File: `frontend/src/components/TableCard.tsx`

```typescript
const getTableColorClass = (tableStatus: string) => {
    switch (tableStatus) {
        case "occupied":
            return "bg-yellow-300 hover:bg-yellow-400";
        case "bill_printed":
            return "bg-blue-300 hover:bg-blue-400";
        case "paid":
            return "bg-green-300 hover:bg-green-400";
        case "available":
        default:
            return "bg-gray-200 hover:bg-gray-300 border border-gray-300";
    }
};
```

## Visual Reference

From the Billing page header:

```
Status:  □ Available  ■ Occupied  ■ Bill Printed  ■ Paid
       (Gray)      (Yellow)    (Blue)        (Green)
```

## Key Points

-   Colors update automatically when status changes
-   Table status is stored in `restaurant_tables.status` column
-   Status changes trigger visual updates on the Billing page
-   The billing page polls every 5 seconds to refresh table statuses
-   Quick print button automatically sets status to 'bill_printed'

## Database Schema

```sql
-- restaurant_tables table
CREATE TABLE restaurant_tables (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50),
    section_id INTEGER,
    status VARCHAR(20) DEFAULT 'available',
    -- Values: 'available', 'occupied', 'bill_printed', 'paid'
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```
