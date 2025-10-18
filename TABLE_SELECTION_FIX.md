# Table Selection Fix - Debug Guide

## Issues Fixed

### Issue 1: Unable to Select Tables

**Problem:** Tables showed in dropdown but couldn't be selected  
**Root Cause:** `onChange` handler had validation that prevented selection  
**Fix:** Simplified to just set the selected table on change

**Before:**

```typescript
onChange={(e) => {
    const selectedTableId = e.target.value;
    const table = allTables.find(t => t.tableId === selectedTableId);
    if (table && table.isAvailable) {  // ← This was blocking selection
        setSelectedTable(selectedTableId);
    }
}}
```

**After:**

```typescript
onChange={(e) => {
    const selectedTableId = e.target.value;
    if (selectedTableId) {  // ← Simpler check
        setSelectedTable(selectedTableId);
    }
}}
```

### Issue 2: Status Logic Mismatch

**Problem:** `table.table_status || 'available'` vs `table.table_status === 'available'`  
**Impact:** When status is null/undefined, first evaluates to `'available'` but second is `false`

**Fix:** Use consistent variable for status checks:

```typescript
const tableStatus = table.table_status || "available";
const available = tableStatus === "available";
```

## Testing Steps

### 1. Open Browser Console

Press **F12** → Go to **Console** tab

### 2. Create New Order

1. Click **Create Order** button
2. Select **"Dine In"**
3. Click on table dropdown

### 3. Check Debug Logs

You should see console logs like:

```
Table T3: status="occupied" -> occupied, available=false
Table Table 1: status="available" -> available, available=true
Table Table 2: status="available" -> available, available=true
```

### 4. Select a Table

1. Click on any table (e.g., "Table 1 - Main Hall")
2. The dropdown should now show: **"Table 1 - Main Hall"** ✅
3. The red border should disappear ✅

### 5. Create the Order

1. Add items to cart
2. Click **"Create Order"** button
3. Order should be created successfully ✅

## Expected Behavior

### Visual Feedback:

**Before Selection:**

```
┌─────────────────────────────────┐
│ Select an available table    ▼ │ ← Red border
└─────────────────────────────────┘
```

**After Selection:**

```
┌─────────────────────────────────┐
│ Table 1 - Main Hall          ▼ │ ← Normal border
└─────────────────────────────────┘
```

### Console Debug Output:

**If T3 is occupied:**

```
Table T3: status="occupied" -> occupied, available=false
```

**If all tables available:**

```
Table T3: status="available" -> available, available=true
Table T1: status="available" -> available, available=true
Table T2: status="available" -> available, available=true
```

## Troubleshooting

### Problem: Still can't select tables

**Check:**

1. Open Browser Console (F12)
2. Look for JavaScript errors
3. Check if `setSelectedTable` is being called
4. Verify `selectedTable` state is updating

**Debug:**
Add this temporarily to see state changes:

```typescript
onChange={(e) => {
    const selectedTableId = e.target.value;
    console.log('Selected table ID:', selectedTableId);
    if (selectedTableId) {
        setSelectedTable(selectedTableId);
        console.log('State updated to:', selectedTableId);
    }
}}
```

### Problem: Dropdown doesn't show selected value

**Check:**

1. `value={selectedTable || ""}` is correct
2. Option `value` matches table ID
3. `selectedTable` state is being set

**Verify in console:**

```javascript
// Type this in browser console:
// (after opening React DevTools)
// Check the selectedTable state value
```

### Problem: Create Order button still disabled

**Check:**
The validation logic at the submit button. Look for:

```typescript
disabled={
    cart.length === 0 ||
    (orderType === 'dine_in' && !selectedTable) ||
    (orderType === 'delivery' && !deliveryAddress)
}
```

## What Changed

### File: `frontend/src/components/CreateOrderModal.tsx`

**Change 1: Simplified onChange (lines 187-193)**

```diff
- onChange={(e) => {
-     const selectedTableId = e.target.value;
-     const table = allTables.find(t => t.tableId === selectedTableId);
-     if (table && table.isAvailable) {
-         setSelectedTable(selectedTableId);
-     }
- }}
+ onChange={(e) => {
+     const selectedTableId = e.target.value;
+     if (selectedTableId) {
+         setSelectedTable(selectedTableId);
+     }
+ }}
```

**Change 2: Fixed status logic (lines 166-179)**

```diff
  tableLayout.forEach((floor) => {
      (floor.sections || []).forEach((section) => {
          (section.tables || []).forEach((table) => {
+             const tableStatus = table.table_status || 'available';
+             const available = tableStatus === 'available';
+
              allTables.push({
                  tableId: table.table_id,
                  tableName: table.table_name,
                  sectionName: section.section_name,
                  floorName: floor.floor_name,
-                 status: table.table_status || 'available',
-                 isAvailable: table.table_status === 'available'
+                 status: tableStatus,
+                 isAvailable: available
              });
+
+             // Debug logging
+             console.log(`Table ${table.table_name}: status="${table.table_status}" -> ${tableStatus}, available=${available}`);
          });
      });
  });
```

## Backend Validation

Remember, the backend still validates:

1. ✅ Dine-in orders must have a table
2. ✅ Table must exist
3. ✅ Table must be available (status = 'available')

So even if frontend allows selection, backend will reject occupied tables.

## Remove Debug Logging

Once everything works, you can remove the debug line:

```typescript
// Remove this line after testing:
console.log(
    `Table ${table.table_name}: status="${table.table_status}" -> ${tableStatus}, available=${available}`
);
```

---

**Status:** ✅ Fixed  
**Test:** Refresh browser and try selecting a table  
**Expected:** Table selection should work immediately
