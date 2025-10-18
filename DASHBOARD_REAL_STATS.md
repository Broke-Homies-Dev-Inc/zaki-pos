# Real-Time Dashboard Statistics Implementation

## Overview

The Dashboard now displays **real statistics** from your database instead of dummy/static data. The data auto-refreshes every 30 seconds.

## What Changed

### Backend - New Dashboard API

**File**: `backend/src/routes/dashboard.ts` (NEW)

**Endpoint**: `GET /api/dashboard`

**Returns**:

```json
{
    "todayRevenue": 1960.5,
    "revenueChange": "+0.0% from yesterday",
    "todayOrders": 5,
    "ordersChange": "+0.0% from yesterday",
    "newCustomers": 8,
    "customersThisHour": 2,
    "pendingOrders": 2
}
```

### Statistics Calculated

1. **Today's Revenue**

    - Sum of all `grand_total` from orders created today
    - Excludes cancelled orders
    - Shows percentage change vs yesterday

2. **Today's Orders**

    - Count of orders created today
    - Excludes cancelled orders
    - Shows percentage change vs yesterday

3. **New Customers**

    - Count of customers created today
    - Shows count from the last hour

4. **Pending Orders**
    - Count of orders with status = 'pending'
    - Shows if load is higher than usual

### Frontend Updates

**File**: `frontend/src/hooks/useDashboard.ts` (NEW)

-   Custom hook to fetch dashboard statistics
-   Auto-refreshes every 30 seconds
-   Handles loading and error states

**File**: `frontend/src/pages/Dashboard.tsx` (UPDATED)

-   Removed static/dummy data
-   Now uses `useDashboard()` hook
-   Displays real-time statistics
-   Shows loading state while fetching
-   Formats currency using `formatCurrency()` utility

### Routes Updated

**File**: `backend/src/routes/Index.ts`

-   Added dashboard routes: `router.use('/dashboard', dashboardRoutes)`

## Current Statistics (From Your Database)

Based on the test run:

```
Today's Revenue:     ₹1,960.50 (+0.0% from yesterday)
Today's Orders:      5
New Customers:       8 (2 this hour)
Pending Orders:      2
```

## Features

✅ **Real-time data**: Fetched directly from PostgreSQL database  
✅ **Auto-refresh**: Updates every 30 seconds automatically  
✅ **Comparative metrics**: Shows percentage changes from yesterday  
✅ **Loading states**: Displays loading spinner while fetching  
✅ **Error handling**: Shows error message if API fails  
✅ **Formatted currency**: Uses proper currency formatting  
✅ **Time-based filters**: Correctly calculates today vs yesterday

## How It Works

### Data Flow

```
Dashboard Component
        ↓
   useDashboard Hook
        ↓
GET /api/dashboard
        ↓
PostgreSQL Queries
        ↓
Real Statistics
        ↓
Display on Dashboard
```

### Auto-Refresh Logic

```typescript
useEffect(() => {
    fetchStats();

    // Refresh every 30 seconds
    const interval = setInterval(fetchStats, 30000);

    return () => clearInterval(interval);
}, []);
```

## Testing

1. **Backend Test**:

    ```bash
    cd backend
    node scripts/test_dashboard.js
    ```

    Shows real statistics from database

2. **API Test**:

    ```bash
    # Start backend server
    npm run dev

    # In browser or Postman
    GET http://localhost:4000/api/dashboard
    ```

3. **Frontend Test**:
    - Start frontend: `npm run dev`
    - Navigate to Dashboard
    - Verify statistics match database
    - Wait 30 seconds to see auto-refresh

## Database Queries Used

### Today's Revenue

```sql
SELECT COALESCE(SUM(grand_total), 0) as revenue
FROM orders
WHERE created_at >= TODAY
  AND created_at < TOMORROW
  AND status != 'cancelled'
```

### Today's Orders Count

```sql
SELECT COUNT(*) as count
FROM orders
WHERE created_at >= TODAY
  AND created_at < TOMORROW
  AND status != 'cancelled'
```

### New Customers Today

```sql
SELECT COUNT(*) as count
FROM customers
WHERE created_at >= TODAY
  AND created_at < TOMORROW
```

### Pending Orders

```sql
SELECT COUNT(*) as count
FROM orders
WHERE status = 'pending'
```

## Benefits

1. **Accurate Insights**: See real business performance
2. **Live Updates**: No need to refresh page manually
3. **Historical Comparison**: Compare today vs yesterday
4. **Business Intelligence**: Make informed decisions
5. **Performance Tracking**: Monitor order volume and revenue

## Future Enhancements

Potential additions:

-   Weekly/monthly revenue trends
-   Top-selling menu items
-   Peak hours analysis
-   Customer retention metrics
-   Average order value
-   Revenue by order type (dine-in, takeaway, delivery)

## Notes

-   Statistics update every 30 seconds automatically
-   All times are based on server timezone
-   Cancelled orders are excluded from revenue/order counts
-   Currency formatting uses the `formatCurrency` utility from `lib/utils.ts`
-   The dashboard gracefully handles cases with no data (shows 0 or empty states)
