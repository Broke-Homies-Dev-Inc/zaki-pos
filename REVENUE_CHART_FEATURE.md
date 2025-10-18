# Revenue Chart Feature Documentation

## Overview

A comprehensive revenue analytics chart has been added to the Dashboard that allows users to visualize revenue and order trends over time with flexible date range options.

## Features

### 1. Multiple Time Period Views

-   **Weekly View**: Shows data for the last 7 days
-   **Monthly View**: Shows data for the last 30 days
-   **Custom Range**: Allows users to select any specific date range

### 2. Interactive Chart

-   Dual-line chart showing both revenue and orders
-   Hover tooltips displaying exact values
-   Responsive design that adapts to screen size
-   Color-coded lines:
    -   **Blue**: Revenue (₹)
    -   **Orange**: Number of Orders

### 3. Summary Statistics

Three summary cards displaying:

-   **Total Revenue**: Sum of all revenue in the selected period
-   **Total Orders**: Count of all orders in the selected period
-   **Avg Daily Revenue**: Average revenue per day

### 4. Custom Date Range Selector

-   Start date and end date pickers
-   Validation to ensure end date is after start date
-   Apply button to fetch data for custom range
-   Clear visual indicator showing the selected date range

## Technical Implementation

### Backend Changes

#### New Endpoint: `/api/dashboard/revenue-chart`

**File**: `backend/src/routes/dashboard.ts`

**Query Parameters**:

-   `period`: `'weekly'` | `'monthly'` | `'custom'`
-   `startDate`: ISO date string (required for custom period)
-   `endDate`: ISO date string (required for custom period)

**Response Format**:

```json
[
    {
        "date": "Jan 1",
        "revenue": 15000,
        "orders": 45
    },
    {
        "date": "Jan 2",
        "revenue": 18500,
        "orders": 52
    }
]
```

**SQL Queries**:

-   Weekly: `NOW() - INTERVAL '7 days'`
-   Monthly: `NOW() - INTERVAL '30 days'`
-   Custom: Uses provided start and end dates
-   Excludes cancelled orders
-   Groups data by date
-   Orders results chronologically

### Frontend Changes

#### New Components

**1. RevenueChart Component**
**File**: `frontend/src/components/RevenueChart.tsx`

Main chart component featuring:

-   Period selector buttons (Weekly/Monthly/Custom)
-   Custom date range picker
-   Summary statistics cards
-   Recharts LineChart with dual Y-axes
-   Custom tooltip formatting
-   Loading and error states

**Props**: None (self-contained)

**2. useRevenueChart Hook**
**File**: `frontend/src/hooks/useRevenueChart.ts`

Custom React hook for fetching chart data:

```typescript
interface UseRevenueChartProps {
  period: ChartPeriod;
  startDate?: Date | null;
  endDate?: Date | null;
}

// Returns:
{
  data: RevenueChartData[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}
```

**3. Dashboard Integration**
**File**: `frontend/src/pages/Dashboard.tsx`

Added RevenueChart below the stat cards:

```tsx
<div className="mt-8">
    <RevenueChart />
</div>
```

### Dependencies

**New Package**: `recharts` (v2.x)

-   Powerful React charting library
-   Built on D3.js
-   Fully responsive
-   Extensive customization options

**Installation**:

```bash
cd frontend
npm install recharts
```

## Usage Guide

### Viewing Revenue Trends

#### Weekly View (Default)

1. Navigate to Dashboard
2. Chart automatically loads showing last 7 days
3. Hover over data points to see exact values

#### Monthly View

1. Click "Monthly" button in the chart header
2. Chart updates to show last 30 days
3. Y-axis automatically scales to fit data

#### Custom Date Range

1. Click "Custom" button (calendar icon)
2. Date picker appears below period buttons
3. Select start date
4. Select end date (must be after start date)
5. Click "Apply" button
6. Chart updates with data for selected range

### Understanding the Chart

#### Lines

-   **Blue Line**: Revenue trend (measured in ₹)
-   **Orange Line**: Order count trend

#### Y-Axis

-   Left axis: Revenue formatted as ₹Xk (thousands)
-   Right axis: Order count (whole numbers)

#### X-Axis

-   Date labels formatted as "Mon DD" (e.g., "Jan 15")
-   Automatically adjusts spacing based on data points

#### Tooltip

Hover over any point to see:

-   Exact date
-   Revenue amount (formatted with ₹ symbol)
-   Number of orders

### Summary Cards

#### Total Revenue

-   Sum of all order revenue in the period
-   Formatted with ₹ symbol and proper thousands separators
-   Excludes cancelled orders

#### Total Orders

-   Count of all orders in the period
-   Whole number
-   Excludes cancelled orders

#### Avg Daily Revenue

-   Calculated as: Total Revenue ÷ Number of Days
-   Helps identify daily performance trends
-   Useful for projecting future revenue

## Examples

### Example 1: Weekly Analysis

```
Period: Weekly (Last 7 days)
Total Revenue: ₹45,000
Total Orders: 120
Avg Daily Revenue: ₹6,428.57

Chart shows steady growth with peak on Saturday
```

### Example 2: Monthly Comparison

```
Period: Monthly (Last 30 days)
Total Revenue: ₹1,85,000
Total Orders: 480
Avg Daily Revenue: ₹6,166.67

Chart shows increased orders during weekends
Revenue spike on holidays
```

### Example 3: Custom Festival Period

```
Period: Custom (Oct 1 - Oct 10)
Start Date: October 1, 2025
End Date: October 10, 2025
Total Revenue: ₹75,000
Total Orders: 200
Avg Daily Revenue: ₹7,500

Analysis: Festival period shows 20% higher daily revenue
```

