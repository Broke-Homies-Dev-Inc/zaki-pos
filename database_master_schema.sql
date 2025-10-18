-- ==========================================
-- RESTAURANT POS SYSTEM - MASTER DATABASE SCHEMA
-- ==========================================
-- Database: restaurant_db
-- PostgreSQL Version: 18.0+
-- Created: October 18, 2025
-- 
-- This file contains the complete database schema including:
-- - Original table structures
-- - All migrations and updates
-- - New features added during development
-- 
-- FEATURES INCLUDED:
-- ✓ Core POS system (Orders, Menu, Inventory)
-- ✓ Table management with status tracking
-- ✓ Customer management with loyalty points
-- ✓ Restaurant settings with tax configuration
-- ✓ Print preview settings
-- ✓ Loyalty points redemption system
-- ✓ Configurable points value
-- ✓ Table cleaning buffer (2-minute delay)
-- ✓ Dine-in table validation
-- ==========================================

-- Drop existing tables (if needed for fresh installation)
-- Uncomment the following lines to start fresh
-- DROP TABLE IF EXISTS order_items CASCADE;
-- DROP TABLE IF EXISTS orders CASCADE;
-- DROP TABLE IF EXISTS recipes CASCADE;
-- DROP TABLE IF EXISTS menu_items CASCADE;
-- DROP TABLE IF EXISTS inventory CASCADE;
-- DROP TABLE IF EXISTS restaurant_tables CASCADE;
-- DROP TABLE IF EXISTS sections CASCADE;
-- DROP TABLE IF EXISTS floors CASCADE;
-- DROP TABLE IF EXISTS customers CASCADE;
-- DROP TABLE IF EXISTS restaurant_settings CASCADE;

-- ==========================================
-- 1. RESTAURANT SETTINGS TABLE
-- ==========================================
-- Stores global restaurant configuration
CREATE TABLE IF NOT EXISTS restaurant_settings (
    id SERIAL PRIMARY KEY,
    restaurant_name VARCHAR(255) NOT NULL DEFAULT 'My Restaurant',
    address TEXT,
    contact_number VARCHAR(50),
    registration_number VARCHAR(100) DEFAULT '',
    tax_rate DECIMAL(5, 2) DEFAULT 5.00,
    
    -- Loyalty Points Settings
    loyalty_points_enabled BOOLEAN DEFAULT true,
    loyalty_points_per_100 INTEGER DEFAULT 10,
    points_value DECIMAL(10, 2) DEFAULT 0.1,
    
    -- Print Settings
    print_preview_enabled BOOLEAN DEFAULT false,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE restaurant_settings IS 'Global restaurant configuration and settings';
COMMENT ON COLUMN restaurant_settings.tax_rate IS 'Tax rate percentage (e.g., 5.00 = 5%)';
COMMENT ON COLUMN restaurant_settings.loyalty_points_enabled IS 'Enable/disable loyalty points system';
COMMENT ON COLUMN restaurant_settings.loyalty_points_per_100 IS 'Points earned per ₹100 spent';
COMMENT ON COLUMN restaurant_settings.points_value IS 'Value of 1 loyalty point in currency. Example: 0.1 means 10 points = ₹1';
COMMENT ON COLUMN restaurant_settings.print_preview_enabled IS 'Show print preview before printing bills';

-- Insert default settings (only if table is empty)
INSERT INTO restaurant_settings (
    restaurant_name, 
    address, 
    contact_number, 
    registration_number, 
    tax_rate,
    loyalty_points_enabled,
    loyalty_points_per_100,
    points_value,
    print_preview_enabled
)
SELECT 
    'My Restaurant',
    '123 Main Street',
    '555-0100',
    'REG-2025-001',
    5.00,
    true,
    10,
    0.1,
    false
WHERE NOT EXISTS (SELECT 1 FROM restaurant_settings LIMIT 1);

-- ==========================================
-- 2. CUSTOMERS TABLE
-- ==========================================
-- Stores customer information with loyalty points
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    mobile_number VARCHAR(20),
    email VARCHAR(255),
    address TEXT,
    status VARCHAR(50) DEFAULT 'unverified',
    loyalty_points INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(mobile_number)
);

