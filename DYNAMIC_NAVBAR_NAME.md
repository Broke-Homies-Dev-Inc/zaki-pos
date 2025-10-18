# Dynamic Restaurant Name in Navbar

## Overview

The restaurant name in the navbar now automatically updates when you change it in the Settings page, without requiring a page refresh.

## Implementation

### 1. React Context for Global State

**File**: `frontend/src/contexts/RestaurantSettingsContext.tsx` (NEW)

Created a React Context to share restaurant settings across the entire application:

```typescript
export function RestaurantSettingsProvider({ children }) {
    const restaurantSettings = useRestaurantSettings();
    return (
        <RestaurantSettingsContext.Provider value={restaurantSettings}>
            {children}
        </RestaurantSettingsContext.Provider>
    );
}

export function useRestaurantSettingsContext() {
    const context = useContext(RestaurantSettingsContext);
    return context;
}
```

### 2. App Wrapper

**File**: `frontend/src/App.tsx` (UPDATED)

Wrapped the entire app with the provider:

```typescript
function App() {
    return (
        <RestaurantSettingsProvider>
            <BrowserRouter>
                <Routes>{/* All routes */}</Routes>
            </BrowserRouter>
        </RestaurantSettingsProvider>
    );
}
```

### 3. Layout Component

**File**: `frontend/src/components/Layout.tsx` (UPDATED)

Updated the navbar to use the context:

```typescript
export function Layout() {
    const { settings, loading } = useRestaurantSettingsContext();

    return (
        <div className="p-6 border-b border-gray-200">
            <h1 className="text-2xl font-bold text-gray-900">
                {loading
                    ? "POS System"
                    : settings?.restaurant_name || "POS System"}
            </h1>
            <p className="text-sm text-gray-500 mt-1">Point of Sale</p>
        </div>
    );
}
```

### 4. Settings Page

**File**: `frontend/src/pages/settings/RestaurantSettings.tsx` (UPDATED)

Added context refetch after saving:

```typescript
export function RestaurantSettings({ onBack }) {
    const { refetch } = useRestaurantSettingsContext();

    const handleSave = async () => {
        await axios.post("/api/setting/settings", settings);
        alert("Settings saved successfully!");
        // This updates the navbar immediately!
        await refetch();
    };
}
```

### 5. Restaurant Settings Hook

**File**: `frontend/src/hooks/useRestaurantSettings.ts` (UPDATED)

Fixed endpoint to use correct API path:

```typescript
// Changed from '/settings' to '/setting/settings'
const response = await api.get("/setting/settings");
```

## How It Works

### Data Flow

```
1. App starts
   ↓
2. RestaurantSettingsProvider loads settings
   ↓
3. Layout subscribes to settings via context
   ↓
4. Navbar displays: settings.restaurant_name
   ↓
5. User goes to Settings page
   ↓
6. User changes restaurant name and clicks Save
   ↓
7. Settings saved to database
   ↓
8. refetch() called → Updates context
   ↓
9. Layout re-renders with new name
   ↓
10. Navbar shows updated name instantly! ✨
```

### Real-Time Updates

```
Settings Page                Layout/Navbar
     ┃                            ┃
     ┃ 1. User edits name         ┃
     ┃ "Zaki" → "Zaki Restaurant" ┃
     ┃                            ┃
     ┃ 2. Clicks Save             ┃
     ┃                            ┃
     ┃ 3. POST to API             ┃
     ┃                            ┃
     ┃ 4. refetch() called        ┃
     ┃ ─────────────────────────> ┃
     ┃                            ┃ 5. Context updates
     ┃                            ┃
     ┃                            ┃ 6. Navbar re-renders
     ┃                            ┃
     ┃                            ┃ 7. New name displayed
     ┃                            ┃    "Zaki Restaurant" ✅
```

## Features

✅ **Instant Updates**: Name changes appear immediately without page refresh  
✅ **Global State**: One source of truth for restaurant settings  
✅ **Loading State**: Shows "POS System" while loading settings  
✅ **Fallback**: Defaults to "POS System" if settings fail to load  
✅ **Type-Safe**: Full TypeScript support with proper types  
✅ **Context Pattern**: Efficient React pattern for global state

## Testing

### 1. Initial State

-   Start the app
-   Navbar should show current restaurant name from database (e.g., "Zaki")

### 2. Change Name

1. Navigate to **Settings → Restaurant Settings**
2. Change the restaurant name (e.g., "Zaki" → "Zaki's Restaurant")
3. Click **Save Settings**
4. Look at the navbar (left sidebar)
5. **Result**: Name should update immediately to "Zaki's Restaurant" ✅

### 3. Refresh Page

1. Refresh the browser (F5)
2. **Result**: Navbar still shows "Zaki's Restaurant" (persisted in database) ✅

### 4. Multiple Tabs

1. Open app in two browser tabs
2. Change name in Tab 1 and save
3. Switch to Tab 2
4. **Note**: Tab 2 won't auto-update (would need WebSockets for that)
5. Refresh Tab 2 to see the new name

## Benefits

1. **Better UX**: Users see changes immediately
2. **Single Source of Truth**: Context prevents state inconsistencies
3. **Easy Maintenance**: One place to manage restaurant settings
4. **Scalable**: Can add more settings fields easily
5. **Performance**: Only fetches settings once on app load

## Technical Details

### Context vs Props

-   **Without Context**: Would need to pass settings as props through many components
-   **With Context**: Any component can access settings directly

### Why refetch()?

-   After saving, we call `refetch()` to update the context
-   This triggers a re-render of all components using the context
-   The navbar automatically gets the new name

### Database Persistence

-   Settings are saved to PostgreSQL database
-   GET `/api/setting/settings` - Fetches current settings
-   POST `/api/setting/settings` - Saves new settings
-   Changes persist across sessions

## File Changes Summary

| File                                     | Change  | Purpose                 |
| ---------------------------------------- | ------- | ----------------------- |
| `contexts/RestaurantSettingsContext.tsx` | NEW     | Global state management |
| `App.tsx`                                | UPDATED | Wrap app with provider  |
| `Layout.tsx`                             | UPDATED | Display dynamic name    |
| `RestaurantSettings.tsx`                 | UPDATED | Trigger refetch on save |
| `useRestaurantSettings.ts`               | UPDATED | Fix API endpoint        |

## Current Database Value

Your current restaurant name in the database: **"Zaki"**

When you change it in Settings, the navbar will automatically update to show the new name!
