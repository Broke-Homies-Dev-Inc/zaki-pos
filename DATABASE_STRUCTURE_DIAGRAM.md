# Database Structure Diagram

## 📊 Complete Database Schema Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        RESTAURANT POS DATABASE                          │
│                         (restaurant_db)                                 │
└─────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────┐
│                      CONFIGURATION & SETTINGS                          │
└────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────┐
│   restaurant_settings        │  📝 Global Configuration
├──────────────────────────────┤
│ • id (PK)                    │
│ • restaurant_name            │
│ • address                    │
│ • contact_number             │
│ • registration_number        │
│ • tax_rate                   │ ← Tax percentage (e.g., 5.00%)
│ • loyalty_points_enabled     │ ← Enable/disable loyalty
│ • loyalty_points_per_100     │ ← Points per ₹100 spent
│ • points_value               │ ← Value of 1 point (₹)
│ • print_preview_enabled      │ ← Show preview before print
│ • created_at, updated_at     │
└──────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────┐
│                      CUSTOMER MANAGEMENT                               │
└────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────┐
│   customers                  │  👤 Customer Records
├──────────────────────────────┤
│ • id (PK)                    │
│ • name                       │
│ • mobile_number (UNIQUE)     │
│ • email                      │
│ • address                    │
│ • status                     │ ← verified/unverified
│ • loyalty_points             │ ← 🎁 Loyalty balance
│ • created_at, updated_at     │
└──────────────────────────────┘
         │
         │ 1:N relationship
         ↓
┌──────────────────────────────┐
│   orders                     │  🛒 Customer Orders
├──────────────────────────────┤
│ • id (PK)                    │
│ • order_number (UNIQUE)      │
│ • customer_id (FK) ──────────┘
│ • customer_name              │
│ • mobile_number              │
│ • order_type                 │ ← dine_in/take_away/delivery
│ • subtotal                   │
│ • tax_amount                 │
│ • grand_total                │
│ • status                     │ ← pending/completed/cancelled
│ • notes                      │
│ • restaurant_table_id (FK)   │ ← For dine-in orders
│ • take_away_method           │ ← counter/car
│ • car_details                │
│ • delivery_address           │
│ • points_redeemed            │ ← 🎁 Points used for discount
│ • points_earned              │ ← 🎁 Points earned from order
│ • created_at, updated_at     │
└──────────────────────────────┘
         │
         │ 1:N relationship
         ↓
┌──────────────────────────────┐
│   order_items                │  📦 Order Line Items
├──────────────────────────────┤
│ • id (PK)                    │
│ • order_id (FK) ──────────────┘
│ • menu_item_id (FK)          │
│ • quantity                   │
│ • unit_price                 │
│ • total_price                │
│ • created_at                 │
└──────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────┐
│                      TABLE MANAGEMENT                                  │
└────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────┐
│   floors                     │  🏢 Floor Layouts
├──────────────────────────────┤
│ • id (PK)                    │
│ • name                       │ ← e.g., "Ground Floor"
│ • created_at                 │
└──────────────────────────────┘
         │
         │ 1:N relationship
         ↓
┌──────────────────────────────┐
│   sections                   │  📍 Sections within Floors
├──────────────────────────────┤
│ • id (PK)                    │
│ • floor_id (FK) ──────────────┘
│ • name                       │ ← e.g., "Main Dining"
│ • created_at                 │
└──────────────────────────────┘
         │
         │ 1:N relationship
         ↓
┌──────────────────────────────┐
│   restaurant_tables          │  🪑 Physical Tables
├──────────────────────────────┤
│ • id (PK)                    │
│ • section_id (FK) ────────────┘
│ • name                       │ ← e.g., "Table 1"
│ • status                     │ ← 🚦 available/occupied/cleaning
│ • created_at, updated_at     │
└──────────────────────────────┘
         │
         │ 1:N relationship (dine-in orders)
         └────────────→ orders

