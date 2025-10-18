# Database Quick Reference Card

## 🚀 Quick Start

```bash
# Create database
psql -U postgres -c "CREATE DATABASE restaurant_db;"

# Run master schema
psql -U postgres -d restaurant_db -f database_master_schema.sql

# Verify
psql -U postgres -d restaurant_db -c "\dt"
```

## 📊 Table Summary

| Table                   | Purpose            | Key Columns                                    |
| ----------------------- | ------------------ | ---------------------------------------------- |
| **restaurant_settings** | Global config      | tax_rate, loyalty_points_enabled, points_value |
| **customers**           | Customer data      | name, mobile_number, loyalty_points            |
| **floors**              | Floor layouts      | name                                           |
| **sections**            | Sections in floors | floor_id, name                                 |
| **restaurant_tables**   | Tables             | section_id, name, status                       |
| **inventory**           | Stock items        | item_name, quantity, unit                      |
| **menu_items**          | Menu               | name, category, price, available               |
| **recipes**             | Ingredients        | menu_item_id, inventory_item_id, quantity_used |
| **orders**              | Customer orders    | order_number, customer_id, grand_total, status |
| **order_items**         | Order details      | order_id, menu_item_id, quantity, total_price  |

## 🔑 Key Relationships

```
customers (1) ──→ (n) orders
orders (1) ──→ (n) order_items
order_items (n) ──→ (1) menu_items
menu_items (1) ──→ (n) recipes
recipes (n) ──→ (1) inventory

floors (1) ──→ (n) sections
sections (1) ──→ (n) restaurant_tables
restaurant_tables (1) ──→ (n) orders
```

## 📝 Common Queries

### Check System Status

```sql
-- Restaurant settings
SELECT * FROM restaurant_settings;

-- Active orders
SELECT * FROM active_orders_view;

-- Table status
SELECT * FROM table_status_overview;

-- Low stock
SELECT * FROM low_stock_inventory;
```

### Today's Stats

```sql
-- Today's revenue
SELECT
    COUNT(*) AS orders,
    SUM(grand_total) AS revenue,
    AVG(grand_total) AS avg_order
FROM orders
WHERE DATE(created_at) = CURRENT_DATE
AND status != 'cancelled';

-- Active tables
SELECT COUNT(*)
FROM restaurant_tables
WHERE status = 'occupied';

-- Pending orders
SELECT COUNT(*)
FROM orders
WHERE status = 'pending';
```

### Customer Insights

```sql
-- Top customers by points
SELECT name, mobile_number, loyalty_points
FROM customers
WHERE loyalty_points > 0
ORDER BY loyalty_points DESC
LIMIT 10;

-- Customers with high points
SELECT COUNT(*)
FROM customers
WHERE loyalty_points >= 200;

-- Total points in circulation
SELECT SUM(loyalty_points)
FROM customers;
```

### Revenue Analytics

```sql
-- Last 7 days revenue
SELECT
    DATE(created_at) AS date,
    COUNT(*) AS orders,
    SUM(grand_total) AS revenue
FROM orders
WHERE created_at >= NOW() - INTERVAL '7 days'
AND status != 'cancelled'
GROUP BY DATE(created_at)
ORDER BY date;

-- Monthly comparison
SELECT
    DATE_TRUNC('month', created_at) AS month,
    SUM(grand_total) AS revenue
FROM orders
WHERE status != 'cancelled'
GROUP BY month
ORDER BY month DESC;
```

## 🔧 Configuration Queries

### Update Restaurant Settings

```sql
-- Update restaurant info
UPDATE restaurant_settings SET
    restaurant_name = 'Your Restaurant',
    address = 'Your Address',
    contact_number = '555-1234',
    tax_rate = 5.00;

-- Configure loyalty points
UPDATE restaurant_settings SET
    loyalty_points_enabled = true,
    loyalty_points_per_100 = 10,
    points_value = 0.1;

-- Toggle print preview
UPDATE restaurant_settings SET
    print_preview_enabled = true;
```

### Manage Tables

```sql
-- List all tables
SELECT
    f.name AS floor,
    s.name AS section,
    rt.name AS table,
    rt.status
FROM restaurant_tables rt
JOIN sections s ON rt.section_id = s.id
JOIN floors f ON s.floor_id = f.id
ORDER BY f.name, s.name, rt.name;

-- Reset table status
UPDATE restaurant_tables
SET status = 'available', updated_at = NOW()
WHERE id = 'table-uuid-here';

-- Reset all tables
UPDATE restaurant_tables
SET status = 'available', updated_at = NOW();
```

## 🎯 Business Logic

### Loyalty Points

```
Earning:
  points = floor((order_total / 100) * loyalty_points_per_100)
  Default: ₹100 → 10 points

Redemption:
  discount = points_redeemed * points_value
  Default: 10 points → ₹1
  Minimum: 200 points to redeem
```

### Table Status Flow

```
available → occupied → cleaning (2 min) → available
```

### Order Status Flow

```
pending → completed (or cancelled)
```

## 🔍 Troubleshooting

### Reset Stuck Tables

```sql
-- Find stuck tables
SELECT id, name, status, updated_at
FROM restaurant_tables
WHERE status != 'available';

-- Fix stuck tables
UPDATE restaurant_tables
SET status = 'available', updated_at = NOW()
WHERE status IN ('occupied', 'cleaning', 'paid');
```

### Verify Data Integrity

