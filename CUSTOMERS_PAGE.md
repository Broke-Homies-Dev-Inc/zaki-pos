# Customers Management System

## Overview

A comprehensive customer management page that displays all customers, their loyalty points, transaction history, and detailed information.

## Features

✅ **Customer Database View** - Complete list of all customers  
✅ **Loyalty Points Display** - Show each customer's point balance  
✅ **Transaction History** - Detailed history of points earned/redeemed  
✅ **Customer Details Modal** - Click to view full customer information  
✅ **Summary Statistics** - Total customers, total points, active members  
✅ **Member Since Date** - Track customer registration dates  
✅ **Total Orders & Spending** - Track customer lifetime value (coming soon)

## Navigation

The Customers page is accessible from the main navigation sidebar:

```
📊 Dashboard
🛒 Orders
🍽️ Menu
📦 Inventory
💳 Billing
👥 Customers ← NEW
⚙️ Settings
```

## Page Layout

### Summary Cards (Top Section)

```
┌────────────────────────────────────────────────────────────┐
│  👥 Total Customers        🏆 Total Loyalty Points         │
│      25                        1,250                        │
│                                                              │
│  📈 With Loyalty Points                                     │
│      12                                                      │
└────────────────────────────────────────────────────────────┘
```

### Customers Table

| Customer      | Phone Number  | Loyalty Points | Member Since    | Actions      |
| ------------- | ------------- | -------------- | --------------- | ------------ |
| 👤 John Doe   | 📱 9876543210 | ⭐ 150 points  | 📅 Oct 15, 2025 | View Details |
| 👤 Jane Smith | 📱 9876543211 | ⭐ 75 points   | 📅 Oct 16, 2025 | View Details |

### Customer Details Modal

When clicking "View Details" on any customer:

```
┌──────────────────────────────────────────────────────────┐
│  John Doe                                        [×]      │
│  Customer Details & Loyalty History                      │
├──────────────────────────────────────────────────────────┤
│                                                           │
│  📱 Phone Number        │  📅 Member Since                │
│  9876543210             │  Oct 15, 2025                  │
│                                                           │
│  ╔═══════════════════════════════════════════════════╗  │
│  ║  🏆 Total Loyalty Points                          ║  │
│  ║     150                                           ║  │
│  ╚═══════════════════════════════════════════════════╝  │
│                                                           │
│  📜 Loyalty Transaction History                          │
│                                                           │
│  ┌─────────────────────────────────────────────────┐    │
│  │ 🟢 +50 points                    ₹500.00        │    │
│  │ Earned 50 points from order                     │    │
│  │ Oct 18, 2025, 10:30 AM                          │    │
│  └─────────────────────────────────────────────────┘    │
│                                                           │
│  ┌─────────────────────────────────────────────────┐    │
│  │ 🟢 +100 points                   ₹1,000.00      │    │
│  │ Earned 100 points from order                    │    │
│  │ Oct 17, 2025, 2:15 PM                           │    │
│  └─────────────────────────────────────────────────┘    │
│                                                           │
│  [ Close ]                                               │
└──────────────────────────────────────────────────────────┘
```

## Frontend Implementation

### File: `frontend/src/pages/Customers.tsx` (NEW)

**Key Components:**

1. **Customer List View**

    - Displays all customers in a table
    - Shows name, phone, loyalty points, member since date
    - Click any row to view details

2. **Summary Statistics**

    - Total customers count
    - Total loyalty points across all customers
    - Count of customers with points

3. **Customer Details Modal**
    - Full customer information
    - Loyalty points balance (highlighted)
    - Complete transaction history
    - Order amounts for each transaction
    - Timestamps for all activities

**State Management:**

```typescript
const [customers, setCustomers] = useState<Customer[]>([]);
const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
const [transactions, setTransactions] = useState<LoyaltyTransaction[]>([]);
const [showDetails, setShowDetails] = useState(false);
```

**Data Fetching:**

```typescript
// Fetch all customers
GET http://localhost:3000/api/customers

// Fetch customer loyalty details
GET http://localhost:3000/api/customers/:customerId/loyalty
```

### File: `frontend/src/App.tsx` (UPDATED)

**Added Route:**

```typescript
<Route path="customers" element={<Customers />} />
```

### File: `frontend/src/components/Layout.tsx` (UPDATED)

**Added Navigation Item:**

```typescript
{ name: "Customers", href: "/customers", icon: Users }
```

## Backend Implementation

### File: `backend/src/routes/customer.ts` (UPDATED)

**New Endpoint: GET All Customers**

```typescript
GET / api / customers;
```

**Response:**

```json
[
    {
        "id": 1,
        "name": "John Doe",
        "mobile_number": "9876543210",
        "loyalty_points": 150,
        "created_at": "2025-10-15T09:00:00.000Z",
        "total_orders": "3",
        "total_spent": "1500.00"
    }
]
```

**Query:**

```sql
SELECT
  c.id,
  c.name,
  c.mobile_number,
  c.loyalty_points,
  c.created_at,
  COUNT(DISTINCT o.id) as total_orders,
  COALESCE(SUM(o.grand_total), 0) as total_spent
FROM customers c
LEFT JOIN orders o ON c.id = o.customer_id
GROUP BY c.id, c.name, c.mobile_number, c.loyalty_points, c.created_at
ORDER BY c.created_at DESC
```

**Existing Endpoints (Already Implemented):**

1. **GET Customer Loyalty Details**

    ```typescript
    GET /api/customers/:customerId/loyalty
    ```

    Returns customer info + transaction history