┌────────────────────────────────────────────────────────────────────────┐
│                      MENU & INVENTORY                                  │
└────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────┐
│   inventory                  │  📦 Stock Items
├──────────────────────────────┤
│ • id (PK)                    │
│ • item_name                  │ ← e.g., "Flour", "Cheese"
│ • quantity                   │
│ • unit                       │ ← kg, liters, pieces
│ • reorder_level              │
│ • created_at, updated_at     │
└──────────────────────────────┘
         │
         │ N:M relationship (via recipes)
         ↓
┌──────────────────────────────┐
│   recipes                    │  📝 Recipe Ingredients
├──────────────────────────────┤
│ • id (PK)                    │
│ • menu_item_id (FK) ──────────┐
│ • inventory_item_id (FK) ─────┘
│ • quantity_used              │ ← Amount per serving
│ • created_at                 │
└──────────────────────────────┘
         ↑
         │ N:M relationship
         │
┌──────────────────────────────┐
│   menu_items                 │  🍕 Menu Items
├──────────────────────────────┤
│ • id (PK)                    │
│ • name                       │ ← e.g., "Pizza", "Pasta"
│ • category                   │ ← e.g., "Main", "Appetizer"
│ • price                      │
│ • available                  │ ← true/false
│ • inventory_item_id (FK)     │ ← Optional direct link
│ • quantity_per_order         │
│ • created_at, updated_at     │
└──────────────────────────────┘
         │
         │ 1:N relationship
         └────────────→ order_items

┌────────────────────────────────────────────────────────────────────────┐
│                      HELPER VIEWS                                      │
└────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────┐
│   active_orders_view         │  👁️ Active Orders Overview
├──────────────────────────────┤
│ Shows:                       │
│ • Order details              │
│ • Customer info              │
│ • Loyalty points             │
│ • Table assignment           │
│ • Excludes: cancelled orders │
└──────────────────────────────┘

┌──────────────────────────────┐
│   table_status_overview      │  👁️ Table Status at a Glance
├──────────────────────────────┤
│ Shows:                       │
│ • All tables                 │
│ • Current status             │
│ • Active orders on tables    │
│ • Floor/section info         │
└──────────────────────────────┘

┌──────────────────────────────┐
│   low_stock_inventory        │  👁️ Stock Alerts
├──────────────────────────────┤
│ Shows:                       │
│ • Items below reorder level  │
│ • Current quantity           │
│ • Stock percentage           │
│ • Sorted by urgency          │
└──────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────┐
│                      KEY FEATURES & FLOWS                              │
└────────────────────────────────────────────────────────────────────────┘

🎁 LOYALTY POINTS FLOW:
   Order Created → Calculate Points Earned
   Order Completed → Add Points to Customer
   Redemption → Deduct Points, Apply Discount

   Earning: points = floor((total / 100) * loyalty_points_per_100)
   Redemption: discount = points_redeemed * points_value

🪑 TABLE STATUS FLOW:
   available → occupied (order created)
            → cleaning (payment, 2-min delay)
            → available (ready for next customer)

🛒 ORDER FLOW:
   Create Order → pending
               → Items added to order_items
               → Table marked occupied (if dine-in)
               → Complete Order → completed
                               → Points earned added
                               → Points redeemed deducted
                               → Table to cleaning
                               → Inventory reduced (if tracked)
               → Cancel Order → cancelled
                             → Table to available (immediate)

💰 PRICING CALCULATION:
   Subtotal = Sum of all order_items.total_price
   Tax = Subtotal × (tax_rate / 100)
   Discount = points_redeemed × points_value
   Grand Total = Subtotal + Tax - Discount

┌────────────────────────────────────────────────────────────────────────┐
│                      PERFORMANCE INDEXES                               │
└────────────────────────────────────────────────────────────────────────┘

📌 Key Indexes:
   • customers.mobile_number (UNIQUE, fast lookup)
   • customers.status (filter by verified/unverified)
   • orders.status (filter pending/completed)
   • orders.created_at (date range queries)
   • orders.created_at + status (composite for revenue)
   • orders.customer_id (join optimization)
   • orders.restaurant_table_id (table orders)
   • restaurant_tables.status (available tables)
   • menu_items.category (menu by category)
   • menu_items.available (active menu items)
   • All foreign keys indexed

