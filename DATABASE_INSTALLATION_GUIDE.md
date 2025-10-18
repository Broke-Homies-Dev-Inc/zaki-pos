# Database Master Schema - Installation Guide

## 📋 Overview

This master SQL file (`database_master_schema.sql`) contains the **complete database schema** for the Restaurant POS System, including:

-   ✅ All original table structures
-   ✅ All migrations and updates
-   ✅ New features added during development
-   ✅ Sample data (commented out)
-   ✅ Utility views and functions
-   ✅ Performance indexes
-   ✅ Maintenance queries

## 🗄️ Database Information

**Database Name:** `restaurant_db`  
**PostgreSQL Version:** 18.0+  
**Total Tables:** 10  
**Total Views:** 3

## 📊 Tables Included

### Core Tables

1. **restaurant_settings** - Global configuration and settings
2. **customers** - Customer records with loyalty points
3. **floors** - Floor layouts
4. **sections** - Sections within floors
5. **restaurant_tables** - Tables with status tracking
6. **inventory** - Inventory management
7. **menu_items** - Menu items with pricing
8. **recipes** - Recipe ingredients
9. **orders** - Customer orders
10. **order_items** - Order line items

### Views

1. **active_orders_view** - Active orders with customer info
2. **table_status_overview** - Real-time table status
3. **low_stock_inventory** - Items below reorder level

## 🚀 Fresh Installation

### Prerequisites

-   PostgreSQL 18.0+ installed
-   Database user with CREATE permissions
-   Command line access or pgAdmin

### Step 1: Create Database

```bash
# Using psql command line
psql -U postgres

# In psql prompt
CREATE DATABASE restaurant_db;
\c restaurant_db
```

Or using pgAdmin:

1. Right-click on Databases
2. Create → Database
3. Name: `restaurant_db`

### Step 2: Run Master Schema

```bash
# From command line
psql -U postgres -d restaurant_db -f database_master_schema.sql

# Or if you have a password
psql -U postgres -d restaurant_db -f database_master_schema.sql -W
```

Or using pgAdmin:

1. Connect to `restaurant_db`
2. Tools → Query Tool
3. Open File → Select `database_master_schema.sql`
4. Execute (F5)

### Step 3: Verify Installation

```sql
-- Check tables created
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- Check restaurant settings
SELECT * FROM restaurant_settings;

-- Expected output: 10 tables
```

## 🔄 Updating Existing Database

### Option 1: Fresh Start (Recommended for Development)

**⚠️ WARNING: This will delete all existing data!**

```sql
-- Backup first (IMPORTANT!)
pg_dump -U postgres restaurant_db > backup_$(date +%Y%m%d).sql

-- Drop and recreate
DROP DATABASE restaurant_db;
CREATE DATABASE restaurant_db;

-- Then run the master schema
\c restaurant_db
\i database_master_schema.sql
```

### Option 2: Selective Updates (For Production)

If you have existing data, apply only the changes:

```sql
-- Add new columns to existing tables
ALTER TABLE restaurant_settings
ADD COLUMN IF NOT EXISTS points_value DECIMAL(10, 2) DEFAULT 0.1;

-- Update values
UPDATE restaurant_settings
SET points_value = 0.1
WHERE points_value IS NULL;

-- Add comments
COMMENT ON COLUMN restaurant_settings.points_value IS 'Value of 1 loyalty point in currency';
```

## 📝 Features Included

### 1. Loyalty Points System

-   **Points Earning:** Configurable rate (default: 10 points per ₹100)
-   **Points Redemption:** Minimum 200 points required
-   **Points Value:** Configurable (default: 0.1 = 10 pts = ₹1)
-   **Tracking:** Points earned and redeemed per order

### 2. Table Management

-   **Status Tracking:** available, occupied, cleaning
-   **Cleaning Buffer:** 2-minute delay before available
-   **Table Validation:** Dine-in orders must have table
-   **Visual Indicators:** Grey out unavailable tables

### 3. Order Management

-   **Multiple Types:** dine_in, take_away, delivery
-   **Status Tracking:** pending, completed, cancelled
-   **Tax Configuration:** Configurable tax rate
-   **Order Numbers:** Unique auto-generated

### 4. Print Settings

-   **Print Preview:** Toggle on/off
-   **Bill Printing:** Direct print or preview first

### 5. Restaurant Settings

-   **Restaurant Info:** Name, address, contact
-   **Tax Configuration:** Customizable tax rate
-   **Loyalty Settings:** Enable/disable, configure rates

## 🔧 Configuration

### Default Settings

```sql
-- View current settings
SELECT * FROM restaurant_settings;

-- Update restaurant info
UPDATE restaurant_settings SET
    restaurant_name = 'Your Restaurant Name',
    address = 'Your Address',
    contact_number = 'Your Phone',
    tax_rate = 5.00;

-- Configure loyalty points
UPDATE restaurant_settings SET
    loyalty_points_enabled = true,
    loyalty_points_per_100 = 10,
    points_value = 0.1;
```

### Connection String

Update your `.env` file:

```env
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/restaurant_db
```

## 📦 Sample Data

The master schema includes **commented sample data**. To use it:

1. Open `database_master_schema.sql`
2. Find the "SAMPLE DATA" section (around line 350)
3. Uncomment the INSERT statements
4. Run the file again

Or insert manually:

```sql
-- Sample floor
INSERT INTO floors (name) VALUES ('Ground Floor');

-- Sample section
INSERT INTO sections (floor_id, name)
SELECT id, 'Main Dining' FROM floors WHERE name = 'Ground Floor';

-- Sample tables
INSERT INTO restaurant_tables (section_id, name, status)
SELECT id, 'Table 1', 'available' FROM sections WHERE name = 'Main Dining';
```