```sql
-- Orders without items
SELECT o.id, o.order_number
FROM orders o
LEFT JOIN order_items oi ON o.id = oi.order_id
WHERE oi.id IS NULL;

-- Orphaned order items
SELECT oi.id
FROM order_items oi
LEFT JOIN orders o ON oi.order_id = o.id
WHERE o.id IS NULL;

-- Check totals match
SELECT
    o.id,
    o.subtotal AS stored_subtotal,
    SUM(oi.total_price) AS calculated_subtotal,
    o.subtotal - SUM(oi.total_price) AS difference
FROM orders o
JOIN order_items oi ON o.id = oi.order_id
GROUP BY o.id, o.subtotal
HAVING o.subtotal != SUM(oi.total_price);
```

### Performance Check

```sql
-- Slow queries
SELECT
    query,
    calls,
    total_time,
    mean_time
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;

-- Table sizes
SELECT
    tablename,
    pg_size_pretty(pg_total_relation_size('public.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size('public.'||tablename) DESC;

-- Index usage
SELECT
    schemaname,
    tablename,
    indexname,
    idx_scan AS scans
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan ASC;
```

## 💾 Backup & Restore

### Backup

```bash
# Full backup
pg_dump -U postgres restaurant_db > backup.sql

# With timestamp
pg_dump -U postgres restaurant_db > backup_$(date +%Y%m%d_%H%M%S).sql

# Compressed backup
pg_dump -U postgres restaurant_db | gzip > backup.sql.gz

# Specific table
pg_dump -U postgres -t orders restaurant_db > orders_backup.sql
```

### Restore

```bash
# From backup
psql -U postgres restaurant_db < backup.sql

# Compressed
gunzip -c backup.sql.gz | psql -U postgres restaurant_db

# Drop and recreate first
dropdb -U postgres restaurant_db
createdb -U postgres restaurant_db
psql -U postgres restaurant_db < backup.sql
```

## 🛠️ Maintenance

### Regular Tasks

```sql
-- Vacuum (weekly)
VACUUM ANALYZE;

-- Reindex (monthly)
REINDEX DATABASE restaurant_db;

-- Update stats
ANALYZE;
```

### Clean Old Data

```sql
-- Remove old cancelled orders (30+ days)
DELETE FROM orders
WHERE status = 'cancelled'
AND created_at < NOW() - INTERVAL '30 days';

-- Archive completed orders (6+ months)
INSERT INTO orders_archive
SELECT * FROM orders
WHERE status = 'completed'
AND created_at < NOW() - INTERVAL '6 months';

DELETE FROM orders
WHERE status = 'completed'
AND created_at < NOW() - INTERVAL '6 months';
```

## 📡 Connection Info

### Environment Variables

```env
DATABASE_URL=postgresql://postgres:password@localhost:5432/restaurant_db
```

### Connection String Parts

```
postgresql://[user]:[password]@[host]:[port]/[database]
```

### Test Connection

```bash
# psql
psql -U postgres -d restaurant_db -c "SELECT version();"

# curl (via API)
curl http://localhost:4000/api/setting/settings
```

## 🎨 Default Values

| Setting                | Default           |
| ---------------------- | ----------------- |
| Tax Rate               | 5.00%             |
| Loyalty Points Enabled | true              |
| Points per ₹100        | 10                |
| Points Value           | 0.1 (10 pts = ₹1) |
| Print Preview          | false             |
| Table Status           | available         |
| Order Status           | pending           |
| Customer Points        | 0                 |

## 📞 Support Commands

```bash
# Check PostgreSQL version
psql --version

# Check if PostgreSQL is running
pg_isready

# Restart PostgreSQL (Linux)
sudo systemctl restart postgresql

# View PostgreSQL logs
sudo tail -f /var/log/postgresql/postgresql-*.log

# Check database size
psql -U postgres -c "SELECT pg_size_pretty(pg_database_size('restaurant_db'));"

# List all databases
psql -U postgres -c "\l"

# List all tables
psql -U postgres -d restaurant_db -c "\dt"

# Describe table
psql -U postgres -d restaurant_db -c "\d orders"
```

## ✅ Health Check Script

```sql
-- Run this to verify database health
DO $$
DECLARE
    table_count INT;
    view_count INT;
    settings_count INT;
BEGIN
    SELECT COUNT(*) INTO table_count FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
    SELECT COUNT(*) INTO view_count FROM information_schema.views WHERE table_schema = 'public';
    SELECT COUNT(*) INTO settings_count FROM restaurant_settings;

    RAISE NOTICE 'Tables: %', table_count;
    RAISE NOTICE 'Views: %', view_count;
    RAISE NOTICE 'Settings records: %', settings_count;

    IF table_count >= 10 AND view_count >= 3 AND settings_count >= 1 THEN
        RAISE NOTICE '✅ Database healthy!';
    ELSE
        RAISE NOTICE '⚠️ Database incomplete!';
    END IF;
END $$;
```

---

## 📚 Files Reference

-   **database_master_schema.sql** - Complete database schema
-   **DATABASE_INSTALLATION_GUIDE.md** - Installation instructions
-   **DATABASE_CHANGES_LOG.md** - Complete change history
-   **DATABASE_QUICK_REFERENCE.md** - This file

---

**Quick Links:**

-   Connection: `postgresql://postgres:password@localhost:5432/restaurant_db`
-   Backend API: `http://localhost:4000/api`
-   Frontend: `http://localhost:5173`

**Need Help?**

1. Check logs: Backend terminal
2. Test connection: `psql -U postgres -d restaurant_db`
3. Verify schema: `\dt` in psql
4. Check API: `curl http://localhost:4000/api/setting/settings`