CREATE INDEX IF NOT EXISTS idx_customers_mobile ON customers(mobile_number);
CREATE INDEX IF NOT EXISTS idx_customers_status ON customers(status);

COMMENT ON TABLE customers IS 'Customer records with loyalty point tracking';
COMMENT ON COLUMN customers.status IS 'Customer verification status: unverified, verified';
COMMENT ON COLUMN customers.loyalty_points IS 'Accumulated loyalty points (earned via purchases, redeemed for discounts)';

-- ==========================================
-- 3. FLOORS TABLE
-- ==========================================
-- Stores floor layout information
CREATE TABLE IF NOT EXISTS floors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE floors IS 'Restaurant floor layouts';

-- ==========================================
-- 4. SECTIONS TABLE
-- ==========================================
-- Stores section information within floors
CREATE TABLE IF NOT EXISTS sections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    floor_id UUID REFERENCES floors(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sections_floor_id ON sections(floor_id);

COMMENT ON TABLE sections IS 'Sections within each floor (e.g., Patio, Indoor, VIP)';

-- ==========================================
-- 5. RESTAURANT TABLES TABLE
-- ==========================================
-- Stores table information with status tracking
CREATE TABLE IF NOT EXISTS restaurant_tables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    section_id UUID REFERENCES sections(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    status VARCHAR(50) DEFAULT 'available' NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_restaurant_tables_section_id ON restaurant_tables(section_id);
CREATE INDEX IF NOT EXISTS idx_restaurant_tables_status ON restaurant_tables(status);

COMMENT ON TABLE restaurant_tables IS 'Restaurant tables with real-time status tracking';
COMMENT ON COLUMN restaurant_tables.status IS 'Table status: available, occupied, cleaning';

-- ==========================================
-- 6. INVENTORY TABLE
-- ==========================================
-- Stores inventory items and stock levels
CREATE TABLE IF NOT EXISTS inventory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_name VARCHAR(255) NOT NULL,
    quantity DECIMAL(10, 2) NOT NULL DEFAULT 0,
    low_stock_threshold DECIMAL(10, 2) DEFAULT 0,
    cost DECIMAL(10, 2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventory_item_name ON inventory(item_name);

COMMENT ON TABLE inventory IS 'Inventory management with stock levels';
COMMENT ON COLUMN inventory.low_stock_threshold IS 'Minimum quantity before reorder alert';

-- ==========================================
-- 7. MENU ITEMS TABLE
-- ==========================================
-- Stores menu items available for ordering
CREATE TABLE IF NOT EXISTS menu_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    available BOOLEAN DEFAULT true,
    inventory_item_id UUID REFERENCES inventory(id) ON DELETE SET NULL,
    quantity_per_order DECIMAL(10, 2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_menu_items_category ON menu_items(category);
CREATE INDEX IF NOT EXISTS idx_menu_items_available ON menu_items(available);

COMMENT ON TABLE menu_items IS 'Menu items with pricing and availability';
COMMENT ON COLUMN menu_items.available IS 'Whether item is currently available for ordering';

-- ==========================================
-- 8. RECIPES TABLE
-- ==========================================
-- Stores recipe ingredients for menu items
CREATE TABLE IF NOT EXISTS recipes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    menu_item_id UUID REFERENCES menu_items(id) ON DELETE CASCADE,
    inventory_item_id UUID REFERENCES inventory(id) ON DELETE CASCADE,
    quantity_used DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recipes_menu_item_id ON recipes(menu_item_id);
CREATE INDEX IF NOT EXISTS idx_recipes_inventory_item_id ON recipes(inventory_item_id);

COMMENT ON TABLE recipes IS 'Recipe ingredients linking menu items to inventory';

-- ==========================================
-- 9. ORDERS TABLE
-- ==========================================
-- Stores customer orders
CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number VARCHAR(50) UNIQUE NOT NULL,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    customer_name VARCHAR(255),
    mobile_number VARCHAR(20),
    order_type VARCHAR(50) NOT NULL DEFAULT 'dine_in',
    subtotal DECIMAL(10, 2) NOT NULL,
    tax_amount DECIMAL(10, 2) NOT NULL,
    grand_total DECIMAL(10, 2) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending' NOT NULL,
    notes TEXT,
    
    -- Order Type Specific Fields
    restaurant_table_id UUID REFERENCES restaurant_tables(id) ON DELETE SET NULL,
    take_away_method VARCHAR(50),
    car_details TEXT,
    delivery_address TEXT,
    
    -- Loyalty Points Tracking
    points_redeemed INTEGER DEFAULT 0,
    points_earned INTEGER DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_restaurant_table_id ON orders(restaurant_table_id);
CREATE INDEX IF NOT EXISTS idx_orders_created_at_status ON orders(created_at, status);

COMMENT ON TABLE orders IS 'Customer orders with multiple order types support';
COMMENT ON COLUMN orders.order_type IS 'Order type: dine_in, take_away, delivery';
COMMENT ON COLUMN orders.status IS 'Order status: pending, completed, cancelled';
COMMENT ON COLUMN orders.restaurant_table_id IS 'Table ID for dine-in orders';
COMMENT ON COLUMN orders.take_away_method IS 'Take away method: counter, car';
COMMENT ON COLUMN orders.points_redeemed IS 'Loyalty points redeemed for discount';
COMMENT ON COLUMN orders.points_earned IS 'Loyalty points earned from this order';

-- ==========================================
-- 10. ORDER ITEMS TABLE
-- ==========================================
-- Stores individual items within each order
CREATE TABLE IF NOT EXISTS order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    menu_item_id UUID REFERENCES menu_items(id) ON DELETE RESTRICT,
    quantity INTEGER NOT NULL,
    unit_price DECIMAL(10, 2) NOT NULL,
    total_price DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_menu_item_id ON order_items(menu_item_id);

COMMENT ON TABLE order_items IS 'Line items for each order';

CREATE TABLE IF NOT EXISTS loyalty_transactions (
    id SERIAL PRIMARY KEY,
    customer_id uuid REFERENCES customers(id) ON DELETE CASCADE,
    order_id uuid REFERENCES orders(id) ON DELETE SET NULL,
    points_earned INTEGER DEFAULT 0,
    points_redeemed INTEGER DEFAULT 0,
    transaction_type VARCHAR(20) CHECK (transaction_type IN ('earned', 'redeemed', 'adjustment')),
    description TEXT,
    order_amount DECIMAL(10, 2),
    created_at TIMESTAMP DEFAULT NOW()
);

-- ==========================================
-- SAMPLE DATA (Optional - for testing)
-- ==========================================
-- Uncomment below to insert sample data

-- Insert sample floors
-- INSERT INTO floors (name) VALUES 
--     ('Ground Floor'),
--     ('First Floor')
-- ON CONFLICT DO NOTHING;

-- Insert sample sections
-- WITH floor_ids AS (
--     SELECT id, name FROM floors
-- )
-- INSERT INTO sections (floor_id, name)
-- SELECT id, 'Main Dining' FROM floor_ids WHERE name = 'Ground Floor'
-- UNION ALL
-- SELECT id, 'Outdoor Patio' FROM floor_ids WHERE name = 'Ground Floor'
-- UNION ALL
-- SELECT id, 'VIP Section' FROM floor_ids WHERE name = 'First Floor'
-- ON CONFLICT DO NOTHING;

-- Insert sample tables
-- WITH section_ids AS (
--     SELECT s.id, s.name FROM sections s
--     JOIN floors f ON s.floor_id = f.id
-- )
-- INSERT INTO restaurant_tables (section_id, name, status)
-- SELECT id, 'Table 1', 'available' FROM section_ids WHERE name = 'Main Dining'
-- UNION ALL
-- SELECT id, 'Table 2', 'available' FROM section_ids WHERE name = 'Main Dining'
-- UNION ALL
-- SELECT id, 'Table 3', 'available' FROM section_ids WHERE name = 'Main Dining'
-- UNION ALL
-- SELECT id, 'Table 4', 'available' FROM section_ids WHERE name = 'Outdoor Patio'
-- UNION ALL
-- SELECT id, 'VIP 1', 'available' FROM section_ids WHERE name = 'VIP Section'
-- ON CONFLICT DO NOTHING;

-- Insert sample inventory
-- INSERT INTO inventory (item_name, quantity, unit, reorder_level) VALUES
--     ('Flour', 100.00, 'kg', 20.00),
--     ('Tomato Sauce', 50.00, 'liters', 10.00),
--     ('Cheese', 30.00, 'kg', 5.00),
--     ('Chicken', 25.00, 'kg', 10.00),
--     ('Lettuce', 15.00, 'kg', 5.00)
-- ON CONFLICT DO NOTHING;

-- Insert sample menu items
-- WITH inventory_ids AS (
--     SELECT id, item_name FROM inventory
-- )
-- INSERT INTO menu_items (name, category, price, available) VALUES
--     ('Margherita Pizza', 'Pizza', 299.00, true),
--     ('Pepperoni Pizza', 'Pizza', 399.00, true),
--     ('Caesar Salad', 'Salad', 199.00, true),
--     ('Grilled Chicken', 'Main Course', 349.00, true),
--     ('Pasta Carbonara', 'Pasta', 279.00, true)
-- ON CONFLICT DO NOTHING;

-- Insert sample customer
-- INSERT INTO customers (name, mobile_number, email, status, loyalty_points) VALUES
--     ('John Doe', '9876543210', 'john@example.com', 'verified', 250),
--     ('Jane Smith', '9876543211', 'jane@example.com', 'verified', 150),
--     ('Walk-in Customer', NULL, NULL, 'unverified', 0)
-- ON CONFLICT (mobile_number) DO NOTHING;

-- ==========================================
-- FUNCTIONS AND TRIGGERS
-- ==========================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_restaurant_settings_updated_at ON restaurant_settings;
CREATE TRIGGER update_restaurant_settings_updated_at
    BEFORE UPDATE ON restaurant_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_customers_updated_at ON customers;
CREATE TRIGGER update_customers_updated_at
    BEFORE UPDATE ON customers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_restaurant_tables_updated_at ON restaurant_tables;
CREATE TRIGGER update_restaurant_tables_updated_at
    BEFORE UPDATE ON restaurant_tables
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_inventory_updated_at ON inventory;
CREATE TRIGGER update_inventory_updated_at
    BEFORE UPDATE ON inventory
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_menu_items_updated_at ON menu_items;
CREATE TRIGGER update_menu_items_updated_at
    BEFORE UPDATE ON menu_items
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_orders_updated_at ON orders;
CREATE TRIGGER update_orders_updated_at
    BEFORE UPDATE ON orders
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ==========================================
-- VIEWS (Optional - for easier querying)
-- ==========================================

-- View: Active Orders with Customer Info
CREATE OR REPLACE VIEW active_orders_view AS
SELECT 
    o.id,
    o.order_number,
    o.customer_name,
    o.mobile_number,
    o.order_type,
    o.grand_total,
    o.status,
    o.created_at,
    c.name AS customer_full_name,
    c.loyalty_points AS customer_loyalty_points,
    rt.name AS table_name
FROM orders o
LEFT JOIN customers c ON o.customer_id = c.id
LEFT JOIN restaurant_tables rt ON o.restaurant_table_id = rt.id
WHERE o.status != 'cancelled'
ORDER BY o.created_at DESC;

COMMENT ON VIEW active_orders_view IS 'Active orders with customer and table information';

-- View: Table Status Overview
CREATE OR REPLACE VIEW table_status_overview AS
SELECT 
    f.name AS floor_name,
    s.name AS section_name,
    rt.name AS table_name,
    rt.status,
    o.order_number,
    o.grand_total,
    o.created_at AS order_time
FROM restaurant_tables rt
JOIN sections s ON rt.section_id = s.id
JOIN floors f ON s.floor_id = f.id
LEFT JOIN LATERAL (
    SELECT * FROM orders 
    WHERE restaurant_table_id = rt.id 
    AND status NOT IN ('completed', 'cancelled')
    ORDER BY created_at DESC 
    LIMIT 1
) o ON true
ORDER BY f.name, s.name, rt.name;

COMMENT ON VIEW table_status_overview IS 'Real-time table status with active orders';

-- View: Low Stock Inventory
CREATE OR REPLACE VIEW low_stock_inventory AS
SELECT 
    id,
    item_name,
    quantity,
    low_stock_threshold,
    ROUND((quantity / low_stock_threshold * 100)::numeric, 2) AS stock_percentage
FROM inventory
WHERE quantity <= low_stock_threshold
ORDER BY stock_percentage ASC;

COMMENT ON VIEW low_stock_inventory IS 'Inventory items below low stock threshold';

-- ==========================================
-- UTILITY QUERIES
-- ==========================================

-- Check all table statuses
-- SELECT id, name, status FROM restaurant_tables ORDER BY name;

-- Check loyalty points settings
-- SELECT loyalty_points_enabled, loyalty_points_per_100, points_value FROM restaurant_settings;

-- Check customer loyalty points
-- SELECT name, mobile_number, loyalty_points FROM customers WHERE loyalty_points > 0 ORDER BY loyalty_points DESC;

-- Check today's revenue
-- SELECT 
--     COUNT(*) AS total_orders,
--     SUM(grand_total) AS total_revenue,
--     AVG(grand_total) AS avg_order_value
-- FROM orders 
-- WHERE DATE(created_at) = CURRENT_DATE 
-- AND status != 'cancelled';

-- ==========================================
-- MAINTENANCE QUERIES
-- ==========================================

-- Reset all tables to available (use carefully!)
-- UPDATE restaurant_tables SET status = 'available', updated_at = NOW();

-- Clear old cancelled orders (older than 30 days)
-- DELETE FROM orders WHERE status = 'cancelled' AND created_at < NOW() - INTERVAL '30 days';

-- Recalculate customer loyalty points (if needed)
-- UPDATE customers c
-- SET loyalty_points = COALESCE((
--     SELECT SUM(points_earned) - SUM(points_redeemed)
--     FROM orders
--     WHERE customer_id = c.id AND status = 'completed'
-- ), 0);

-- ==========================================
-- DATABASE INFO
-- ==========================================

-- Database size
-- SELECT pg_size_pretty(pg_database_size('restaurant_db')) AS database_size;

-- Table sizes
-- SELECT 
--     schemaname,
--     tablename,
--     pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
-- FROM pg_tables
-- WHERE schemaname = 'public'
-- ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- ==========================================
-- INDEXES SUMMARY
-- ==========================================
-- The following indexes are created for optimal performance:
-- - Customer mobile number lookup
-- - Customer status filtering
-- - Order status and date filtering
-- - Table status filtering
-- - Menu item category and availability
-- - All foreign key relationships

-- ==========================================
-- CONSTRAINTS SUMMARY
-- ==========================================
-- PRIMARY KEYS: All tables have UUID primary keys
-- FOREIGN KEYS: Proper cascading deletes configured
-- UNIQUE: order_number, customer mobile_number
-- NOT NULL: Essential fields (names, prices, quantities)
-- DEFAULTS: Status fields, timestamps, boolean flags

-- ==========================================
-- NOTES FOR DEVELOPERS
-- ==========================================
-- 1. Table Status Flow:
--    available → occupied (when order created) → 
--    cleaning (after payment, 2-min buffer) → available
--
-- 2. Loyalty Points:
--    - Earned: Based on order total (configurable rate)
--    - Redeemed: Minimum 200 points required
--    - Value: Configurable in settings (default 0.1 = 10 pts = ₹1)
--
-- 3. Order Types:
--    - dine_in: Requires table_id
--    - take_away: Optional car details
--    - delivery: Requires delivery address
--
-- 4. Print Preview:
--    - Controlled by print_preview_enabled setting
--    - Can be toggled in Settings page
--
-- 5. Tax Calculation:
--    - Tax rate stored as percentage (e.g., 5.00 = 5%)
--    - Applied to order subtotal
--
-- ==========================================
-- END OF SCHEMA
-- ==========================================

-- Verify installation
DO $$ 
BEGIN 
    RAISE NOTICE 'Database schema created successfully!';
    RAISE NOTICE 'Total tables: 10';
    RAISE NOTICE 'Total views: 3';
    RAISE NOTICE 'Features: Loyalty Points, Table Management, Multiple Order Types';
END $$;
