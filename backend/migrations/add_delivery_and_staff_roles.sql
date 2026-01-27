-- Add delivery and staff roles to the system
-- 
-- RECOMMENDED: Use the POS UI at Settings > Role Management to create these roles
-- ALTERNATIVE: Run this SQL script if you prefer direct database access
-- 
-- To run: psql -d your_database -f migrations/add_delivery_and_staff_roles.sql

-- Insert new roles with their permissions
INSERT INTO roles (name, tab_dashboard, tab_orders, tab_menu, tab_inventory, tab_ingredients, tab_billing, tab_reports, tab_customers, tab_settings) VALUES
    ('Delivery', true, true, false, false, false, false, false, true, false),
    ('Staff', true, true, false, false, false, false, false, false, false)
ON CONFLICT (name) DO NOTHING;

-- Role Permissions:
-- Delivery: Dashboard ✓, Orders ✓, Customers ✓ (for delivery info)
-- Staff: Dashboard ✓, Orders ✓ (basic waiter/kitchen staff access)
--
-- These roles will automatically appear in:
-- - POS System > Settings > Role Management
-- - POS System > Settings > User Management (role dropdown)
