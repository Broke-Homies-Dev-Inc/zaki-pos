-- Common Waiter Queries Reference
-- Description: Useful SQL queries for working with the waiter system
-- Date: 2025-11-26
-- Note: Single waiter is responsible for entire order from start to finish

-- =====================================================
-- WAITER MANAGEMENT QUERIES
-- =====================================================

-- 1. Get all active waiters
SELECT id, name, employee_id, phone_number, status 
FROM waiters 
WHERE status = 'active'
ORDER BY name;

-- 2. Get all waiters with their current order count
SELECT 
    w.id,
    w.name,
    w.employee_id,
    w.status,
    COUNT(o.id) FILTER (WHERE o.status = 'pending') AS active_orders,
    COUNT(o.id) FILTER (WHERE o.status = 'completed' AND o.created_at::date = CURRENT_DATE) AS completed_today
FROM waiters w
LEFT JOIN orders o ON w.id = o.waiter_id
GROUP BY w.id, w.name, w.employee_id, w.status
ORDER BY active_orders DESC, w.name;

-- 3. Add a new waiter
INSERT INTO waiters (name, employee_id, phone_number, status) 
VALUES ('New Waiter Name', 'W006', '+1234567895', 'active')
RETURNING id, name, employee_id;

-- 4. Update waiter status
UPDATE waiters 
SET status = 'on_break' 
WHERE employee_id = 'W001';

-- 5. Deactivate a waiter
UPDATE waiters 
SET status = 'inactive' 
WHERE id = 'waiter-uuid-here';

-- =====================================================
-- ORDER ASSIGNMENT QUERIES
-- =====================================================

-- 6. Assign waiter to an order (when creating order)
UPDATE orders 
SET waiter_id = 'waiter-uuid-here' 
WHERE id = 'order-uuid-here';

-- 7. Get all orders for a specific waiter
SELECT 
    o.id,
    o.order_number,
    o.order_type,
    o.status,
    o.grand_total,
    o.created_at,
    rt.name AS table_name,
    c.name AS customer_name
FROM orders o
LEFT JOIN restaurant_tables rt ON o.restaurant_table_id = rt.id
LEFT JOIN customers c ON o.customer_id = c.id
WHERE o.waiter_id = 'waiter-uuid-here'
ORDER BY o.created_at DESC;

-- 8. Get pending orders for a waiter
SELECT 
    o.id,
    o.order_number,
    o.order_type,
    rt.name AS table_name,
    o.grand_total,
    o.created_at
FROM orders o
LEFT JOIN restaurant_tables rt ON o.restaurant_table_id = rt.id
WHERE o.waiter_id = 'waiter-uuid-here' 
  AND o.status = 'pending'
ORDER BY o.created_at ASC;

-- =====================================================
-- PERFORMANCE AND REPORTING QUERIES
-- =====================================================

-- 9. Get waiter performance for today
SELECT 
    w.name,
    w.employee_id,
    COUNT(o.id) AS total_orders,
    COUNT(CASE WHEN o.status = 'completed' THEN 1 END) AS completed_orders,
    COALESCE(SUM(CASE WHEN o.status = 'completed' THEN o.grand_total ELSE 0 END), 0) AS total_sales
FROM waiters w
LEFT JOIN orders o ON w.id = o.waiter_id AND o.created_at::date = CURRENT_DATE
WHERE w.status = 'active'
GROUP BY w.id, w.name, w.employee_id
ORDER BY total_sales DESC;

-- 10. Get top performing waiters (by sales) for a date range
SELECT 
    w.name,
    w.employee_id,
    COUNT(o.id) AS total_orders,
    COALESCE(SUM(o.grand_total), 0) AS total_sales,
    COALESCE(AVG(o.grand_total), 0) AS avg_order_value
FROM waiters w
INNER JOIN orders o ON w.id = o.waiter_id
WHERE o.status = 'completed'
  AND o.created_at >= '2025-11-01'
  AND o.created_at < '2025-12-01'
GROUP BY w.id, w.name, w.employee_id
ORDER BY total_sales DESC
LIMIT 10;

-- 11. Get waiter with least active orders (for load balancing)
SELECT 
    w.id,
    w.name,
    w.employee_id,
    COUNT(o.id) AS active_order_count
FROM waiters w
LEFT JOIN orders o ON w.id = o.waiter_id AND o.status = 'pending'
WHERE w.status = 'active'
GROUP BY w.id, w.name, w.employee_id
ORDER BY active_order_count ASC
LIMIT 1;

-- =====================================================
-- ANALYTICAL QUERIES
-- =====================================================

-- 12. Average time to complete orders by waiter
SELECT 
    w.name,
    w.employee_id,
    COUNT(o.id) AS completed_orders,
    AVG(EXTRACT(EPOCH FROM (o.updated_at - o.created_at))/60) AS avg_completion_time_minutes
FROM waiters w
INNER JOIN orders o ON w.id = o.waiter_id
WHERE o.status = 'completed'
  AND o.created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY w.id, w.name, w.employee_id
HAVING COUNT(o.id) > 0
ORDER BY avg_completion_time_minutes ASC;

-- 13. Orders by waiter and order type
SELECT 
    w.name,
    o.order_type,
    COUNT(o.id) AS order_count,
    SUM(o.grand_total) AS total_sales
FROM waiters w
INNER JOIN orders o ON w.id = o.waiter_id
WHERE o.status = 'completed'
  AND o.created_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY w.id, w.name, o.order_type
ORDER BY w.name, o.order_type;

-- 14. Find orders without assigned waiters (data quality check)
SELECT 
    o.id,
    o.order_number,
    o.order_type,
    o.status,
    o.created_at
FROM orders o
WHERE o.waiter_id IS NULL
  AND o.created_at >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY o.created_at DESC;

-- =====================================================
-- DASHBOARD QUERIES
-- =====================================================

-- 15. Waiter dashboard summary
SELECT 
    w.id,
    w.name,
    w.employee_id,
    w.status,
    -- Active orders
    COUNT(CASE WHEN o.status = 'pending' THEN 1 END) AS active_orders,
    -- Today's completed orders
    COUNT(CASE WHEN o.status = 'completed' AND o.created_at::date = CURRENT_DATE THEN 1 END) AS completed_today,
    -- Today's sales
    COALESCE(SUM(CASE WHEN o.status = 'completed' AND o.created_at::date = CURRENT_DATE THEN o.grand_total ELSE 0 END), 0) AS sales_today,
    -- All time stats
    COUNT(CASE WHEN o.status = 'completed' THEN 1 END) AS total_completed,
    COALESCE(SUM(CASE WHEN o.status = 'completed' THEN o.grand_total ELSE 0 END), 0) AS total_lifetime_sales
FROM waiters w
LEFT JOIN orders o ON w.id = o.waiter_id
GROUP BY w.id, w.name, w.employee_id, w.status
ORDER BY active_orders DESC, sales_today DESC;

-- 16. Real-time waiter workload
SELECT 
    w.name,
    w.status,
    COUNT(o.id) AS pending_orders,
    STRING_AGG(rt.name, ', ') AS active_tables
FROM waiters w
LEFT JOIN orders o ON w.id = o.waiter_id AND o.status = 'pending'
LEFT JOIN restaurant_tables rt ON o.restaurant_table_id = rt.id
WHERE w.status = 'active'
GROUP BY w.id, w.name, w.status
ORDER BY pending_orders DESC;
