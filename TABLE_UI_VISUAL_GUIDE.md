# Visual Guide: Table Selection UI

## Before & After Comparison

### BEFORE (Old Implementation)

```
Select Table *
┌─────────────────────────────────────┐
│ Select an available table           │
├─────────────────────────────────────┤
│ Floor 1 (2 available)               │
│   Table 1 - Main Dining             │
│   Table 4 - Main Dining             │
├─────────────────────────────────────┤
│ Floor 2 (1 available)               │
│   Table 5 - Balcony                 │
└─────────────────────────────────────┘

Only available tables are shown
```

**Problems:**

-   ❌ Staff can't see occupied tables
-   ❌ No visibility into table status
-   ❌ Can't plan for upcoming availability
-   ❌ Confusion about missing tables

---

### AFTER (New Implementation)

```
Select Table *
┌─────────────────────────────────────────┐
│ Select an available table               │
├─────────────────────────────────────────┤
│ Floor 1 (2/4 available)                 │
│   Table 1 - Main Dining                 │  ← ✅ Selectable (black)
│   Table 2 - Main Dining (👥 Occupied)   │  ← ❌ Disabled (grey, italic)
│   Table 3 - Window (🧹 Cleaning)        │  ← ❌ Disabled (grey, italic)
│   Table 4 - Main Dining                 │  ← ✅ Selectable (black)
├─────────────────────────────────────────┤
│ Floor 2 (1/2 available)                 │
│   Table 5 - Balcony                     │  ← ✅ Selectable (black)
│   Table 6 - Balcony (🧾 Bill Printed)   │  ← ❌ Disabled (grey, italic)
└─────────────────────────────────────────┘

Available tables shown in black, unavailable tables greyed out

• 👥 Occupied - Table has active order
• 🧹 Cleaning - Being prepared (2 min)
• 🧾 Bill Printed - Awaiting payment
```

**Benefits:**

-   ✅ Complete visibility of all tables
-   ✅ Clear status indicators
-   ✅ Staff can see what's coming available
-   ✅ Better table management

## UI Elements Breakdown

### 1. Floor Header with Counts

```
Floor 1 (2/4 available)
         ↑ ↑
         │ └─ Total tables on floor
         └─── Available tables
```

### 2. Table Options

#### Available Table (Selectable)

```
Table 1 - Main Dining
└─ Normal black text
└─ Regular font style
└─ Can be clicked/selected
```

#### Occupied Table (Disabled)

```
Table 2 - Main Dining (👥 Occupied)
                       ↑  ↑
                       │  └─ Status label
                       └──── Icon indicator
└─ Grey text (#9ca3af)
└─ Italic font style
└─ Cannot be selected (disabled)
```

#### Cleaning Table (Disabled)

```
Table 3 - Window (🧹 Cleaning)
                  ↑  ↑
                  │  └─ Status label + timer info
                  └──── Icon indicator
└─ Grey text (#9ca3af)
└─ Italic font style
└─ Cannot be selected (disabled)
└─ Will be available after 2 minutes
```

### 3. Helper Text

```
Available tables shown in black, unavailable tables greyed out
└─ Explains the color coding
└─ Appears when tables are available but some are disabled
```

### 4. Status Legend

```
• 👥 Occupied - Table has active order
  └─ Explains why table is unavailable

• 🧹 Cleaning - Being prepared (2 min)
  └─ Shows expected wait time

• 🧾 Bill Printed - Awaiting payment
  └─ Indicates payment in progress
```

### 5. No Tables Available Warning

```
⚠️ All tables are currently occupied. Please wait for a
table to become available or choose a different order type.
└─ Red text warning
└─ Suggests alternative actions
└─ Only shows when NO tables available
```

## Color Scheme

### Available Tables

-   **Text Color:** `inherit` (default black/dark)
-   **Font Weight:** Normal (400)
-   **Font Style:** Normal
-   **Cursor:** Pointer
-   **State:** Enabled

### Unavailable Tables

-   **Text Color:** `#9ca3af` (Tailwind gray-400)
-   **Font Weight:** Normal (400)
-   **Font Style:** Italic
-   **Cursor:** Not-allowed
-   **State:** Disabled

### Status Icons

| Icon | Meaning      | Unicode |
| ---- | ------------ | ------- |
| 👥   | Occupied     | U+1F465 |
| 🧹   | Cleaning     | U+1F9F9 |
| 🧾   | Bill Printed | U+1F9FE |

## Responsive Behavior

### Desktop View

