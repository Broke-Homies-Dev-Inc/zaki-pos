# Revenue Chart - Quick Testing Guide

## Prerequisites

✅ Backend running at http://localhost:4000
✅ Frontend running (npm run dev)
✅ Database has some order data

## Quick Start

### 1. Navigate to Dashboard

Open your browser and go to the Dashboard page.

### 2. View Weekly Revenue

The chart automatically loads showing the **last 7 days** of revenue and orders.

**What to expect**:

-   Blue line showing revenue trend
-   Orange line showing order count trend
-   Three summary cards at the top showing:
    -   Total Revenue
    -   Total Orders
    -   Average Daily Revenue

### 3. Switch to Monthly View

Click the **"Monthly"** button in the chart header.

**What changes**:

-   Chart updates to show last 30 days
-   Summary cards recalculate for 30-day period
-   Y-axis scales to accommodate more data points

### 4. Try Custom Date Range

1. Click the **"Custom"** button (has a calendar icon)
2. Date picker appears below the buttons
3. Select a **Start Date** (e.g., October 1, 2025)
4. Select an **End Date** (e.g., October 10, 2025)
5. Click **"Apply"**

**What happens**:

-   Chart loads data for your selected range
-   Summary cards show totals for that specific period
-   A note appears showing the selected date range

### 5. Interact with the Chart

**Hover** over any point on the chart to see:

-   Exact date
-   Revenue amount (₹)
-   Number of orders for that day

## Visual Walkthrough

### Period Buttons

```
┌──────────┬──────────┬────────────┐
│  Weekly  │ Monthly  │ 📅 Custom  │
└──────────┴──────────┴────────────┘
```

-   **Blue button** = Currently selected period
-   **Gray buttons** = Other available periods

### Custom Date Picker

```
┌─────────────────────────────────────────┐
│  Start Date: [Oct 1, 2025]              │
│  End Date:   [Oct 31, 2025]             │
│  [Apply]                                 │
│  Showing data from 10/1/25 to 10/31/25  │
└─────────────────────────────────────────┘
```

### Summary Cards

```
┌──────────────────┬──────────────────┬──────────────────┐
│ Total Revenue    │ Total Orders     │ Avg Daily Revenue│
│ ₹45,000          │ 120              │ ₹6,428           │
└──────────────────┴──────────────────┴──────────────────┘
```

### The Chart

```
Revenue (₹)
    ↑
20k |                              ● (Blue)
    |                         ●  /
15k |                   ●   /
    |             ●   /
10k |       ●   /
    |  ●  /
 5k | /
    └────────────────────────────────────→ Date
     Mon  Tue  Wed  Thu  Fri  Sat  Sun

    ● = Revenue
    ○ = Orders (Orange line)
```

## Test Scenarios

### Test 1: Weekly View (Default)

**Steps**:

1. Open Dashboard
2. Chart loads automatically

**Expected**:

-   Shows last 7 days
-   Both lines visible
-   Summary cards populated
-   No errors in console

### Test 2: Switch to Monthly

**Steps**:

1. Click "Monthly" button
2. Wait for chart to update

**Expected**:

-   Chart shows 30 days
-   More data points on X-axis
-   Summary cards update
-   Button turns blue

### Test 3: Custom Range - Last Week

**Steps**:

1. Click "Custom" button
2. Select start: 7 days ago
3. Select end: today
4. Click "Apply"

**Expected**:

-   Chart shows same data as Weekly view
-   Date range note appears
-   Summary matches weekly totals

### Test 4: Custom Range - Specific Month

**Steps**:

1. Click "Custom" button
2. Select start: September 1
3. Select end: September 30
4. Click "Apply"

**Expected**:

-   Chart shows September data
-   Summary cards show September totals
-   No data if no orders in September

### Test 5: Hover Tooltips

**Steps**:

1. Load any chart view
2. Move mouse over chart lines
3. Hover over different points

**Expected**:

-   White tooltip box appears
-   Shows exact date
-   Shows revenue value
-   Shows order count

### Test 6: Mobile View

**Steps**:

1. Open Developer Tools (F12)
2. Toggle device toolbar
3. Select mobile device (e.g., iPhone)

**Expected**:

-   Chart scales to fit
-   Summary cards stack vertically
-   Period buttons remain usable
-   Date picker stacks vertically

## Common Test Data