┌────────────────────────────────────────────────────────────────────────┐
│                      CONSTRAINTS & VALIDATION                          │
└────────────────────────────────────────────────────────────────────────┘

🔒 Primary Keys: All tables use UUID
🔗 Foreign Keys: Proper cascading configured
✅ Unique: order_number, customer mobile_number
❌ Not Null: Essential fields enforced
⚙️ Defaults: Status, timestamps, booleans
🔄 Triggers: Auto-update timestamps

┌────────────────────────────────────────────────────────────────────────┐
│                      BUSINESS RULES                                    │
└────────────────────────────────────────────────────────────────────────┘

✓ Dine-in orders MUST have a table assigned
✓ Tables MUST be 'available' to accept new orders
✓ Minimum 200 loyalty points required to redeem
✓ Points redemption cannot exceed order total
✓ Table cleaning buffer: 2 minutes before available
✓ Tax applied before loyalty discount
✓ Order numbers are unique and sequential
✓ Cancelled orders don't affect inventory
✓ Completed orders reduce inventory (if recipe linked)
✓ Points earned on order completion, not creation

┌────────────────────────────────────────────────────────────────────────┐
│                      DATA TYPES REFERENCE                              │
└────────────────────────────────────────────────────────────────────────┘

UUID           → All IDs
VARCHAR        → Names, short text
TEXT           → Long text (notes, addresses)
DECIMAL(10,2)  → Money amounts
DECIMAL(5,2)   → Percentages
INTEGER        → Counts, points
BOOLEAN        → Flags (true/false)
TIMESTAMP      → All timestamps (with timezone)

┌────────────────────────────────────────────────────────────────────────┐
│                      DEFAULT VALUES                                    │
└────────────────────────────────────────────────────────────────────────┘

Restaurant Name:     "My Restaurant"
Tax Rate:            5.00%
Loyalty Enabled:     true
Points per ₹100:     10
Points Value:        0.1 (10 points = ₹1)
Print Preview:       false
Table Status:        available
Order Status:        pending
Customer Status:     unverified
Loyalty Points:      0

┌────────────────────────────────────────────────────────────────────────┐
│                      QUICK STATS                                       │
└────────────────────────────────────────────────────────────────────────┘

📊 Tables:     10
📈 Views:      3
📌 Indexes:    15+
🔄 Triggers:   6
🔗 Relations:  Multiple 1:N and N:M
💾 Size:       ~500 lines SQL
🎯 Features:   All implemented
✅ Status:     Production Ready

```

## 🎯 Visual Legend

| Symbol | Meaning                   |
| ------ | ------------------------- |
| PK     | Primary Key               |
| FK     | Foreign Key               |
| 1:N    | One-to-Many Relationship  |
| N:M    | Many-to-Many Relationship |
| →      | Points to / References    |
| ←      | Description / Note        |
| •      | Field/Property            |
| 🎁     | Loyalty Points Feature    |
| 🚦     | Status Tracking           |
| 📦     | Inventory Related         |
| 🪑     | Table Management          |
| 👤     | Customer Data             |
| 🛒     | Order System              |
| 📝     | Configuration             |
| 👁️     | View (Read-only)          |

## 🔍 How to Read This Diagram

1. **Boxes** represent tables or views
2. **Lines** show relationships between tables
3. **Arrows** indicate the direction of the relationship
4. **FK labels** show foreign key connections
5. **Symbols** (🎁, 🪑, etc.) highlight key features

## 📚 Complete Package

This diagram is part of the complete database documentation:

1. **database_master_schema.sql** - The actual SQL code
2. **DATABASE_INSTALLATION_GUIDE.md** - How to install
3. **DATABASE_CHANGES_LOG.md** - What changed
4. **DATABASE_QUICK_REFERENCE.md** - Quick commands
5. **DATABASE_MASTER_SUMMARY.md** - Overview
6. **DATABASE_STRUCTURE_DIAGRAM.md** - This file

---

**Use this diagram** to understand the complete database structure at a glance!
