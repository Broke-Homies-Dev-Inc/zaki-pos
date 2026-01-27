-- Script to create test waiter and staff users
-- 
-- RECOMMENDED: Use the POS UI at Settings > User Management to create users
-- ALTERNATIVE: Run this SQL script if you prefer direct database access
--
-- Prerequisites: Ensure Waiter/Staff/Delivery roles exist first
-- (Create via POS UI or run add_delivery_and_staff_roles.sql)

-- First, verify roles exist:
SELECT id, name FROM roles WHERE name IN ('Waiter', 'Staff', 'Delivery') ORDER BY name;

-- Create test waiter user (username: waiter1, password: waiter123)
DO $$
DECLARE
    waiter_role_id UUID;
BEGIN
    SELECT id INTO waiter_role_id FROM roles WHERE name = 'Waiter' LIMIT 1;
    
    INSERT INTO users (username, password_hash, name, role_id, is_active)
    VALUES (
        'waiter1',
        '$2b$10$rqK3Xv3qC0kHZ3lLwqYxA.XJ3Fv3qC0kHZ3lLwqYxA.XJ3Fv3qC0k',  -- Password: waiter123
        'Test Waiter',
        waiter_role_id,
        true
    )
    ON CONFLICT (username) DO NOTHING;
END $$;

-- Create test staff user (username: staff1, password: staff123)
DO $$
DECLARE
    staff_role_id UUID;
BEGIN
    SELECT id INTO staff_role_id FROM roles WHERE name = 'Staff' LIMIT 1;
    
    INSERT INTO users (username, password_hash, name, role_id, is_active)
    VALUES (
        'staff1',
        '$2b$10$vN8mW6tD1mKI4nNxBzRzY.YK4Gw6tD1mKI4nNxBzRzY.YK4Gw6tD2',  -- Password: staff123
        'Test Staff',
        staff_role_id,
        true
    )
    ON CONFLICT (username) DO NOTHING;
END $$;

-- Verify users were created
SELECT u.id, u.username, u.name, u.is_active, r.name as role_name
FROM users u
LEFT JOIN roles r ON u.role_id = r.id
WHERE u.username IN ('waiter1', 'staff1');

-- Test credentials:
-- Username: waiter1, Password: waiter123
-- Username: staff1, Password: staff123