```
┌────────────────────────────────────────────────┐
│ Select Table *                                 │
│ ┌────────────────────────────────────────────┐ │
│ │ Select an available table                  │ │
│ ├────────────────────────────────────────────┤ │
│ │ Floor 1 (2/4 available)                    │ │
│ │   Table 1 - Main Dining                    │ │
│ │   Table 2 - Main Dining (👥 Occupied)      │ │
│ │   ...                                      │ │
│ └────────────────────────────────────────────┘ │
└────────────────────────────────────────────────┘
```

### Mobile View

```
┌──────────────────────┐
│ Select Table *       │
│ ┌──────────────────┐ │
│ │ Select table     │ │
│ ├──────────────────┤ │
│ │ Floor 1 (2/4)    │ │
│ │   T1 - Main     │ │
│ │   T2 (👥)       │ │
│ └──────────────────┘ │
└──────────────────────┘
```

## Accessibility Features

### Keyboard Navigation

-   **Tab:** Navigate to dropdown
-   **Enter/Space:** Open dropdown
-   **Arrow Keys:** Navigate options
-   **Enter:** Select available table
-   **Disabled tables:** Skipped in keyboard navigation

### Screen Reader Support

```html
<option disabled aria-disabled="true">Table 2 - Main Dining (Occupied)</option>
```

### Visual Indicators

-   **Color:** Not the only indicator (also uses italic + disabled state)
-   **Icons:** Provide quick visual reference
-   **Text:** Explicit status labels
-   **Disabled State:** Browser-native support

## User Interaction Flow

### Step-by-Step

1. **Staff clicks table dropdown**

    ```
    ┌─────────────────────────┐
    │ Select an available tab…▼
    └─────────────────────────┘
    ```

2. **Dropdown opens with all tables**

    ```
    ┌─────────────────────────┐
    │ Floor 1 (2/4 available) │
    │   Table 1 - Main        │ ← Hover OK
    │   Table 2 (👥 Occupied) │ ← Hover shows disabled
    │   Table 3 (🧹 Cleaning) │ ← Hover shows disabled
    │   Table 4 - Main        │ ← Hover OK
    └─────────────────────────┘
    ```

3. **Staff hovers over disabled table**

    ```
    Table 2 - Main (👥 Occupied)
    └─ Cursor: not-allowed
    └─ No hover effect
    └─ Cannot click
    ```

4. **Staff hovers over available table**

    ```
    Table 1 - Main Dining
    └─ Cursor: pointer
    └─ Slight highlight (browser default)
    └─ Can click to select
    ```

5. **Staff selects available table**
    ```
    Selected: Table 1 - Main Dining
    └─ Red border removed (validation passed)
    └─ Normal border appears
    └─ Can proceed with order creation
    ```

## Testing Scenarios

### Visual Testing Checklist

#### Scenario 1: All Tables Available

```
Floor 1 (3/3 available)
  Table 1 - Main
  Table 2 - Main
  Table 3 - Window
```

-   ✅ All tables in black
-   ✅ All selectable
-   ✅ No status labels
-   ✅ No icons

#### Scenario 2: Mixed Availability

```
Floor 1 (1/3 available)
  Table 1 - Main
  Table 2 - Main (👥 Occupied)
  Table 3 - Window (🧹 Cleaning)
```

-   ✅ Table 1: Black, selectable
-   ✅ Table 2: Grey, italic, disabled
-   ✅ Table 3: Grey, italic, disabled
-   ✅ Correct icons shown

#### Scenario 3: No Tables Available

```
⚠️ All tables are currently occupied...
```

-   ✅ Warning message visible
-   ✅ Red text color
-   ✅ All options disabled
-   ✅ Suggests alternatives

#### Scenario 4: After Cleaning Complete

```
Before (12:00 PM):
  Table 1 - Main (🧹 Cleaning)  [grey, disabled]

After (12:02 PM - auto-update):
  Table 1 - Main                [black, selectable]
```

-   ✅ Status changes automatically
-   ✅ Table becomes selectable
-   ✅ Icon removed
-   ✅ Count updated

## Edge Cases

### Case 1: Only Cleaning Tables Available

```
Floor 1 (0/2 available)
  Table 1 - Main (🧹 Cleaning)
  Table 2 - Window (🧹 Cleaning)

⚠️ All tables are currently occupied...
```

**Result:** Treated as "no tables available"

### Case 2: Single Floor, Single Table

```
Floor 1 (1/1 available)
  Table 1 - Main
```

**Result:** Simple, clean display

### Case 3: Many Floors, Many Tables

```
Floor 1 (2/10 available)
Floor 2 (3/8 available)
Floor 3 (0/5 available)
...
```

**Result:** Scrollable dropdown with organized groups

---

**Visual Design Status:** ✅ Implemented and Ready  
**Accessibility:** ✅ Keyboard and screen reader compatible  
**Responsive:** ✅ Works on all screen sizes
