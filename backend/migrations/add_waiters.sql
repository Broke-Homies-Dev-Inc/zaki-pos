-- Migration: Add Waiters Table and Update Orders
-- Description: Add waiter management system where a single waiter is responsible
--              for an order from start to finish (taking order, serving, billing)
-- Date: 2025-11-26
-- Author: Zaki POS System

-- =====================================================
-- 1. CREATE WAITERS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS waiters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    employee_id VARCHAR(50) UNIQUE NOT NULL,
    phone_number VARCHAR(20),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'on_break')),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_waiters_status ON waiters(status);
CREATE INDEX IF NOT EXISTS idx_waiters_employee_id ON waiters(employee_id);

-- =====================================================
-- 2. UPDATE ORDERS TABLE
-- =====================================================
-- Add waiter_id column to orders table
-- A single waiter is assigned to an order and handles everything
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS waiter_id UUID REFERENCES waiters(id) ON DELETE SET NULL;

-- Create index for faster waiter-order lookups
CREATE INDEX IF NOT EXISTS idx_orders_waiter_id ON orders(waiter_id);

-- =====================================================
-- 3. UPDATE BILLS TABLE (if exists)
-- =====================================================
-- Note: The waiter who settles the bill is the same waiter assigned to the order
-- No separate waiter_id needed in bills table as it can be retrieved from orders

-- =====================================================
-- 4. CREATE WAITER PERFORMANCE VIEW
-- =====================================================
-- This view helps track waiter performance
CREATE OR REPLACE VIEW waiter_performance AS
SELECT 
    w.id AS waiter_id,
    w.name AS waiter_name,
    w.employee_id,
    w.status,
    COUNT(o.id) AS total_orders,
    COUNT(CASE WHEN o.status = 'completed' THEN 1 END) AS completed_orders,
    COUNT(CASE WHEN o.status = 'pending' THEN 1 END) AS pending_orders,
    COUNT(CASE WHEN o.status = 'cancelled' THEN 1 END) AS cancelled_orders,
    COALESCE(SUM(CASE WHEN o.status = 'completed' THEN o.grand_total ELSE 0 END), 0) AS total_sales,
    COALESCE(AVG(CASE WHEN o.status = 'completed' THEN o.grand_total END), 0) AS avg_order_value
FROM waiters w
LEFT JOIN orders o ON w.id = o.waiter_id
GROUP BY w.id, w.name, w.employee_id, w.status;

-- =====================================================
-- 5. CREATE ACTIVE WAITER ORDERS VIEW
-- =====================================================
-- This view shows currently active orders per waiter
CREATE OR REPLACE VIEW active_waiter_orders AS
SELECT 
    w.id AS waiter_id,
    w.name AS waiter_name,
    w.employee_id,
    o.id AS order_id,
    o.order_number,
    o.order_type,
    o.status AS order_status,
    o.grand_total,
    o.created_at AS order_created_at,
    rt.name AS table_name,
    s.name AS section_name,
    f.name AS floor_name
FROM waiters w
INNER JOIN orders o ON w.id = o.waiter_id
LEFT JOIN restaurant_tables rt ON o.restaurant_table_id = rt.id
LEFT JOIN sections s ON rt.section_id = s.id
LEFT JOIN floors f ON s.floor_id = f.id
WHERE o.status IN ('pending')
ORDER BY o.created_at DESC;

-- =====================================================
-- 6. ADD SAMPLE WAITERS (Optional - for testing)
-- =====================================================
-- Uncomment the following lines to add sample waiters
/*
INSERT INTO waiters (name, employee_id, phone_number, status) VALUES
    ('John Doe', 'W001', '+1234567890', 'active'),
    ('Jane Smith', 'W002', '+1234567891', 'active'),
    ('Mike Johnson', 'W003', '+1234567892', 'active'),
    ('Sarah Williams', 'W004', '+1234567893', 'on_break'),
    ('Tom Brown', 'W005', '+1234567894', 'inactive');
*/

-- =====================================================
-- 7. CREATE TRIGGER TO UPDATE updated_at
-- =====================================================
CREATE OR REPLACE FUNCTION update_waiters_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_waiters_timestamp
    BEFORE UPDATE ON waiters
    FOR EACH ROW
    EXECUTE FUNCTION update_waiters_updated_at();

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
-- Summary:
-- ✓ Created waiters table with employee management fields
-- ✓ Added waiter_id to orders table (single waiter per order)
-- ✓ Created performance tracking views
-- ✓ Added necessary indexes for performance
-- ✓ Added trigger for automatic timestamp updates
--
-- Next Steps:
-- 1. Run this migration: psql -U postgres -d zaki_db -f add_waiters.sql
-- 2. Update backend API routes to include waiter assignment
-- 3. Update frontend to show waiter selection and information
-- 4. Test waiter assignment workflow