### Sample Orders for Testing

If you need test data, create orders with these dates:

```javascript
// Today
const today = new Date();

// This week
const dates = [
    "Oct 12, 2025", // ₹5,000, 15 orders
    "Oct 13, 2025", // ₹6,500, 18 orders
    "Oct 14, 2025", // ₹7,200, 22 orders
    "Oct 15, 2025", // ₹8,100, 25 orders
    "Oct 16, 2025", // ₹9,000, 28 orders
    "Oct 17, 2025", // ₹11,500, 35 orders
    "Oct 18, 2025", // ₹12,000, 38 orders
];
```

### Expected Chart Pattern

With the above data, you should see:

-   **Upward trend** from Monday to Sunday
-   **Peak on weekend** (Oct 17-18)
-   **Total Revenue**: ₹59,300
-   **Total Orders**: 181
-   **Average Daily**: ₹8,471

## Troubleshooting

### "No data available"

**Cause**: No orders in database for selected period

**Fix**:

1. Create some test orders
2. Or select a different date range
3. Check order status is not 'cancelled'

### "Failed to load revenue chart data"

**Cause**: Backend not responding

**Fix**:

1. Check backend terminal - should see "✅ Backend server running"
2. Visit http://localhost:4000/api/dashboard/revenue-chart?period=weekly
3. Should see JSON response
4. If not, restart backend

### Chart shows but lines are flat

**Cause**: All revenue is the same value

**Fix**: Normal if all days have identical sales

-   Add variety to test data
-   Check if real data is accurate

### Apply button is disabled

**Cause**: Missing start or end date

**Fix**:

1. Ensure both dates are selected
2. Ensure end date is after start date
3. Dates should be in the past or today

## Browser Console Checks

### Success Messages

```
✅ Revenue chart data loaded successfully
✅ Period: weekly
✅ Data points: 7
```

### Error Messages to Watch For

```
❌ Failed to load revenue chart data
❌ Network error
❌ 500 Internal Server Error
```

### How to Check Console

1. Press **F12** (Windows) or **Cmd+Option+I** (Mac)
2. Click **Console** tab
3. Look for messages related to "revenue-chart"

## API Testing (Optional)

### Test Weekly Endpoint

```bash
curl http://localhost:4000/api/dashboard/revenue-chart?period=weekly
```

**Expected Response**:

```json
[
  {"date": "Oct 12", "revenue": 5000, "orders": 15},
  {"date": "Oct 13", "revenue": 6500, "orders": 18},
  ...
]
```

### Test Monthly Endpoint

```bash
curl http://localhost:4000/api/dashboard/revenue-chart?period=monthly
```

### Test Custom Endpoint

```bash
curl "http://localhost:4000/api/dashboard/revenue-chart?period=custom&startDate=2025-10-01T00:00:00.000Z&endDate=2025-10-31T23:59:59.999Z"
```

## Success Criteria

Your implementation is working correctly if:

✅ Weekly view loads automatically on Dashboard
✅ Monthly and Custom buttons work
✅ Date picker appears for Custom
✅ Apply button fetches new data
✅ Summary cards show correct calculations
✅ Hover tooltips display properly
✅ Chart is responsive on mobile
✅ No errors in browser console
✅ Backend responds to API calls

## Next Steps

Once testing is complete:

1. **Create Real Orders**: Add actual restaurant orders
2. **Monitor Trends**: Use chart to track daily performance
3. **Compare Periods**: Use custom ranges for comparisons
4. **Export Data**: (Future feature) Export for reports
5. **Share Insights**: Use data for business decisions

## Quick Reference

### Keyboard Shortcuts

-   **Tab**: Navigate between period buttons
-   **Enter**: Apply custom date range
-   **Escape**: Close any open modals

### Mouse Actions

-   **Click buttons**: Switch periods
-   **Hover chart**: View tooltips
-   **Click dates**: Select custom range
-   **Scroll**: Zoom in/out (future feature)

## Support

If issues persist:

1. Check `REVENUE_CHART_FEATURE.md` for detailed docs
2. Review backend logs for errors
3. Verify database has order data
4. Check browser console for errors
5. Restart both backend and frontend

---

**Happy Testing! 📊**

The revenue chart is a powerful tool for understanding your restaurant's financial performance. Use it to identify trends, peak days, and growth opportunities.
