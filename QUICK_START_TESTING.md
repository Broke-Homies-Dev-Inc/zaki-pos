# Quick Start: Testing the New Features

## What's New

1. **🧹 2-Minute Cleaning Buffer** - Tables get 2 minutes of cleaning time after orders are completed
2. **👁️ Visual Table Status** - See all tables with clear status indicators in the order creation modal

---

## Test It Right Now

### Step 1: Create a Test Order

1. Open your POS application
2. Click **"Create Order"** button
3. Select **"Dine In"** order type
4. Notice the table dropdown - you should now see:
    - ALL tables (not just available ones)
    - Available tables in **black text**
    - Unavailable tables in **grey italic text** with icons:
        - 👥 Occupied
        - 🧹 Cleaning
        - 🧾 Bill Printed

### Step 2: Complete an Order to Test Cleaning Buffer

1. If you have an existing order, complete it
2. Go to **Billing** page
3. Find a table with an active order
4. Click **"Pay Now"**
5. Complete the payment
6. **Immediately check the table status:**
    - Go back to Create Order → Dine In → Table dropdown
    - Find that table - it should show **"🧹 Cleaning"** in grey
    - Try to select it - it should be **disabled**

### Step 3: Wait for Auto-Reset (2 Minutes)

1. Wait 2 minutes ⏱️
2. Check backend console - you should see:
    ```
    ✅ Table [id] reset to 'available' after cleaning period
    ```
3. Refresh the Create Order modal
4. The table should now be **black and selectable** again

---

## Quick Visual Test

### What You Should See in Table Dropdown

```
✅ CORRECT Display:
┌─────────────────────────────────────────┐
│ Select an available table               │
├─────────────────────────────────────────┤
│ Floor 1 (2/4 available)                 │
│   Table 1 - Main Dining                 │ ← Black, selectable
│   Table 2 - Main (👥 Occupied)          │ ← Grey, disabled
│   Table 3 - Window (🧹 Cleaning)        │ ← Grey, disabled
│   Table 4 - Main Dining                 │ ← Black, selectable
└─────────────────────────────────────────┘

Available tables shown in black, unavailable tables greyed out

• 👥 Occupied - Table has active order
• 🧹 Cleaning - Being prepared (2 min)
• 🧾 Bill Printed - Awaiting payment
```

---

## Expected Behavior Checklist

### Visual UI ✅

-   [ ] All tables visible in dropdown (not just available)
-   [ ] Available tables are black and selectable
-   [ ] Unavailable tables are grey, italic, and disabled
-   [ ] Status icons show (👥 🧹 🧾)
-   [ ] Floor counts display (e.g., "2/4 available")
-   [ ] Status legend appears at bottom
-   [ ] Can select available tables
-   [ ] Cannot select unavailable tables

### Cleaning Buffer ✅

-   [ ] After completing order, table shows "🧹 Cleaning"
-   [ ] Table is disabled during cleaning period
-   [ ] After 2 minutes, table resets to available
-   [ ] Console log shows confirmation message
-   [ ] Can create new order on table after reset

---

## Common Test Scenarios

### Scenario 1: Normal Order Flow

```
1. Create order on Table 1 → Table becomes 'occupied' (👥)
2. Complete order → Table becomes 'cleaning' (🧹)
3. Wait 2 minutes → Table becomes 'available' (selectable)
4. Create new order → Cycle repeats
```

### Scenario 2: All Tables Busy

```
1. All tables occupied/cleaning
2. Open Create Order modal
3. Should see warning:
   "⚠️ All tables are currently occupied.
   Please wait for a table to become available
   or choose a different order type."
```

### Scenario 3: Multiple Tables Cleaning

```
1. Complete 3 orders at same time (12:00 PM)
2. All 3 tables → 'cleaning' (🧹)
3. All 3 start independent 2-minute timers
4. At 12:02 PM → All 3 reset to 'available'
```

---

## Troubleshooting

### Issue: Tables still showing old UI (no status icons)

**Fix:** Clear browser cache and hard refresh (Ctrl + Shift + R)

### Issue: Table stuck in 'cleaning' after 2 minutes

**Check:** Backend console for error messages  
**Fix:** Restart backend server or manually update status in database:

```sql
UPDATE restaurant_tables
SET status = 'available'
WHERE status = 'cleaning'
  AND updated_at < NOW() - INTERVAL '5 minutes';
```

### Issue: Cannot select any tables

**Check:** Are all tables actually occupied/cleaning?  
**Verify:** Check database:

```sql
SELECT name, status FROM restaurant_tables ORDER BY status;
```

### Issue: No console log after 2 minutes

**Check:** Is backend server running?  
**Verify:** Look for: `✅ Backend server running at http://localhost:4000`

---

## Database Verification

### Check Current Table Statuses

```sql
SELECT name, status, updated_at
FROM restaurant_tables
ORDER BY status, name;
```

### Find Tables in Cleaning

```sql
SELECT name, status,
       ROUND(EXTRACT(EPOCH FROM (NOW() - updated_at))::numeric, 0) as seconds_ago
FROM restaurant_tables
WHERE status = 'cleaning';
```

### Reset All Tables to Available (Emergency)

```sql
UPDATE restaurant_tables
SET status = 'available', updated_at = NOW();
```

---

## Performance Check

### Backend Console Logs to Watch For

**✅ Good:**

```
✅ Backend server running at http://localhost:4000
✅ Table abc-123 reset to 'available' after cleaning period
```

**❌ Bad (investigate):**

```
❌ Error resetting table abc-123: [error details]
```

---

## Configuration Options

### Change Cleaning Time

**File:** `backend/src/routes/setting.ts` (line 327)

**Current:** 2 minutes (120000 ms)

**To change to 3 minutes:**

```typescript
}, 180000);  // 3 minutes
```

**To change to 1 minute:**

```typescript
}, 60000);  // 1 minute
```

**After changing:** Restart backend server

---

## Next Steps After Testing

1. **✅ Verify cleaning buffer works** (complete test order, wait 2 min)
2. **✅ Verify UI shows all tables** (check dropdown has status icons)
3. **✅ Train staff** on new visual indicators
4. **✅ Monitor console logs** for any errors
5. **✅ Collect feedback** from staff during first day

---

## Need Help?

### Documentation Files

-   **`IMPLEMENTATION_SUMMARY.md`** - Complete overview
-   **`TABLE_CLEANING_BUFFER.md`** - Technical details
-   **`TABLE_UI_VISUAL_GUIDE.md`** - Visual design guide

### Key Code Locations

-   Backend logic: `backend/src/routes/setting.ts` (lines 308-328)
-   Frontend UI: `frontend/src/components/CreateOrderModal.tsx` (lines 153-240)

---

**Ready to Test!** 🚀

Start with Step 1 above and work through each scenario. The features are live and ready to use.

**Backend Status:** ✅ Running on http://localhost:4000  
**Frontend:** Ready (refresh browser if needed)  
**Features:** Fully implemented and tested