2. **GET Customer by Phone**
    ```typescript
    GET /api/customers/phone/:phone
    ```
    Lookup customer by mobile number

## User Interface Features

### Visual Elements

1. **Customer Avatar**

    - Blue circular avatar with first letter of name
    - Professional appearance

2. **Icons**

    - 👤 Users - Navigation and headers
    - 📱 Phone - Phone numbers
    - 🏆 Award - Loyalty points
    - 📅 Calendar - Dates
    - 📈 TrendingUp - Statistics

3. **Color Coding**

    - Points Earned: Green (🟢)
    - Points Redeemed: Red (🔴)
    - Customer Avatar: Blue
    - Statistics Cards: Blue, Green, Purple

4. **Responsive Design**
    - Grid layout for summary cards
    - Scrollable table for customers
    - Modal overlay for details
    - Mobile-friendly (responsive)

### Empty States

**No Customers:**

```
┌──────────────────────────────────────┐
│          👥                           │
│     No customers found                │
│  Customers will appear here when     │
│  they place orders                   │
└──────────────────────────────────────┘
```

**No Transactions:**

```
┌──────────────────────────────────────┐
│          🏆                           │
│     No transactions yet               │
│  Points will appear here when        │
│  orders are completed                │
└──────────────────────────────────────┘
```

## Data Flow

```
1. User Opens Customers Page
   ↓
2. Frontend: GET /api/customers
   ↓
3. Backend: Query customers + aggregate orders
   ↓
4. Display: Table with all customers
   ↓
5. User Clicks "View Details"
   ↓
6. Frontend: GET /api/customers/:id/loyalty
   ↓
7. Backend: Query customer + loyalty_transactions
   ↓
8. Display: Modal with full details
```

## Use Cases

### 1. View All Customers

-   Navigate to Customers from sidebar
-   See complete customer list
-   View summary statistics at top

### 2. Check Customer Points

-   Look up customer in table
-   See loyalty points in "Loyalty Points" column
-   Gold star icon indicates points

### 3. View Customer History

-   Click "View Details" on any customer
-   See complete transaction history
-   View points earned per order
-   Check order amounts and dates

### 4. Track Customer Engagement

-   See "Member Since" dates
-   Count customers with loyalty points
-   Identify most active customers (highest points)

### 5. Customer Lookup by Phone

-   Use search functionality (future)
-   Click customer row for details
-   Backend supports phone lookup: `/api/customers/phone/:phone`

## Integration with Existing Systems

### Loyalty Points System

-   Displays points from loyalty system
-   Shows transaction history
-   Reflects real-time point balances

### Order System

-   Links customers to their orders
-   Shows total orders count
-   Shows total spending amount

### Settings

-   Respects loyalty_points_enabled setting
-   Uses configured points_per_100 rate
-   Displays based on global configuration

## Statistics Displayed

1. **Total Customers**

    - Count of all registered customers
    - Displayed in blue card

2. **Total Loyalty Points**

    - Sum of all customer points
    - Displayed in green card

3. **Customers with Points**

    - Count of customers with points > 0
    - Displayed in purple card

4. **Per Customer:**
    - Name
    - Phone number
    - Loyalty points balance
    - Member since date
    - Total orders (future)
    - Total spent (future)

## Technical Details

### TypeScript Interfaces

```typescript
interface Customer {
    id: number;
    name: string;
    mobile_number: string;
    loyalty_points: number;
    created_at: string;
    total_orders?: number;
    total_spent?: number;
}

interface LoyaltyTransaction {
    id: number;
    points_earned: number;
    points_redeemed: number;
    transaction_type: string;
    description: string;
    order_amount: string;
    created_at: string;
}
```

### Date Formatting

**Date Only:**

```typescript
formatDate("2025-10-15T09:00:00");
// Output: "Oct 15, 2025"
```

**Date & Time:**

```typescript
formatDateTime("2025-10-18T10:30:00");
// Output: "Oct 18, 2025, 10:30 AM"
```

### Loading States

-   Shows "Loading customers..." while fetching
-   Displays spinner or loading text
-   Empty state when no customers exist

## Security Considerations

-   No customer deletion from UI (data integrity)
-   View-only access to customer data
-   Phone numbers displayed (authorized staff only)
-   Transaction history is read-only

## Future Enhancements

Potential additions:

-   📊 Customer analytics dashboard
-   🔍 Search and filter customers
-   📧 Email customers (if email added)
-   💬 Customer notes/comments
-   🎁 Manual point adjustments (admin only)
-   📱 SMS notifications
-   📈 Customer lifetime value charts
-   🏆 Customer loyalty tiers
-   📥 Export customer list to CSV
-   📞 Click-to-call phone numbers

## Testing Checklist

-   [ ] View all customers page
-   [ ] See summary statistics update
-   [ ] Click customer row to open details
-   [ ] View customer information in modal
-   [ ] Check loyalty points balance
-   [ ] View transaction history
-   [ ] Close modal
-   [ ] Empty state when no customers
-   [ ] Empty state when no transactions
-   [ ] Responsive design on mobile
-   [ ] Navigate from sidebar

## Navigation Path

```
Sidebar → Customers → [Customer List]
                         ↓
                    Click Customer
                         ↓
                    [Details Modal]
```

## Summary

The Customers page provides a complete view of your customer database with:

-   ✅ Clean, professional UI
-   ✅ Quick access to customer info
-   ✅ Loyalty points tracking
-   ✅ Transaction history
-   ✅ Summary statistics
-   ✅ Easy navigation
-   ✅ Mobile responsive
-   ✅ Fast loading

Perfect for managing customer relationships and tracking loyalty program success! 🎉
