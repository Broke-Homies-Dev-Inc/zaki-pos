# Bill Generation with Restaurant Settings

## Overview

The bill generation system now automatically fetches and uses the restaurant settings configured in the Settings page.

## How It Works

### 1. Restaurant Settings Storage

-   **Table**: `restaurant_settings`
-   **Fields**:
    -   `restaurant_name` - Your restaurant's name
    -   `address` - Full address
    -   `contact_number` - Phone number
    -   `registration_number` - Business registration number
    -   `tax_rate` - Tax percentage (for future use in automatic tax calculation)

### 2. Settings Management

Navigate to: **Settings → Restaurant Settings**

You can update:

-   Restaurant Name (e.g., "Zaki")
-   Address (e.g., "123 Zaki Street, Oman")
-   Phone Number (e.g., "33526972")
-   Registration Number (e.g., "ZAKI!123NIGZ")
-   Tax Rate (e.g., "5.00" for 5%)

### 3. Bill Generation Flow

When you print a bill from the Billing page:

1. **User clicks "Print Bill"** on a table with an active order
2. **System fetches**:
    - Full order details (items, quantities, prices) from `/api/orders/:id`
    - Restaurant settings from `/api/setting/settings`
3. **Bill is generated** with:

    ```
    ════════════════════════════════
               ZAKI
    123 Zaki Street, Oman
         Tel: 33526972
      Reg: ZAKI!123NIGZ
    ════════════════════════════════

    Table: Table 1
    Order #: ORD-001
    Date: Oct 18, 2025 10:30 AM
    Customer: John Doe

    ────────────────────────────────

    Chicken Biryani
    2 x $15.00                $30.00

    Cold Drink
    1 x $3.00                  $3.00

    ────────────────────────────────

    Subtotal:                 $33.00
    Tax:                       $1.65
    TOTAL:                    $34.65

    ════════════════════════════════
     Thank you for dining with us!
           Please visit again
    ════════════════════════════════
    ```

### 4. Technical Implementation

#### Backend Endpoint

**GET** `/api/setting/settings`

```typescript
// Returns:
{
  restaurant_name: "Zaki",
  address: "123 Zaki Street, Oman",
  contact_number: "33526972",
  registration_number: "ZAKI!123NIGZ",
  tax_rate: 5.00
}
```

#### Frontend Integration

File: `frontend/src/lib/printBill.ts`

```typescript
// 1. Fetch restaurant settings
const settingsResponse = await api.get("/setting/settings");
const restaurantSettings = settingsResponse.data;

// 2. Use in bill template
<div class="header">
    <div class="center bold">${restaurantSettings.restaurant_name}</div>
    <div class="center">${restaurantSettings.address}</div>
    <div class="center">Tel: ${restaurantSettings.contact_number}</div>
    <div class="center">Reg: ${restaurantSettings.registration_number}</div>
</div>;
```

### 5. Current Configuration

Your current settings (from database):

-   **Restaurant Name**: Zaki
-   **Address**: 123 Zaki Stret, Oman
-   **Phone**: 33526972
-   **Registration**: ZAKI!123NIGZ
-   **Tax Rate**: 5.00%

## Testing the Feature

### To test bill generation with updated settings:

1. **Start the backend**:

    ```bash
    cd backend
    npm run dev
    ```

2. **Start the frontend**:

    ```bash
    cd frontend
    npm run dev
    ```

3. **Update settings** (optional):

    - Navigate to Settings → Restaurant Settings
    - Modify any values
    - Click "Save Settings"

4. **Print a bill**:
    - Go to Billing page
    - Click on any table with an active order
    - Click "Print Bill" or use the quick print button
    - Verify all restaurant details appear correctly

## Key Features

✅ **Automatic fetching**: Settings are loaded automatically when printing
✅ **Fallback values**: If settings can't be loaded, defaults are used
✅ **Real-time updates**: Changes in settings appear immediately on next bill print
✅ **Professional formatting**: Thermal receipt-style layout with clear hierarchy
✅ **Complete information**: Name, address, phone, and registration number all displayed
✅ **Thank you message**: Friendly closing message at the bottom

## Notes

-   Settings are fetched fresh for each bill print to ensure latest data
-   If the settings API fails, default values prevent the bill from breaking
-   The registration number only appears if it's set (optional field)
-   Tax rate is stored for future automatic calculation features