## 🧪 Testing Queries

### Check System Health

```sql
-- All tables available?
SELECT id, name, status
FROM restaurant_tables
ORDER BY name;

-- Active orders
SELECT order_number, customer_name, grand_total, status
FROM orders
WHERE status = 'pending';

-- Today's revenue
SELECT
    COUNT(*) AS orders,
    SUM(grand_total) AS revenue
FROM orders
WHERE DATE(created_at) = CURRENT_DATE
AND status != 'cancelled';

-- Customer loyalty points
SELECT name, mobile_number, loyalty_points
FROM customers
WHERE loyalty_points > 0
ORDER BY loyalty_points DESC;
```

### Test Loyalty Points

```sql
-- Add test customer
INSERT INTO customers (name, mobile_number, loyalty_points)
VALUES ('Test Customer', '9999999999', 250);

-- Create test order with redemption
-- (This would be done through the API, but you can verify points)
SELECT id, name, loyalty_points FROM customers WHERE mobile_number = '9999999999';
```

## 🛠️ Maintenance

### Regular Maintenance

```sql
-- Vacuum database (monthly)
VACUUM ANALYZE;

-- Update table statistics
ANALYZE;

-- Check database size
SELECT pg_size_pretty(pg_database_size('restaurant_db'));

-- Check table sizes
SELECT
    tablename,
    pg_size_pretty(pg_total_relation_size('public.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size('public.'||tablename) DESC;
```

### Backup Strategy

```bash
# Daily backup
pg_dump -U postgres restaurant_db > backup_daily.sql

# Weekly backup with timestamp
pg_dump -U postgres restaurant_db > backup_$(date +%Y%m%d).sql

# Backup specific table
pg_dump -U postgres -t orders restaurant_db > orders_backup.sql
```

### Restore from Backup

```bash
# Restore entire database
psql -U postgres restaurant_db < backup_daily.sql

# Restore specific table
psql -U postgres restaurant_db < orders_backup.sql
```

## 📊 Performance Optimization

### Indexes

All necessary indexes are included:

-   Customer mobile lookup
-   Order status and date
-   Table status
-   Foreign key relationships

### Query Optimization

```sql
-- Use the views for common queries
SELECT * FROM active_orders_view;
SELECT * FROM table_status_overview;
SELECT * FROM low_stock_inventory;

-- Index usage
SELECT schemaname, tablename, indexname
FROM pg_indexes
WHERE schemaname = 'public';
```

## 🔍 Troubleshooting

### Issue: Tables not created

```sql
-- Check if tables exist
\dt

-- Check for errors
SELECT * FROM pg_stat_activity WHERE datname = 'restaurant_db';
```

### Issue: Permissions error

```sql
-- Grant permissions
GRANT ALL PRIVILEGES ON DATABASE restaurant_db TO your_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO your_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO your_user;
```

### Issue: Duplicate data

```sql
-- Check for duplicates
SELECT order_number, COUNT(*)
FROM orders
GROUP BY order_number
HAVING COUNT(*) > 1;

-- Clean up duplicates (be careful!)
DELETE FROM orders
WHERE id NOT IN (
    SELECT MIN(id)
    FROM orders
    GROUP BY order_number
);
```

## 📚 Additional Resources

### Database Structure Diagram

```
restaurant_settings (1)
    ↓
orders (n) ← customers (n)
    ↓           ↑ loyalty_points
order_items (n)
    ↓
menu_items (n)
    ↓
recipes (n) → inventory (n)

floors (n)
    ↓
sections (n)
    ↓
restaurant_tables (n) ← orders (n)
```

### Relationships

-   **One-to-Many:**

    -   floors → sections
    -   sections → restaurant_tables
    -   customers → orders
    -   orders → order_items
    -   menu_items → recipes

-   **Many-to-Many:**
    -   menu_items ↔ inventory (via recipes)

## 🎯 Next Steps

After installing the database:

1. **Update Connection String**

    ```
    backend/.env
    DATABASE_URL=postgresql://...
    ```

2. **Start Backend Server**

    ```bash
    cd backend
    npm run dev
    ```

3. **Verify API Connection**

    ```bash
    curl http://localhost:4000/api/setting/settings
    ```

4. **Start Frontend**

    ```bash
    cd frontend
    npm run dev
    ```

5. **Test Features**
    - Create orders
    - Test loyalty points
    - Manage tables
    - Print bills

## ✅ Verification Checklist

After installation, verify:

-   [ ] 10 tables created
-   [ ] 3 views created
-   [ ] restaurant_settings has default data
-   [ ] All indexes created
-   [ ] Triggers working (check updated_at)
-   [ ] Foreign keys enforced
-   [ ] Backend can connect
-   [ ] API endpoints working
-   [ ] Frontend displays data

## 📞 Support

If you encounter issues:

1. Check PostgreSQL logs: `/var/log/postgresql/`
2. Verify PostgreSQL version: `psql --version`
3. Check connection: `psql -U postgres -d restaurant_db -c "\dt"`
4. Review error messages in backend console
5. Check network connectivity: `telnet localhost 5432`

## 📄 File Information

**File:** `database_master_schema.sql`  
**Created:** October 18, 2025  
**Version:** 1.0  
**Lines:** ~500+  
**Features:** Complete POS system with all updates

---

**Happy Installing! 🎉**

Your complete database schema is ready to use. This single file contains everything needed to set up your Restaurant POS System database from scratch.