## API Examples

### Weekly Data

```bash
GET /api/dashboard/revenue-chart?period=weekly
```

### Monthly Data

```bash
GET /api/dashboard/revenue-chart?period=monthly
```

### Custom Range

```bash
GET /api/dashboard/revenue-chart?period=custom&startDate=2025-01-01T00:00:00.000Z&endDate=2025-01-31T23:59:59.999Z
```

## Responsive Design

### Desktop (1200px+)

-   Full-width chart with 400px height
-   All three summary cards visible in row
-   Date picker inputs side by side

### Tablet (768px - 1199px)

-   Chart scales to container width
-   Summary cards stack in column
-   Date picker remains side by side

### Mobile (<768px)

-   Chart maintains aspect ratio
-   Summary cards stack vertically
-   Date picker stacks vertically
-   Period buttons remain horizontal

## Performance Considerations

### Data Fetching

-   Debounced API calls when changing dates
-   Automatic refetch on period change
-   Error handling with user-friendly messages
-   Loading states for better UX

### Optimization

-   Data aggregated by date on backend
-   Efficient PostgreSQL queries with indexes
-   Limited to 30 days for monthly view
-   Custom ranges validated before query

## Troubleshooting

### Chart Not Displaying

**Issue**: Chart shows "Loading..." indefinitely

**Solutions**:

1. Check backend is running at `http://localhost:4000`
2. Verify database connection
3. Check browser console for errors
4. Verify `/api/dashboard/revenue-chart` endpoint responds

### No Data Available

**Issue**: Chart shows "No data available for this period"

**Causes**:

-   No orders in database for selected period
-   All orders are cancelled
-   Date range is in the future

**Solutions**:

1. Create test orders in the system
2. Select a different date range
3. Verify order data exists in database

### Custom Range Not Working

**Issue**: Apply button disabled or no data loads

**Solutions**:

1. Ensure both start and end dates are selected
2. Verify end date is after start date
3. Check dates are not in the future
4. Review browser console for validation errors

### Incorrect Values

**Issue**: Revenue/order counts don't match expectations

**Solutions**:

1. Verify order status is not 'cancelled'
2. Check date timezone settings
3. Review grand_total calculations
4. Ensure database data is correct

## Future Enhancements

Potential improvements for future versions:

1. **Export Functionality**

    - Download chart as PNG
    - Export data as CSV/Excel
    - Print-friendly view

2. **Additional Metrics**

    - Average order value
    - Customer acquisition
    - Revenue by order type
    - Profit margins

3. **Comparison Views**

    - Year-over-year comparison
    - Month-over-month comparison
    - Compare multiple date ranges

4. **Predictive Analytics**

    - Revenue forecasting
    - Trend analysis
    - Anomaly detection

5. **Advanced Filters**

    - Filter by order type (dine-in, takeout, delivery)
    - Filter by payment method
    - Filter by specific menu items
    - Filter by customer segments

6. **Interactive Features**
    - Click to drill down into specific days
    - Zoom functionality
    - Pan across dates
    - Multiple chart types (bar, area, pie)

## Testing Checklist

### Basic Functionality

-   [ ] Weekly view loads correctly
-   [ ] Monthly view loads correctly
-   [ ] Custom range selector appears
-   [ ] Date pickers work properly
-   [ ] Apply button functions correctly
-   [ ] Summary cards show correct totals
-   [ ] Chart renders with proper colors

### Edge Cases

-   [ ] No data handling
-   [ ] Single day of data
-   [ ] Zero revenue days
-   [ ] Very high revenue values
-   [ ] Many days (>100) of data
-   [ ] Invalid date ranges

### Responsive Design

-   [ ] Works on desktop (1920x1080)
-   [ ] Works on tablet (768x1024)
-   [ ] Works on mobile (375x667)
-   [ ] Chart remains readable at all sizes
-   [ ] Buttons don't overlap

### Error Handling

-   [ ] Backend offline handling
-   [ ] Network error handling
-   [ ] Invalid data format handling
-   [ ] Timeout handling

## Database Schema

### Required Table: `orders`

```sql
CREATE TABLE orders (
  id SERIAL PRIMARY KEY,
  grand_total DECIMAL(10, 2) NOT NULL,
  status VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  -- other columns...
);
```

### Recommended Index

```sql
CREATE INDEX idx_orders_created_at_status
ON orders(created_at, status);
```

## Security Considerations

### Backend

-   No user input in SQL queries (parameterized)
-   Date validation before query execution
-   Rate limiting recommended for API endpoint
-   CORS configured properly

### Frontend

-   Date inputs sanitized before API call
-   Error messages don't expose sensitive data
-   API endpoints use relative URLs

## Maintenance

### Regular Tasks

1. Monitor query performance
2. Review error logs
3. Optimize database indexes if needed
4. Update dependencies (especially recharts)

### Database Maintenance

1. Ensure `created_at` indexes are optimized
2. Consider partitioning for large datasets
3. Archive old order data if performance degrades

## Summary

The Revenue Chart feature provides powerful visual analytics for restaurant revenue tracking. It offers flexible date range selection, clear visualizations, and summary statistics to help restaurant owners make data-driven decisions.

**Key Benefits**:

-   📊 Visual trend analysis
-   📅 Flexible date ranges
-   📈 Real-time data updates
-   📱 Mobile responsive
-   💡 Actionable insights

**Status**: ✅ Fully Implemented and Ready to Use
